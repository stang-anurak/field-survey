import type { FieldDef, FieldType, Row } from '../types/index.ts';

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const RESERVED = new Set(['survey_id', 'latitude', 'longitude', 'description', 'status', 'type', 'type_id', 'type_name', 'created_at', 'photo_count', 'surveyor_name']);
const TYPES: Record<string, FieldType> = {
  text: 'text', textarea: 'textarea', number: 'number', date: 'date',
  select: 'select', multiselect: 'multiselect', checkbox: 'checkbox', boolean: 'checkbox',
};

export const truthy = (v?: string): boolean => /^(true|1|yes|y|ใช่)$/i.test((v ?? '').trim());
export const sortNum = (v?: string): number => { const n = Number(v); return Number.isFinite(n) ? n : 1e9; };
export const bySort = (a: Row, b: Row): number => sortNum(a.Sort_Order) - sortNum(b.Sort_Order);

export function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  for (const o of String(raw ?? '').split(/[|\n]/)) {
    const t = o.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

/** แปลงแถวใน FormFields เป็นนิยามฟิลด์ ข้ามแถวที่ตั้งค่าผิดพร้อมรายงานปัญหา (ไม่ทำให้ระบบล่ม/ข้อมูลเดิมไม่เสียหาย) */
export function parseFormFields(rows: Row[], typeId: string): { fields: FieldDef[]; problems: string[] } {
  const problems: string[] = [];
  const fields: FieldDef[] = [];
  const keys = new Set<string>();
  const mine = rows.filter((r) => r.Survey_Type_ID === typeId && truthy(r.Is_Active)).sort(bySort);
  for (const r of mine) {
    const where = `FormFields Field_ID=${r.Field_ID || '(blank)'}`;
    const key = (r.Field_Key ?? '').trim();
    const type = TYPES[(r.Field_Type ?? '').trim().toLowerCase()];
    const options = parseOptions(r.Options ?? '');
    if (!r.Field_ID) { problems.push(`${where}: Field_ID ว่าง`); continue; }
    if (!KEY_RE.test(key) || RESERVED.has(key)) { problems.push(`${where}: Field_Key ไม่ถูกต้องหรือเป็นคำสงวน`); continue; }
    if (keys.has(key)) { problems.push(`${where}: Field_Key ซ้ำ`); continue; }
    if (!type) { problems.push(`${where}: Field_Type ไม่รองรับ`); continue; }
    if (!(r.Field_Label ?? '').trim()) { problems.push(`${where}: Field_Label ว่าง`); continue; }
    if ((type === 'select' || type === 'multiselect') && (options.length === 0 || options.length > 50)) { problems.push(`${where}: Options ต้องมี 1-50 ค่า`); continue; }
    keys.add(key);
    fields.push({
      id: r.Field_ID, key, label: r.Field_Label.trim().slice(0, 200), type,
      required: truthy(r.Required), options: type === 'select' || type === 'multiselect' ? options : [],
      placeholder: (r.Placeholder ?? '').slice(0, 200), helpText: (r.Help_Text ?? '').slice(0, 500),
      isPublic: truthy(r.Is_Public),
    });
  }
  return { fields, problems };
}

export type CustomValue = string | number | boolean | string[];

export function validateCustomFields(fields: FieldDef[], input: unknown): { values: Record<string, CustomValue>; errors: Record<string, string> } {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const values: Record<string, CustomValue> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const raw = src[f.key];
    if (f.type === 'checkbox') {
      const v = raw === true || raw === 'true';
      if (f.required && !v) errors[f.key] = 'ต้องเลือกช่องนี้';
      values[f.key] = v;
      continue;
    }
    const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
    if (empty) { if (f.required) errors[f.key] = 'จำเป็นต้องกรอก'; continue; }
    switch (f.type) {
      case 'text':
      case 'textarea': {
        const max = f.type === 'text' ? 200 : 2000;
        if (typeof raw !== 'string') errors[f.key] = 'ต้องเป็นข้อความ';
        else if (raw.length > max) errors[f.key] = `ยาวเกิน ${max} ตัวอักษร`;
        else values[f.key] = raw.trim();
        break;
      }
      case 'number': {
        const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
        if (!Number.isFinite(n)) errors[f.key] = 'ต้องเป็นตัวเลข'; else values[f.key] = n;
        break;
      }
      case 'date': {
        if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) errors[f.key] = 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD';
        else values[f.key] = raw;
        break;
      }
      case 'select': {
        if (typeof raw !== 'string' || !f.options.includes(raw)) errors[f.key] = 'ตัวเลือกไม่ถูกต้อง'; else values[f.key] = raw;
        break;
      }
      case 'multiselect': {
        if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string' || !f.options.includes(x))) errors[f.key] = 'ตัวเลือกไม่ถูกต้อง';
        else values[f.key] = [...new Set(raw as string[])];
        break;
      }
    }
  }
  return { values, errors };
}
