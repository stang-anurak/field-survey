import type { FieldDef, FileStore, PhotoManifest, Row, SurveyStatus, Tables } from '../types/index.ts';
import { AppError } from '../utils/errors.ts';
import { Mutex } from '../utils/mutex.ts';
import { deriveEditCode, hashEditCode, newId, safeEqualHex, sha256Hex } from '../utils/ids.ts';
import { sniffImage } from '../utils/files.ts';
import { bySort, parseFormFields, sortNum, truthy, validateCustomFields } from './formSchema.ts';
import type { CustomValue } from './formSchema.ts';

export const MAX_PHOTOS = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export interface Deps {
  tables: Tables;
  files: FileStore;
  editSecret: string;
  publicSurveyorName?: boolean;
  clock?: () => Date;
  warn?: (msg: string) => void;
}

export interface CreateInput {
  surveyTypeId: string;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number | null;
  surveyorName?: string;
  description?: string;
  customFields: Record<string, unknown>;
  photos: PhotoManifest[];
}

export interface UpdateInput {
  latitude?: number;
  longitude?: number;
  gpsAccuracy?: number | null;
  surveyorName?: string;
  description?: string;
  customFields?: Record<string, unknown>;
  addPhotos?: PhotoManifest[];
  removePhotoIds?: string[];
}

const FORBIDDEN = () => new AppError(403, 'FORBIDDEN', 'ไม่พบรายการ หรือรหัสแก้ไขไม่ถูกต้อง');
const clean = (s: unknown, max: number): string =>
  String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const safeName = (s: string): string => clean(s.split(/[\\/]/).pop() ?? '', 150) || 'photo';
const safeColor = (c?: string): string => (/^#[0-9a-fA-F]{6}$/.test(c ?? '') ? (c as string) : '#2563eb');

export function assertCoords(lat: unknown, lng: unknown): void {
  const errs: Record<string, string> = {};
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) errs.latitude = 'Latitude ต้องอยู่ระหว่าง -90 ถึง 90';
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) errs.longitude = 'Longitude ต้องอยู่ระหว่าง -180 ถึง 180';
  if (Object.keys(errs).length) throw new AppError(422, 'VALIDATION_FAILED', 'พิกัดไม่ถูกต้อง', errs);
}

export function validateManifest(list: PhotoManifest[], already = 0): PhotoManifest[] {
  if (already + list.length > MAX_PHOTOS) throw new AppError(422, 'TOO_MANY_PHOTOS', `แนบรูปได้สูงสุด ${MAX_PHOTOS} รูปต่อรายการ`);
  return list.map((p, i) => {
    if (!ALLOWED_MIME.includes(p.mime)) throw new AppError(422, 'UNSUPPORTED_FILE', `รูปที่ ${i + 1}: รองรับเฉพาะ JPG, PNG, WebP (ยังไม่รองรับ HEIC กรุณาแปลงเป็น JPG ก่อน)`);
    if (!Number.isFinite(p.size) || p.size < 1 || p.size > MAX_BYTES) throw new AppError(422, 'FILE_TOO_LARGE', `รูปที่ ${i + 1}: ขนาดต้องไม่เกิน 10 MB`);
    return { name: safeName(p.name), size: p.size, mime: p.mime };
  });
}

/** สถานะที่ Backend คำนวณเองจากสถานะรูป (Frontend เปลี่ยนไม่ได้) */
export function computeStatus(photos: Row[]): { status: SurveyStatus; expected: number; uploaded: number } {
  const active = photos.filter((p) => p.Upload_Status !== 'REMOVED');
  const uploaded = active.filter((p) => p.Upload_Status === 'UPLOADED').length;
  const failed = active.some((p) => p.Upload_Status === 'FAILED');
  const status: SurveyStatus = uploaded === active.length ? 'READY' : failed ? 'UPLOAD_FAILED' : 'PENDING_UPLOAD';
  return { status, expected: active.length, uploaded };
}

export class SurveyService {
  #t: Tables;
  #files: FileStore;
  #secret: string;
  #publicSurveyor: boolean;
  #clock: () => Date;
  #warn: (m: string) => void;
  #lock = new Mutex();

