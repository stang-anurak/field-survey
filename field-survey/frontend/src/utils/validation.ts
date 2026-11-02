import type { CustomValue, FormField } from '../types';

export const MAX_PHOTOS = 5;
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export function validateCoords(lat: string, lng: string): { lat?: number; lng?: number; error?: string } {
  const a = Number(lat), b = Number(lng);
  if (lat.trim() === '' || lng.trim() === '') return { error: 'กรุณาระบุพิกัด (ใช้ GPS ปักหมุดบนแผนที่ หรือกรอกเอง)' };
  if (!Number.isFinite(a) || a < -90 || a > 90) return { error: 'Latitude ต้องเป็นตัวเลขระหว่าง -90 ถึง 90' };
  if (!Number.isFinite(b) || b < -180 || b > 180) return { error: 'Longitude ต้องเป็นตัวเลขระหว่าง -180 ถึง 180' };
  return { lat: a, lng: b };
}

export function validateFields(fields: FormField[], values: Record<string, CustomValue | undefined>): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key];
    const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (f.type === 'checkbox') { if (f.required && v !== true) errs[f.key] = 'ต้องเลือกช่องนี้'; continue; }
    if (empty) { if (f.required) errs[f.key] = 'จำเป็นต้องกรอก'; continue; }
    if (f.type === 'number' && !Number.isFinite(Number(v))) errs[f.key] = 'ต้องเป็นตัวเลข';
  }
  return errs;
}

export function checkImage(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return /heic|heif/i.test(file.type + file.name) ? 'ยังไม่รองรับ HEIC กรุณาตั้งค่ากล้องเป็น JPG/Most Compatible หรือแปลงไฟล์ก่อน' : 'รองรับเฉพาะ JPG, PNG, WebP';
  if (file.size > MAX_BYTES) return 'ไฟล์ใหญ่เกิน 10 MB';
  if (file.size === 0) return 'ไฟล์ว่างเปล่า';
  return null;
}

export const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
export const newIdemKey = () => crypto.randomUUID().replace(/-/g, '') ;
