import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type { drive_v3, sheets_v4 } from 'googleapis';
import type { FileStore, Row, Table, Tables } from '../types/index.ts';
import { SHEETS } from '../config/schema.ts';

export interface GoogleEnv {
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: string;
  SPREADSHEET_ID: string;
  DRIVE_FOLDER_ID: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REFRESH_TOKEN?: string;
}

export function createClients(env: GoogleEnv): { sheets: sheets_v4.Sheets; drive: drive_v3.Drive } {
  const credentials = JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8'));
  const saAuth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'] });
  const sheets = google.sheets({ version: 'v4', auth: saAuth });
  let driveAuth: any = saAuth;
  if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    // ใช้บัญชีผู้ใช้จริงเก็บไฟล์ (Service Account ไม่มีโควตาพื้นที่ใน My Drive) ดู docs/GOOGLE_SETUP.md
    const o = new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET);
    o.setCredentials({ refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN });
    driveAuth = o;
  }
  return { sheets, drive: google.drive({ version: 'v3', auth: driveAuth }) };
}

const colLetter = (n: number): string => { let s = ''; for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };

export class SheetsTable implements Table {
  #sheets: sheets_v4.Sheets;
  #id: string;
  #name: string;
  #required: readonly string[];
  #cache: { at: number; header: string[]; rows: string[][] } | null = null;
  static TTL_MS = 5000;

  constructor(sheets: sheets_v4.Sheets, spreadsheetId: string, name: string, required: readonly string[]) {
    this.#sheets = sheets; this.#id = spreadsheetId; this.#name = name; this.#required = required;
  }

  async #load(fresh: boolean) {
    if (!fresh && this.#cache && Date.now() - this.#cache.at < SheetsTable.TTL_MS) return this.#cache;
    const res = await this.#sheets.spreadsheets.values.get({ spreadsheetId: this.#id, range: `${this.#name}!A1:ZZ`, valueRenderOption: 'FORMATTED_VALUE' });
    const values = (res.data.values ?? []) as string[][];
    const header = (values[0] ?? []).map((h) => String(h).trim());
    const missing = this.#required.filter((h) => !header.includes(h));
    if (missing.length) throw new Error(`Sheet "${this.#name}" ขาดคอลัมน์: ${missing.join(', ')} (รัน npm run setup:sheets หรือแก้ Header)`);
    this.#cache = { at: Date.now(), header, rows: values.slice(1) };
    return this.#cache;
  }

  async readAll(opts?: { fresh?: boolean }): Promise<Row[]> {
    const { header, rows } = await this.#load(opts?.fresh ?? false);
    return rows.filter((r) => r.some((c) => String(c ?? '') !== '')).map((r) => Object.fromEntries(header.map((h, i) => [h, String(r[i] ?? '')])));
  }

  async append(rows: Row[]): Promise<void> {
    const { header } = await this.#load(true);
    this.#cache = null;
    await this.#sheets.spreadsheets.values.append({
      spreadsheetId: this.#id, range: `${this.#name}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows.map((r) => header.map((h) => r[h] ?? '')) },
    });
  }

  async updateById(idColumn: string, id: string, patch: Row): Promise<boolean> {
    const { header, rows } = await this.#load(true);
    const idx = header.indexOf(idColumn);
    const at = rows.findIndex((r) => String(r[idx] ?? '') === id);
    this.#cache = null;
    if (at < 0) return false;
    const next = header.map((h, i) => (h in patch ? patch[h] : String(rows[at][i] ?? '')));
    const rowNo = at + 2;
    await this.#sheets.spreadsheets.values.update({
      spreadsheetId: this.#id, range: `${this.#name}!A${rowNo}:${colLetter(header.length)}${rowNo}`, valueInputOption: 'RAW', requestBody: { values: [next] },
    });
    return true;
  }
}

export class DriveFileStore implements FileStore {
  #drive: drive_v3.Drive;
  #root: string;
  #folders = new Map<string, string>();
  constructor(drive: drive_v3.Drive, rootFolderId: string) { this.#drive = drive; this.#root = rootFolderId; }

  async #folderFor(surveyId: string): Promise<string> {
    const hit = this.#folders.get(surveyId);
    if (hit) return hit;
    const found = await this.#drive.files.list({
      q: `'${this.#root}' in parents and mimeType='application/vnd.google-apps.folder' and appProperties has { key='surveyId' and value='${surveyId}' } and trashed=false`,
      fields: 'files(id)', pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true,
    });
    let id = found.data.files?.[0]?.id ?? undefined;
    if (!id) {
      const c = await this.#drive.files.create({
        requestBody: { name: surveyId, mimeType: 'application/vnd.google-apps.folder', parents: [this.#root], appProperties: { surveyId } },
        fields: 'id', supportsAllDrives: true,
      });
      id = c.data.id ?? undefined;
    }
    if (!id) throw new Error('drive folder create failed');
    this.#folders.set(surveyId, id);
    return id;
  }

  async put(a: { surveyId: string; photoId: string; data: Buffer; mime: string; ext: string }): Promise<{ fileId: string }> {
    // idempotent: ถ้าเคยอัปโหลด photoId นี้ไปแล้ว (แต่บันทึก Metadata ไม่สำเร็จ) ใช้ไฟล์เดิม
    const existing = await this.#drive.files.list({
      q: `appProperties has { key='photoId' and value='${a.photoId}' } and trashed=false`,
      fields: 'files(id)', pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true,
    });
    const found = existing.data.files?.[0]?.id;
    if (found) return { fileId: found };
    const parent = await this.#folderFor(a.surveyId);
    // ไม่เรียก permissions.create: ไฟล์ไม่ถูกตั้งเป็น Public และสืบทอดสิทธิ์จากโฟลเดอร์
    const res = await this.#drive.files.create({
      requestBody: { name: `${a.photoId}.${a.ext}`, parents: [parent], mimeType: a.mime, appProperties: { photoId: a.photoId, surveyId: a.surveyId } },
      media: { mimeType: a.mime, body: Readable.from(a.data) }, fields: 'id', supportsAllDrives: true,
    });
    if (!res.data.id) throw new Error('drive upload returned no id');
    return { fileId: res.data.id };
  }

  async open(fileId: string): Promise<Readable> {
    const res = await this.#drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
    return res.data as unknown as Readable;
  }
}

export function createTables(sheets: sheets_v4.Sheets, spreadsheetId: string): Tables {
  const t = (name: keyof typeof SHEETS) => new SheetsTable(sheets, spreadsheetId, name, SHEETS[name]);
  return { surveys: t('Surveys'), photos: t('Photos'), surveyTypes: t('SurveyTypes'), formFields: t('FormFields'), activity: t('ActivityLog') };
}
