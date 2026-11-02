// ใช้: npm run setup:sheets [-- --seed]  (ต้องตั้ง env ตาม .env.example ก่อน)
import { loadEnv } from '../src/config/env.ts';
import { SHEETS } from '../src/config/schema.ts';
import { createClients } from '../src/services/google.ts';

const { env } = loadEnv();
const { sheets } = createClients(env);
const id = env.SPREADSHEET_ID;
const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));

for (const [name, headers] of Object.entries(SHEETS)) {
  if (!existing.has(name)) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [{ addSheet: { properties: { title: name, gridProperties: { frozenRowCount: 1 } } } }] } });
    console.log(`สร้างชีต ${name}`);
  }
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: `${name}!1:1` });
  const row = (r.data.values?.[0] ?? []) as string[];
  if (row.length === 0) {
    await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `${name}!A1`, valueInputOption: 'RAW', requestBody: { values: [[...headers]] } });
    console.log(`เขียน Header ชีต ${name}`);
  } else {
    const missing = headers.filter((h) => !row.includes(h));
    console.log(missing.length ? `⚠ ชีต ${name} ขาดคอลัมน์: ${missing.join(', ')} (ไม่แก้ให้อัตโนมัติเพื่อไม่ให้ข้อมูลเสียหาย)` : `ชีต ${name} OK`);
  }
}

if (process.argv.includes('--seed')) {
  const t = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'SurveyTypes!A2:A' });
  if (!t.data.values?.length) {
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: 'SurveyTypes!A1', valueInputOption: 'RAW', requestBody: { values: [
      ['T-TREE', 'สำรวจต้นไม้', 'ตัวอย่าง', 'TRUE', '1', now, now, '#16a34a'],
    ] } });
    await sheets.spreadsheets.values.append({ spreadsheetId: id, range: 'FormFields!A1', valueInputOption: 'RAW', requestBody: { values: [
      ['F-001', 'T-TREE', 'species', 'ชนิดต้นไม้', 'select', 'TRUE', 'สัก|ยางพารา|มะม่วง|อื่น ๆ', '1', 'TRUE', '', '', 'TRUE'],
      ['F-002', 'T-TREE', 'height_m', 'ความสูง (เมตร)', 'number', 'FALSE', '', '2', 'TRUE', 'เช่น 3.5', '', 'TRUE'],
      ['F-003', 'T-TREE', 'owner_contact', 'ติดต่อเจ้าของ (ไม่เผยแพร่)', 'text', 'FALSE', '', '3', 'TRUE', '', 'ฟิลด์นี้ Is_Public=FALSE จึงไม่แสดงบน WebGIS', 'FALSE'],
    ] } });
    console.log('เพิ่มข้อมูลตัวอย่าง (ประเภท T-TREE และ 3 ฟิลด์)');
  }
}
console.log('เสร็จสิ้น');
