import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import multer from 'multer';
import type { Config } from './config/env.ts';
import { limits } from './middleware/security.ts';
import { buildRouter } from './routes/index.ts';
import type { SurveyService } from './services/surveyService.ts';
import { AppError } from './utils/errors.ts';

export function createApp(svc: SurveyService, config: Config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Render อยู่หลัง Proxy หนึ่งชั้น
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || config.allowedOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Edit-Token', 'X-WebGIS-Token', 'Idempotency-Key'],
    maxAge: 600,
  }));
  app.use(limits.global);
  app.use((req, res, next) => { // log เฉพาะ method/path/status (ไม่มี query, header, body)
    const t = Date.now();
    res.on('finish', () => console.log(JSON.stringify({ m: req.method, p: req.path.replace(/\/photos\/[^/]+$/, '/photos/:id'), s: res.statusCode, ms: Date.now() - t })));
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', buildRouter(svc, config));
  app.use((_req, res) => { res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'ไม่พบเส้นทางนี้' } }); });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const send = (status: number, code: string, message: string, details?: unknown) =>
      res.status(status).json({ ok: false, error: { code, message, ...(details ? { details } : {}) } });
    if (err instanceof AppError) return send(err.status, err.code, err.message, err.details);
    if (err instanceof multer.MulterError) return send(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'BAD_UPLOAD', err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 10 MB' : 'คำขออัปโหลดไม่ถูกต้อง');
    const type = (err as { type?: string })?.type;
    if (type === 'entity.too.large') return send(413, 'REQUEST_TOO_LARGE', 'คำขอมีขนาดใหญ่เกินกำหนด');
    if (type === 'entity.parse.failed') return send(400, 'BAD_JSON', 'รูปแบบ JSON ไม่ถูกต้อง');
    console.error(JSON.stringify({ level: 'error', name: (err as Error)?.name, message: String((err as Error)?.message ?? '').slice(0, 300) }));
    send(500, 'INTERNAL_ERROR', 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้งภายหลัง');
  });
  return app;
}
