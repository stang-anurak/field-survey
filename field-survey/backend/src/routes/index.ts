import { Router } from 'express';
import multer from 'multer';
import type { Config } from '../config/env.ts';
import type { SurveyService } from '../services/surveyService.ts';
import { MAX_BYTES } from '../services/surveyService.ts';
import { surveyController } from '../controllers/surveys.ts';
import { webgisController } from '../controllers/webgis.ts';
import { ah, limits, requireEdit, requireWebgis } from '../middleware/security.ts';

export function buildRouter(svc: SurveyService, config: Config): Router {
  const r = Router();
  const s = surveyController(svc, config);
  const w = webgisController(svc, config.publicSurveyorName);
  const edit = requireEdit(svc);
  const webgis = requireWebgis(config.webgisTokenHashes);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 4, parts: 6 } });

  r.get('/health', (_req, res) => { res.json({ ok: true, data: { status: 'ok' } }); });
  r.get('/health/ready', limits.health, ah(async (_req, res) => {
    try { await svc.listTypes(); res.json({ ok: true, data: { sheets: 'ok' } }); }
    catch { res.status(503).json({ ok: false, error: { code: 'NOT_READY', message: 'เชื่อมต่อ Google Sheets ไม่ได้' } }); }
  }));

  // ผู้สำรวจ (Public Form)
  r.get('/survey-types', limits.webgis, s.types);
  r.get('/survey-types/:id/form-schema', limits.webgis, s.formSchema);
  r.post('/surveys', limits.create, s.create);
  r.post('/surveys/:id/photos/retry', limits.ownerRead, edit, s.retry);
  r.post('/surveys/:id/photos', limits.photos, edit, upload.single('file'), s.uploadPhoto);
  r.get('/surveys/:id/submission-status', limits.ownerRead, edit, s.submissionStatus);
  r.post('/surveys/:id/resume', limits.ownerRead, edit, s.resume);
  r.get('/surveys/:id/edit', limits.ownerRead, edit, s.getForEdit);
  r.patch('/surveys/:id', limits.ownerRead, edit, s.patch);
  r.delete('/surveys/:id', limits.ownerRead, edit, s.remove);

  // WebGIS (ต้องมี X-WebGIS-Token ทุกคำขอ)
  r.get('/webgis/surveys', limits.webgis, webgis, w.list);
  r.get('/webgis/surveys/:id', limits.webgis, webgis, w.detail);
  r.get('/webgis/surveys/:id/photos/:photoId', limits.webgis, webgis, w.photo);
  r.get('/export/surveys.csv', limits.exports, webgis, w.csv);
  r.get('/export/surveys.geojson', limits.exports, webgis, w.geojson);
  return r;
}
