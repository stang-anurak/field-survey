import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  ALLOWED_ORIGINS: z.string().min(1, 'ต้องกำหนด ALLOWED_ORIGINS'),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().min(1),
  SPREADSHEET_ID: z.string().min(1),
  DRIVE_FOLDER_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  EDIT_TOKEN_SECRET: z.string().min(32, 'EDIT_TOKEN_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร'),
  WEBGIS_TOKEN_HASHES: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_BYPASS: z.enum(['true', 'false']).default('false'),
  PUBLIC_SURVEYOR_NAME: z.enum(['true', 'false']).default('false'),
});

export interface Config {
  isProd: boolean;
  port: number;
  allowedOrigins: string[];
  webgisTokenHashes: string[];
  turnstileSecret?: string;
  turnstileBypass: boolean;
  publicSurveyorName: boolean;
}

export function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // แสดงเฉพาะชื่อตัวแปรที่มีปัญหา ไม่พิมพ์ค่า
    const names = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Environment ไม่ครบหรือไม่ถูกต้อง:\n  ${names}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';
  if (isProd && !e.TURNSTILE_SECRET_KEY) throw new Error('Production ต้องตั้ง TURNSTILE_SECRET_KEY');
  if (isProd && e.TURNSTILE_BYPASS === 'true') throw new Error('ห้ามเปิด TURNSTILE_BYPASS ใน production');
  const hashes = e.WEBGIS_TOKEN_HASHES.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!hashes.length || hashes.some((h) => !/^[0-9a-f]{64}$/.test(h))) throw new Error('WEBGIS_TOKEN_HASHES ต้องเป็น sha256 hex 64 ตัวอักษร (คั่นด้วยคอมมา)');
  const config: Config = {
    isProd, port: e.PORT,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
    webgisTokenHashes: hashes, turnstileSecret: e.TURNSTILE_SECRET_KEY, turnstileBypass: e.TURNSTILE_BYPASS === 'true',
    publicSurveyorName: e.PUBLIC_SURVEYOR_NAME === 'true',
  };
  return { env: e, config };
}
