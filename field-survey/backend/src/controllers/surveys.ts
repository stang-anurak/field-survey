import type { Request, Response } from 'express';
import type { Config } from '../config/env.ts';
import type { SurveyService } from '../services/surveyService.ts';
import { verifyTurnstile } from '../services/turnstile.ts';
import { AppError } from '../utils/errors.ts';
import { createSchema, idemKeySchema, idParam, patchSchema } from '../validators/schemas.ts';
import { ah } from '../middleware/security.ts';

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ ok: true, data });
const editCode = (req: Request) => String(req.header('X-Edit-Token') ?? '');
const id = (req: Request) => idParam.parse(req.params.id);

function zodFail(error: import('zod').ZodError): never {
  const details: Record<string, string> = {};
  for (const i of error.issues) details[i.path.join('.') || '_'] = i.message;
  throw new AppError(422, 'VALIDATION_FAILED', 'ข้อมูลที่ส่งมาไม่ถูกต้อง', details);
}

export function surveyController(svc: SurveyService, config: Config) {
  return {
    types: ah(async (_req, res) => ok(res, await svc.listTypes())),
    formSchema: ah(async (req, res) => ok(res, await svc.getFormSchema(String(req.params.id).slice(0, 100)))),

    create: ah(async (req, res) => {
      const key = idemKeySchema.safeParse(req.header('Idempotency-Key'));
      if (!key.success) throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'ต้องส่งหัวข้อ Idempotency-Key (16-64 ตัวอักษร a-z A-Z 0-9 _ -)');
      const body = createSchema.safeParse(req.body);
      if (!body.success) zodFail(body.error);
      const { turnstileToken, ...input } = body.data!;
      const replay = await svc.findReplay(key.data); // ตรวจ replay ก่อน เพราะ Turnstile token ใช้ได้ครั้งเดียว
      if (replay) return ok(res, replay, 200);
      if (!(config.turnstileBypass && !config.isProd)) {
        if (!turnstileToken || !config.turnstileSecret || !(await verifyTurnstile(config.turnstileSecret, turnstileToken, req.ip))) {
          throw new AppError(403, 'TURNSTILE_FAILED', 'การยืนยันว่าไม่ใช่บอทไม่สำเร็จ กรุณาลองใหม่');
        }
      }
      ok(res, await svc.create(input, key.data), 201);
    }),

    // โครงสร้าง: requireEdit ตรวจรหัสก่อน multer จึงไม่มีการบัฟเฟอร์ไฟล์จากผู้ที่ไม่มีสิทธิ์
    uploadPhoto: ah(async (req, res) => {
      const photoId = idParam.safeParse(req.body?.photoId);
      if (!photoId.success) throw new AppError(422, 'VALIDATION_FAILED', 'ต้องระบุ photoId');
      if (!req.file) throw new AppError(422, 'VALIDATION_FAILED', 'ไม่พบไฟล์ (ฟิลด์ file)');
      ok(res, await svc.uploadPhoto(id(req), editCode(req), photoId.data, req.file.buffer));
    }),
    submissionStatus: ah(async (req, res) => ok(res, await svc.submissionStatus(id(req), editCode(req)))),
    resume: ah(async (req, res) => ok(res, await svc.resume(id(req), editCode(req)))),
    getForEdit: ah(async (req, res) => ok(res, await svc.getForEdit(id(req), editCode(req)))),
    patch: ah(async (req, res) => {
      const body = patchSchema.safeParse(req.body);
      if (!body.success) zodFail(body.error);
      ok(res, await svc.update(id(req), editCode(req), body.data!));
    }),
    remove: ah(async (req, res) => ok(res, await svc.softDelete(id(req), editCode(req)))),
    retry: ah(async (req, res) => ok(res, await svc.retry(id(req), editCode(req)))),
  };
}
