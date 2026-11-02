import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JPEG, base, m, setup } from './fakes.ts';
import { toCsv, csvCell } from '../src/utils/csv.ts';
import { sniffImage } from '../src/utils/files.ts';
import { deriveEditCode, hashEditCode, normalizeEditCode } from '../src/utils/ids.ts';
import { AppError } from '../src/utils/errors.ts';

const KEY = 'idem-key-0123456789abcdef';
const rejects = (p: Promise<unknown>, status: number) => assert.rejects(p, (e: unknown) => e instanceof AppError && e.status === status);

test('W1: ไม่มีรูป -> READY และแสดงใน WebGIS ทันที; ไม่รั่วรหัส/แฮช/ฟิลด์ไม่ public', async () => {
  const { svc } = setup();
  const r = await svc.create(base(), KEY);
  assert.equal(r.status, 'READY');
  const list = await svc.webgisList();
  assert.equal(list.length, 1);
  const json = JSON.stringify(list) + JSON.stringify(await svc.webgisDetail(r.surveyId));
  assert.ok(!json.includes(r.editCode) && !json.includes('Edit_Token') && !json.includes('0812345678') && !json.includes('owner_phone'));
  assert.ok(json.includes('สัก'));
});

test('W2: มีรูป 3 รูป -> แสดงเมื่อครบทั้งหมดเท่านั้น', async () => {
  const { svc } = setup();
  const r = await svc.create(base({ photos: m(3) }), KEY);
  assert.equal(r.status, 'PENDING_UPLOAD');
  assert.equal((await svc.webgisList()).length, 0);
  await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[1].photoId, JPEG);
  assert.equal((await svc.webgisList()).length, 0);
  const last = await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[2].photoId, JPEG);
  assert.equal(last.surveyStatus, 'READY');
  const l = await svc.webgisList();
  assert.equal(l.length, 1);
  assert.equal(l[0].photoCount, 3);
});

test('W3+W4: Drive ล้มเหลว -> UPLOAD_FAILED ไม่แสดง; retry ใช้ Survey_ID เดิมแล้ว READY', async () => {
  const { svc, files, tables } = setup();
  const r = await svc.create(base({ photos: m(2) }), KEY);
  await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  files.failNext = true;
  await rejects(svc.uploadPhoto(r.surveyId, r.editCode, r.photos[1].photoId, JPEG), 502);
  assert.equal(tables.surveys.rows[0].Status, 'UPLOAD_FAILED');
  assert.equal((await svc.webgisList()).length, 0);
  const resumed = await svc.retry(r.surveyId, r.editCode);
  assert.equal(resumed.pendingPhotos.length, 1);
  const done = await svc.uploadPhoto(r.surveyId, r.editCode, resumed.pendingPhotos[0].photoId, JPEG);
  assert.equal(done.surveyStatus, 'READY');
  assert.equal(tables.surveys.rows.length, 1);
});

test('W5: ส่งซ้ำด้วย Idempotency-Key เดิม -> ไม่สร้างรายการซ้ำ ได้รหัสเดิม', async () => {
  const { svc, tables } = setup();
  const a = await svc.create(base({ photos: m(2) }), KEY);
  const b = await svc.create(base({ photos: m(2) }), KEY);
  assert.equal(a.surveyId, b.surveyId);
  assert.equal(a.editCode, b.editCode);
  assert.equal(b.replayed, true);
  assert.equal(tables.surveys.rows.length, 1);
  assert.equal(tables.photos.rows.length, 2);
  assert.ok(await svc.findReplay(KEY));
  assert.equal(await svc.findReplay('another-key-0123456789'), null);
  // concurrent
  const [x, y] = await Promise.all([svc.create(base(), 'concurrent-key-0123456789'), svc.create(base(), 'concurrent-key-0123456789')]);
  assert.equal(x.surveyId, y.surveyId);
});

test('W5b: Drive อัปโหลดสำเร็จแต่บันทึก Metadata ล้มเหลว -> retry ไม่สร้างไฟล์ซ้ำ', async () => {
  const { svc, files, tables } = setup();
  const r = await svc.create(base({ photos: m(1) }), KEY);
  tables.photos.failNextUpdate = true;
  await rejects(svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG), 502);
  assert.equal(files.files.size, 1);
  assert.equal((await svc.webgisList()).length, 0);
  const done = await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  assert.equal(done.surveyStatus, 'READY');
  assert.equal(files.files.size, 1);
});

test('W5c: อัปโหลดรูปเดิมซ้ำ -> ไม่เรียก Drive ซ้ำ', async () => {
  const { svc, files } = setup();
  const r = await svc.create(base({ photos: m(1) }), KEY);
  await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  const again = await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  assert.equal(again.alreadyUploaded, true);
  assert.equal(files.puts, 1);
});

test('W6-8: แก้ไขด้วยรหัสถูก, รหัสผิด/รายการอื่น/ไม่มีรหัส ถูกปฏิเสธ', async () => {
  const { svc } = setup();
  const a = await svc.create(base(), KEY);
  const b = await svc.create(base(), 'second-key-0123456789abcd');
  const upd = await svc.update(a.surveyId, a.editCode, { description: 'ใหม่', customFields: { species: 'ยาง' } });
  assert.equal(upd.description, 'ใหม่');
  assert.equal(upd.customFields.species, 'ยาง');
  assert.equal(upd.customFields.owner_phone, '0812345678'); // ค่าเดิมไม่หาย
  await rejects(svc.update(a.surveyId, 'AAAAA-BBBBB-CCCCC-DDDDD', { description: 'x' }), 403);
  await rejects(svc.update(a.surveyId, b.editCode, { description: 'x' }), 403); // รหัสของรายการอื่น
  await rejects(svc.getForEdit(a.surveyId, ''), 403);
  await rejects(svc.softDelete('SV-NOTEXIST00', a.editCode), 403);
  assert.equal(normalizeEditCode('abcde-fghjk'), 'ABCDE-FGHJK'.replace('-', ''));
});

