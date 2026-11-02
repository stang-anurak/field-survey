const DANGEROUS = /^[=+\-@\t\r]/;

/** ตัวเลขเขียนตรง ๆ, ข้อความขึ้นต้นด้วย = + - @ TAB CR จะถูกนำหน้าด้วย ' เพื่อกัน CSV Formula Injection */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  let s = Array.isArray(v) ? v.join('; ') : String(v);
  if (DANGEROUS.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map((h) => csvCell(h)).join(','), ...rows.map((r) => r.map(csvCell).join(','))];
  return '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM ให้ Excel อ่าน UTF-8/ภาษาไทยถูกต้อง
}
