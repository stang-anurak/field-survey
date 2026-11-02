import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.ts';
import { safeEqualHex, sha256Hex } from '../utils/ids.ts';
import type { SurveyService } from '../services/surveyService.ts';
import { idParam } from '../validators/schemas.ts';

export const ah = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };

const limiter = (windowMs: number, limit: number, code = 'RATE_LIMITED') => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_req, res) => { res.status(429).json({ ok: false, error: { code, message: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่' } }); },
});
export const limits = {
  global: limiter(15 * 60_000, 600),
  create: limiter(60 * 60_000, 20),
  photos: limiter(60 * 60_000, 150),
  ownerRead: limiter(15 * 60_000, 120),
  webgis: limiter(60_000, 120),
  exports: limiter(60_000, 10),
  health: limiter(60_000, 30),
};

// ตัวนับความพยายามที่ล้มเหลว (in-memory, ต่อ IP และต่อรายการ) เพื่อกันการเดารหัส
const fails = new Map<string, { n: number; reset: number }>();
const WINDOW = 15 * 60_000;
function blocked(key: string, max: number): boolean {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() > f.reset) { fails.delete(key); return false; }
  return f.n >= max;
}
function record(key: string): void {
  const f = fails.get(key);
  if (!f || Date.now() > f.reset) fails.set(key, { n: 1, reset: Date.now() + WINDOW });
  else f.n++;
  if (fails.size > 50_000) for (const [k, v] of fails) if (Date.now() > v.reset) fails.delete(k);
}

/** ตรวจ X-Edit-Token ก่อนรับไฟล์/แก้ไขใด ๆ (ไม่ใช้ query string) */
export const requireEdit = (svc: SurveyService): RequestHandler => ah(async (req, _res, next) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) throw new AppError(403, 'FORBIDDEN', 'ไม่พบรายการ หรือรหัสแก้ไขไม่ถูกต้อง');
  const ipKey = `ip:${req.ip}`; const sKey = `s:${id.data}`;
  if (blocked(ipKey, 10) || blocked(sKey, 30)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'ลองรหัสผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  try {
    await svc.authenticate(id.data, String(req.header('X-Edit-Token') ?? ''), true);
  } catch (e) {
    if (e instanceof AppError && e.status === 403) { record(ipKey); record(sKey); }
    throw e;
  }
  next();
});

export const requireWebgis = (hashes: string[]): RequestHandler => ah(async (req, _res, next) => {
  const ipKey = `wg:${req.ip}`;
  if (blocked(ipKey, 20)) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'ลองใหม่ภายหลัง');
  const token = String(req.header('X-WebGIS-Token') ?? '');
  const given = sha256Hex(token);
  let ok = false;
  for (const h of hashes) if (safeEqualHex(h, given)) ok = true; // วนครบทุกค่าเพื่อลด timing leak
  if (!token || !ok) { record(ipKey); throw new AppError(401, 'UNAUTHORIZED', 'ลิงก์หรือ token ไม่ถูกต้อง'); }
  next();
});