test('ลบแบบ Soft Delete -> หายจาก WebGIS, แถวยังอยู่, ดำเนินการต่อไม่ได้ (410)', async () => {
  const { svc, tables } = setup();
  const a = await svc.create(base(), KEY);
  await svc.softDelete(a.surveyId, a.editCode);
  assert.equal((await svc.webgisList()).length, 0);
  assert.equal(tables.surveys.rows[0].Status, 'DELETED');
  assert.ok(tables.surveys.rows[0].Deleted_At);
  await rejects(svc.update(a.surveyId, a.editCode, { description: 'x' }), 410);
});

test('Validation ฝั่ง Server: ฟิลด์บังคับ, พิกัด, จำนวน/ชนิดรูป, ชนิดงาน', async () => {
  const { svc } = setup();
  await rejects(svc.create(base({ customFields: {} }), 'k1-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ customFields: { species: 'มะม่วง' } }), 'k2-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ latitude: 91 }), 'k3-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ longitude: Number.NaN }), 'k4-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ photos: m(6) }), 'k5-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ photos: [{ name: 'a.heic', size: 10, mime: 'image/heic' }] }), 'k6-0123456789abcdefgh'), 422);
  await rejects(svc.create(base({ surveyTypeId: 'NOPE' }), 'k7-0123456789abcdefgh'), 404);
});

test('อัปโหลดไฟล์ปลอม (ไม่ใช่รูปจริง) ถูกปฏิเสธด้วยลายเซ็นไฟล์', async () => {
  const { svc } = setup();
  const r = await svc.create(base({ photos: m(1) }), KEY);
  await rejects(svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, Buffer.from('<svg onload=alert(1)>')), 415);
});

test('แก้ไขรายการ READY โดยเพิ่มรูป -> กลับเป็น PENDING_UPLOAD และถูกซ่อนจนอัปโหลดครบ', async () => {
  const { svc } = setup();
  const a = await svc.create(base(), KEY);
  assert.equal((await svc.webgisList()).length, 1);
  const u = await svc.update(a.surveyId, a.editCode, { addPhotos: m(1) });
  assert.equal(u.status, 'PENDING_UPLOAD');
  assert.equal((await svc.webgisList()).length, 0);
  const r = await svc.uploadPhoto(a.surveyId, a.editCode, u.pendingPhotos[0].photoId, JPEG);
  assert.equal(r.surveyStatus, 'READY');
  assert.equal((await svc.webgisList()).length, 1);
});

test('การตั้งค่าฟิลด์ผิด (select ไม่มี Options) ถูกข้ามพร้อมคำเตือน ไม่ทำให้ระบบล่ม', async () => {
  const { svc, warnings } = setup();
  const s = await svc.getFormSchema('T1');
  assert.deepEqual(s.fields.map((f) => f.key), ['species', 'owner_phone']);
  assert.ok(warnings.some((w) => w.includes('F3')));
});

test('รูปจากรายการอื่น/ที่ยังไม่ READY อ่านผ่าน WebGIS ไม่ได้', async () => {
  const { svc } = setup();
  const r = await svc.create(base({ photos: m(1) }), KEY);
  await rejects(svc.webgisPhoto(r.surveyId, r.photos[0].photoId), 404);
  await svc.uploadPhoto(r.surveyId, r.editCode, r.photos[0].photoId, JPEG);
  const ph = await svc.webgisPhoto(r.surveyId, r.photos[0].photoId);
  assert.equal(ph.mime, 'image/jpeg');
  await rejects(svc.webgisPhoto('SV-OTHER00000', r.photos[0].photoId), 404);
});

test('Export: CSV ป้องกัน Formula Injection + BOM; รหัสแก้ไขเป็นแบบกำหนดซ้ำได้และ hash ตรงกัน', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('+1'), `"'+1"`);
  assert.equal(csvCell(-12.5), '-12.5');
  assert.ok(toCsv(['a'], [['สวัสดี']]).startsWith('\uFEFF"a"'));
  const c = deriveEditCode('s'.repeat(32), 'SV-1', 'k');
  assert.match(c, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
  assert.equal(c, deriveEditCode('s'.repeat(32), 'SV-1', 'k'));
  assert.equal(hashEditCode(c), hashEditCode(c.toLowerCase().replace(/-/g, ' ')));
  assert.equal(sniffImage(JPEG)?.mime, 'image/jpeg');
  assert.equal(sniffImage(Buffer.from('GIF89a....')), null);
});

test('Export data รวมเฉพาะ READY และฟิลด์ public', async () => {
  const { svc } = setup();
  await svc.create(base(), KEY);
  await svc.create(base({ photos: m(1) }), 'pending-key-0123456789abc');
  const e = await svc.exportData();
  assert.equal(e.items.length, 1);
  assert.deepEqual(e.keys, ['species']);
});
