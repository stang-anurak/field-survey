import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // ไม่มี I L O U

export function base32(bytes: Uint8Array, length: number): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.slice(0, length);
}

export const newId = (prefix: string, len = 10): string =>
  `${prefix}-${base32(randomBytes(Math.ceil((len * 5) / 8) + 1), len)}`;

export const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

export function normalizeEditCode(input: string): string {
  return String(input ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

/** รหัสแก้ไข 100 บิต รูปแบบ XXXXX-XXXXX-XXXXX-XXXXX derive จาก HMAC(secret, surveyId|idempotencyKey)
 *  ทำให้ replay ด้วย Idempotency-Key เดิมได้รหัสเดิม โดยไม่ต้องเก็บรหัสจริง */
export function deriveEditCode(secret: string, surveyId: string, idemKey: string): string {
  const mac = createHmac('sha256', secret).update(`${surveyId}|${idemKey}`).digest();
  return base32(mac, 20).match(/.{5}/g)!.join('-');
}

export const hashEditCode = (code: string): string => sha256Hex(normalizeEditCode(code));

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const A = Buffer.from(a, 'hex');
  const B = Buffer.from(b, 'hex');
  return A.length === B.length && A.length > 0 && timingSafeEqual(A, B);
}