  constructor(d: Deps) {
    this.#t = d.tables;
    this.#files = d.files;
    this.#secret = d.editSecret;
    this.#publicSurveyor = d.publicSurveyorName ?? false;
    this.#clock = d.clock ?? (() => new Date());
    this.#warn = d.warn ?? ((m) => console.warn(m));
  }

  #now(): string { return this.#clock().toISOString(); }

  async #log(surveyId: string, action: string, actor: string, details: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.#t.activity.append([{ Log_ID: newId('LG', 12), Survey_ID: surveyId, Action: action, Actor_Type: actor, Timestamp: this.#now(), Details: JSON.stringify(details).slice(0, 500) }]);
    } catch { this.#warn('activity log write failed'); }
  }

  // ---------- Types & form schema ----------
  async listTypes() {
    const rows = await this.#t.surveyTypes.readAll();
    return rows.filter((r) => r.Survey_Type_ID && truthy(r.Is_Active)).sort(bySort)
      .map((r) => ({ id: r.Survey_Type_ID, name: r.Type_Name, description: r.Description ?? '', color: safeColor(r.Marker_Color) }));
  }

  async #type(id: string): Promise<Row> {
    const rows = await this.#t.surveyTypes.readAll();
    const t = rows.find((r) => r.Survey_Type_ID === id && truthy(r.Is_Active));
    if (!t) throw new AppError(404, 'TYPE_NOT_FOUND', 'ไม่พบประเภทงานสำรวจนี้');
    return t;
  }

  async #fields(typeId: string): Promise<FieldDef[]> {
    const { fields, problems } = parseFormFields(await this.#t.formFields.readAll(), typeId);
    for (const p of problems) this.#warn(`form config: ${p}`);
    return fields;
  }

  async getFormSchema(typeId: string) {
    const t = await this.#type(typeId);
    const fields = await this.#fields(typeId);
    return {
      type: { id: t.Survey_Type_ID, name: t.Type_Name, description: t.Description ?? '' },
      fields: fields.map(({ isPublic: _p, ...f }) => f),
    };
  }

  // ---------- Create (idempotent) ----------
  async findReplay(idemKey: string) {
    const hash = sha256Hex(idemKey);
    const s = (await this.#t.surveys.readAll({ fresh: true })).find((r) => r.Idempotency_Key_Hash === hash);
    return s ? this.#createResult(s, idemKey, true) : null;
  }

  async #createResult(s: Row, idemKey: string, replayed: boolean) {
    const photos = (await this.#photosOf(s.Survey_ID)).filter((p) => p.Upload_Status !== 'REMOVED');
    return {
      surveyId: s.Survey_ID,
      editCode: deriveEditCode(this.#secret, s.Survey_ID, idemKey),
      status: s.Status as SurveyStatus,
      expectedPhotoCount: Number(s.Expected_Photo_Count),
      uploadedPhotoCount: Number(s.Uploaded_Photo_Count),
      photos: photos.map((p) => ({ photoId: p.Photo_ID, status: p.Upload_Status })),
      replayed,
    };
  }

  create(input: CreateInput, idemKey: string) {
    return this.#lock.run(async () => {
      const hash = sha256Hex(idemKey);
      const surveys = await this.#t.surveys.readAll({ fresh: true });
      const dup = surveys.find((r) => r.Idempotency_Key_Hash === hash);
      if (dup) return this.#createResult(dup, idemKey, true);

      assertCoords(input.latitude, input.longitude);
      const type = await this.#type(input.surveyTypeId);
      const { values, errors } = validateCustomFields(await this.#fields(type.Survey_Type_ID), input.customFields);
      if (Object.keys(errors).length) throw new AppError(422, 'VALIDATION_FAILED', 'กรุณาตรวจสอบข้อมูลที่กรอก', errors);
      const manifest = validateManifest(input.photos ?? []);

      let surveyId = newId('SV', 10);
      while (surveys.some((r) => r.Survey_ID === surveyId)) surveyId = newId('SV', 10);
      const now = this.#now();
      const photoRows: Row[] = manifest.map((p, i) => ({
        Photo_ID: newId('PH', 12), Survey_ID: surveyId, Original_File_Name: p.name, Drive_File_ID: '', MIME_Type: p.mime,
        File_Size: String(p.size), Upload_Status: 'PENDING', Sort_Order: String(i + 1), Created_At: now, Uploaded_At: '', Error_Code: '',
      }));
      // เขียน Photos ก่อน Surveys: ถ้าล้มเหลวกลางทางจะเหลือเพียงแถวรูปกำพร้า (ไม่มีผลต่อ WebGIS) และ retry ด้วย key เดิมสร้างใหม่ได้
      if (photoRows.length) await this.#t.photos.append(photoRows);
      const row: Row = {
        Survey_ID: surveyId, Survey_Type_ID: type.Survey_Type_ID, Latitude: String(input.latitude), Longitude: String(input.longitude),
        GPS_Accuracy: input.gpsAccuracy == null ? '' : String(input.gpsAccuracy),
        Surveyor_Name: clean(input.surveyorName, 100), Description: clean(input.description, 2000),
        Custom_Fields_JSON: JSON.stringify(values), Status: photoRows.length ? 'PENDING_UPLOAD' : 'READY',
        Expected_Photo_Count: String(photoRows.length), Uploaded_Photo_Count: '0',
        Edit_Token_Hash: hashEditCode(deriveEditCode(this.#secret, surveyId, idemKey)), Idempotency_Key_Hash: hash,
        Created_At: now, Updated_At: now, Deleted_At: '',
      };
      await this.#t.surveys.append([row]);
      await this.#log(surveyId, 'CREATED', 'SUBMITTER', { photos: photoRows.length });
      if (!photoRows.length) await this.#log(surveyId, 'PUBLISHED', 'SYSTEM');
      return this.#createResult(row, idemKey, false);
    });
  }

  // ---------- Owner auth ----------
  async authenticate(surveyId: string, code: string, allowDeleted = false): Promise<Row> {
    const s = (await this.#t.surveys.readAll()).find((r) => r.Survey_ID === surveyId);
    const given = hashEditCode(code ?? '');
    if (!s || !s.Edit_Token_Hash || !safeEqualHex(s.Edit_Token_Hash, given)) throw FORBIDDEN();
    if (s.Status === 'DELETED' && !allowDeleted) throw new AppError(410, 'DELETED', 'รายการนี้ถูกลบแล้ว');
    return s;
  }

  async #photosOf(surveyId: string): Promise<Row[]> {
    return (await this.#t.photos.readAll()).filter((p) => p.Survey_ID === surveyId).sort((a, b) => sortNum(a.Sort_Order) - sortNum(b.Sort_Order));
  }

  async #sync(s: Row): Promise<Row> {
    if (s.Status === 'DELETED') return s;
    const c = computeStatus(await this.#photosOf(s.Survey_ID));
    const patch: Row = { Status: c.status, Expected_Photo_Count: String(c.expected), Uploaded_Photo_Count: String(c.uploaded) };
    if (patch.Status !== s.Status || patch.Expected_Photo_Count !== s.Expected_Photo_Count || patch.Uploaded_Photo_Count !== s.Uploaded_Photo_Count) {
      await this.#t.surveys.updateById('Survey_ID', s.Survey_ID, { ...patch, Updated_At: this.#now() });
      if (c.status === 'READY' && s.Status !== 'READY') await this.#log(s.Survey_ID, 'PUBLISHED', 'SYSTEM');
    }
    return { ...s, ...patch };
  }

  async #ownerView(s: Row) {
    const photos = await this.#photosOf(s.Survey_ID);
    let custom: Record<string, CustomValue> = {};
    try { custom = JSON.parse(s.Custom_Fields_JSON || '{}'); } catch { this.#warn(`bad Custom_Fields_JSON for ${s.Survey_ID}`); }
    return {
      surveyId: s.Survey_ID, surveyTypeId: s.Survey_Type_ID, status: s.Status as SurveyStatus,
      latitude: Number(s.Latitude), longitude: Number(s.Longitude), gpsAccuracy: s.GPS_Accuracy === '' ? null : Number(s.GPS_Accuracy),
      surveyorName: s.Surveyor_Name, description: s.Description, customFields: custom,
      expectedPhotoCount: Number(s.Expected_Photo_Count), uploadedPhotoCount: Number(s.Uploaded_Photo_Count),
      createdAt: s.Created_At, updatedAt: s.Updated_At,
      photos: photos.filter((p) => p.Upload_Status !== 'REMOVED').map((p) => ({
        photoId: p.Photo_ID, fileName: p.Original_File_Name, status: p.Upload_Status, size: Number(p.File_Size), mime: p.MIME_Type,
      })),
    };
  }

  async getForEdit(id: string, code: string) {
    const s = await this.authenticate(id, code);
    return this.#ownerView(s);
  }

  async submissionStatus(id: string, code: string) {
    const v = await this.getForEdit(id, code);
    return { surveyId: v.surveyId, status: v.status, expectedPhotoCount: v.expectedPhotoCount, uploadedPhotoCount: v.uploadedPhotoCount, photos: v.photos.map((p) => ({ photoId: p.photoId, status: p.status })) };
  }

  resume(id: string, code: string) {
    return this.#lock.run(async () => {
      const s = await this.#sync(await this.authenticate(id, code));
      const view = await this.#ownerView(s);
      return { ...view, pendingPhotos: view.photos.filter((p) => p.status !== 'UPLOADED') };
    });
  }

  retry(id: string, code: string) {
    return this.#lock.run(async () => {
      const s = await this.authenticate(id, code);
      for (const p of await this.#photosOf(id)) {
        if (p.Upload_Status === 'FAILED') await this.#t.photos.updateById('Photo_ID', p.Photo_ID, { Upload_Status: 'PENDING', Error_Code: '' });
      }
      const view = await this.#ownerView(await this.#sync(s));
      return { ...view, pendingPhotos: view.photos.filter((p) => p.status !== 'UPLOADED') };
    });
  }

  // ---------- Photos ----------
  async uploadPhoto(id: string, code: string, photoId: string, data: Buffer) {
    const sniff = sniffImage(data);
    if (!sniff) throw new AppError(415, 'UNSUPPORTED_FILE', 'ไฟล์ไม่ใช่รูป JPG, PNG หรือ WebP ที่ถูกต้อง');
    if (data.length > MAX_BYTES) throw new AppError(413, 'FILE_TOO_LARGE', 'ไฟล์ใหญ่เกิน 10 MB');

    const already = await this.#lock.run(async () => {
      const s = await this.authenticate(id, code);
      const p = (await this.#photosOf(id)).find((x) => x.Photo_ID === photoId);
      if (!p || p.Upload_Status === 'REMOVED') throw new AppError(404, 'PHOTO_NOT_FOUND', 'ไม่พบรูปนี้ในรายการ');
      if (p.Upload_Status === 'UPLOADED') return true;
      if (s.Status !== 'UPLOADING') await this.#t.surveys.updateById('Survey_ID', id, { Status: 'UPLOADING', Updated_At: this.#now() });
      return false;
    });

    if (!already) {
      let fileId: string;
      try {
        ({ fileId } = await this.#files.put({ surveyId: id, photoId, data, mime: sniff.mime, ext: sniff.ext }));
      } catch {
        await this.#markFailed(id, photoId, 'DRIVE_UPLOAD_FAILED');
        throw new AppError(502, 'UPLOAD_FAILED', 'อัปโหลดรูปไปยังที่เก็บไฟล์ไม่สำเร็จ กรุณาลองใหม่');
      }
      try {
        await this.#lock.run(() => this.#t.photos.updateById('Photo_ID', photoId, {
          Drive_File_ID: fileId, MIME_Type: sniff.mime, File_Size: String(data.length), Upload_Status: 'UPLOADED', Uploaded_At: this.#now(), Error_Code: '',
        }));
      } catch {
        // ไฟล์อยู่ใน Drive แล้วแต่บันทึก Metadata ไม่สำเร็จ: ลองใหม่ด้วย photoId เดิมจะพบไฟล์เดิมใน Drive (ไม่สร้างซ้ำ)
        await this.#markFailed(id, photoId, 'METADATA_WRITE_FAILED');
        throw new AppError(502, 'METADATA_FAILED', 'บันทึกข้อมูลรูปไม่สำเร็จ กรุณาลองส่งรูปนี้ซ้ำ');
      }
    }
    return this.#lock.run(async () => {
      const s = await this.#sync(await this.authenticate(id, code, true));
      return { photoId, photoStatus: 'UPLOADED', surveyStatus: s.Status, expectedPhotoCount: Number(s.Expected_Photo_Count), uploadedPhotoCount: Number(s.Uploaded_Photo_Count), alreadyUploaded: already };
    });
  }

  async #markFailed(id: string, photoId: string, code: string): Promise<void> {
    try {
      await this.#lock.run(async () => {
        await this.#t.photos.updateById('Photo_ID', photoId, { Upload_Status: 'FAILED', Error_Code: code });
        const s = (await this.#t.surveys.readAll({ fresh: true })).find((r) => r.Survey_ID === id);
        if (s) await this.#sync(s);
      });
    } catch { this.#warn('could not record photo failure'); }
  }

  // ---------- Update / delete ----------
  update(id: string, code: string, input: UpdateInput) {
    return this.#lock.run(async () => {
      const s = await this.authenticate(id, code);
      const patch: Row = {};
      const lat = input.latitude ?? Number(s.Latitude);
      const lng = input.longitude ?? Number(s.Longitude);
      assertCoords(lat, lng);
      patch.Latitude = String(lat); patch.Longitude = String(lng);
      if (input.gpsAccuracy !== undefined) patch.GPS_Accuracy = input.gpsAccuracy === null ? '' : String(input.gpsAccuracy);
      if (input.surveyorName !== undefined) patch.Surveyor_Name = clean(input.surveyorName, 100);
      if (input.description !== undefined) patch.Description = clean(input.description, 2000);

      if (input.customFields !== undefined) {
        let old: Record<string, unknown> = {};
        try { old = JSON.parse(s.Custom_Fields_JSON || '{}'); } catch { /* ใช้ค่าว่าง */ }
        const fields = await this.#fields(s.Survey_Type_ID);
        const { values, errors } = validateCustomFields(fields, { ...old, ...input.customFields });
        if (Object.keys(errors).length) throw new AppError(422, 'VALIDATION_FAILED', 'กรุณาตรวจสอบข้อมูลที่กรอก', errors);
        const activeKeys = new Set(fields.map((f) => f.key));
        const kept = Object.fromEntries(Object.entries(old).filter(([k]) => !activeKeys.has(k)));
        patch.Custom_Fields_JSON = JSON.stringify({ ...kept, ...values });
      }

      const photos = await this.#photosOf(id);
      for (const pid of input.removePhotoIds ?? []) {
        const p = photos.find((x) => x.Photo_ID === pid && x.Upload_Status !== 'REMOVED');
        if (!p) throw new AppError(404, 'PHOTO_NOT_FOUND', 'ไม่พบรูปที่ต้องการนำออก');
        // ไม่ลบไฟล์ใน Drive: ทำเครื่องหมาย REMOVED เพื่อให้ตรวจย้อนหลัง/กู้คืนได้
        await this.#t.photos.updateById('Photo_ID', pid, { Upload_Status: 'REMOVED' });
      }
      const activeCount = photos.filter((p) => p.Upload_Status !== 'REMOVED' && !(input.removePhotoIds ?? []).includes(p.Photo_ID)).length;
      const manifest = validateManifest(input.addPhotos ?? [], activeCount);
      if (manifest.length) {
        const now = this.#now();
        const base = photos.reduce((m, p) => Math.max(m, sortNum(p.Sort_Order)), 0);
        await this.#t.photos.append(manifest.map((p, i) => ({
          Photo_ID: newId('PH', 12), Survey_ID: id, Original_File_Name: p.name, Drive_File_ID: '', MIME_Type: p.mime, File_Size: String(p.size),
          Upload_Status: 'PENDING', Sort_Order: String(base + i + 1), Created_At: now, Uploaded_At: '', Error_Code: '',
        })));
      }
      await this.#t.surveys.updateById('Survey_ID', id, { ...patch, Updated_At: this.#now() });
      const fresh = (await this.#t.surveys.readAll({ fresh: true })).find((r) => r.Survey_ID === id) as Row;
      const synced = await this.#sync(fresh);
      await this.#log(id, 'UPDATED', 'SUBMITTER', { addedPhotos: manifest.length, removedPhotos: (input.removePhotoIds ?? []).length });
      const view = await this.#ownerView(synced);
      return { ...view, pendingPhotos: view.photos.filter((p) => p.status !== 'UPLOADED') };
    });
  }

  softDelete(id: string, code: string) {
    return this.#lock.run(async () => {
      await this.authenticate(id, code);
      const now = this.#now();
      await this.#t.surveys.updateById('Survey_ID', id, { Status: 'DELETED', Deleted_At: now, Updated_At: now });
      await this.#log(id, 'DELETED', 'SUBMITTER');
      return { surveyId: id, status: 'DELETED' as const };
    });
  }

  // ---------- WebGIS / Export (เฉพาะ READY และฟิลด์ที่ Is_Public) ----------
  async #publicItems() {
    const [surveys, photos, types, ff] = await Promise.all([this.#t.surveys.readAll(), this.#t.photos.readAll(), this.#t.surveyTypes.readAll(), this.#t.formFields.readAll()]);
    const typeMap = new Map(types.map((t) => [t.Survey_Type_ID, t]));
    const fieldCache = new Map<string, FieldDef[]>();
    const pubFields = (tid: string) => {
      if (!fieldCache.has(tid)) fieldCache.set(tid, parseFormFields(ff, tid).fields.filter((f) => f.isPublic));
      return fieldCache.get(tid) as FieldDef[];
    };
    const photoCount = new Map<string, number>();
    for (const p of photos) if (p.Upload_Status === 'UPLOADED') photoCount.set(p.Survey_ID, (photoCount.get(p.Survey_ID) ?? 0) + 1);

    const items = [];
    for (const s of surveys) {
      if (s.Status !== 'READY' || s.Deleted_At) continue;
      const lat = Number(s.Latitude); const lng = Number(s.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { this.#warn(`skip invalid coords ${s.Survey_ID}`); continue; }
      let custom: Record<string, CustomValue> = {};
      try { custom = JSON.parse(s.Custom_Fields_JSON || '{}'); } catch { /* ว่าง */ }
      const t = typeMap.get(s.Survey_Type_ID);
      items.push({
        surveyId: s.Survey_ID, typeId: s.Survey_Type_ID, typeName: t?.Type_Name ?? s.Survey_Type_ID, color: safeColor(t?.Marker_Color),
        latitude: lat, longitude: lng, description: s.Description,
        ...(this.#publicSurveyor ? { surveyorName: s.Surveyor_Name } : {}),
        createdAt: s.Created_At, photoCount: photoCount.get(s.Survey_ID) ?? 0,
        customFields: pubFields(s.Survey_Type_ID).filter((f) => custom[f.key] !== undefined).map((f) => ({ key: f.key, label: f.label, type: f.type, value: custom[f.key] })),
      });
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async webgisList() { return this.#publicItems(); }

  async webgisDetail(id: string) {
    const item = (await this.#publicItems()).find((i) => i.surveyId === id);
    if (!item) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรายการ');
    const photos = (await this.#photosOf(id)).filter((p) => p.Upload_Status === 'UPLOADED').map((p) => ({ photoId: p.Photo_ID }));
    return { ...item, photos };
  }

  async webgisPhoto(id: string, photoId: string) {
    const s = (await this.#t.surveys.readAll()).find((r) => r.Survey_ID === id);
    const p = (await this.#photosOf(id)).find((x) => x.Photo_ID === photoId);
    if (!s || s.Status !== 'READY' || s.Deleted_At || !p || p.Upload_Status !== 'UPLOADED' || !p.Drive_File_ID) throw new AppError(404, 'NOT_FOUND', 'ไม่พบรูป');
    return { fileId: p.Drive_File_ID, mime: ALLOWED_MIME.includes(p.MIME_Type) ? p.MIME_Type : 'application/octet-stream', stream: () => this.#files.open(p.Drive_File_ID) };
  }

  async exportData() {
    const items = await this.#publicItems();
    const keys = [...new Set(items.flatMap((i) => i.customFields.map((f) => f.key)))].sort();
    return { items, keys };
  }
}
