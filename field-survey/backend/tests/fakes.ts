import { Readable } from 'node:stream';
import type { FileStore, Row, Table, Tables } from '../src/types/index.ts';
import { SHEETS } from '../src/config/schema.ts';
import { SurveyService } from '../src/services/surveyService.ts';

export class MemTable implements Table {
  rows: Row[] = [];
  failNextUpdate = false;
  async readAll(): Promise<Row[]> { return this.rows.map((r) => ({ ...r })); }
  async append(rows: Row[]): Promise<void> { this.rows.push(...rows.map((r) => ({ ...r }))); }
  async updateById(col: string, id: string, patch: Row): Promise<boolean> {
    if (this.failNextUpdate) { this.failNextUpdate = false; throw new Error('sheets unavailable'); }
    const r = this.rows.find((x) => x[col] === id);
    if (!r) return false;
    Object.assign(r, patch);
    return true;
  }
}

export class MemFiles implements FileStore {
  files = new Map<string, { photoId: string; data: Buffer }>();
  failNext = false;
  puts = 0;
  async put(a: { surveyId: string; photoId: string; data: Buffer }) {
    this.puts++;
    if (this.failNext) { this.failNext = false; throw new Error('drive down'); }
    const existing = [...this.files.entries()].find(([, f]) => f.photoId === a.photoId);
    if (existing) return { fileId: existing[0] };
    const fileId = `F${this.files.size + 1}`;
    this.files.set(fileId, { photoId: a.photoId, data: a.data });
    return { fileId };
  }
  async open(fileId: string) { return Readable.from([this.files.get(fileId)!.data]); }
}

export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

export function setup() {
  const tables = { surveys: new MemTable(), photos: new MemTable(), surveyTypes: new MemTable(), formFields: new MemTable(), activity: new MemTable() };
  const files = new MemFiles();
  void SHEETS;
  tables.surveyTypes.rows.push({ Survey_Type_ID: 'T1', Type_Name: 'ต้นไม้', Description: '', Is_Active: 'TRUE', Sort_Order: '1', Marker_Color: '#16a34a' });
  tables.formFields.rows.push(
    { Field_ID: 'F1', Survey_Type_ID: 'T1', Field_Key: 'species', Field_Label: 'ชนิด', Field_Type: 'select', Required: 'TRUE', Options: 'สัก|ยาง', Sort_Order: '1', Is_Active: 'TRUE', Is_Public: 'TRUE' },
    { Field_ID: 'F2', Survey_Type_ID: 'T1', Field_Key: 'owner_phone', Field_Label: 'เบอร์เจ้าของ', Field_Type: 'text', Required: 'FALSE', Options: '', Sort_Order: '2', Is_Active: 'TRUE', Is_Public: 'FALSE' },
    { Field_ID: 'F3', Survey_Type_ID: 'T1', Field_Key: 'bad', Field_Label: 'เสีย', Field_Type: 'select', Required: 'FALSE', Options: '', Sort_Order: '3', Is_Active: 'TRUE', Is_Public: 'TRUE' },
  );
  const warnings: string[] = [];
  const svc = new SurveyService({ tables: tables as Tables, files, editSecret: 'x'.repeat(40), warn: (m) => warnings.push(m) });
  return { svc, tables, files, warnings };
}

export const base = (over: Record<string, unknown> = {}) => ({
  surveyTypeId: 'T1', latitude: 13.75, longitude: 100.5, customFields: { species: 'สัก', owner_phone: '0812345678' }, photos: [] as { name: string; size: number; mime: string }[], ...over,
});
export const m = (n = 1) => Array.from({ length: n }, (_, i) => ({ name: `p${i}.jpg`, size: 100, mime: 'image/jpeg' }));
