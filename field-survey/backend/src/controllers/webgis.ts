import type { Response } from 'express';
import type { SurveyService } from '../services/surveyService.ts';
import { AppError } from '../utils/errors.ts';
import { idParam } from '../validators/schemas.ts';
import { toCsv } from '../utils/csv.ts';
import { ah } from '../middleware/security.ts';

const ok = (res: Response, data: unknown) => res.json({ ok: true, data });
const noStore = (res: Response) => res.setHeader('Cache-Control', 'private, no-cache');

export function webgisController(svc: SurveyService, includeSurveyor: boolean) {
  return {
    list: ah(async (_req, res) => { noStore(res); ok(res, await svc.webgisList()); }),
    detail: ah(async (req, res) => { noStore(res); ok(res, await svc.webgisDetail(idParam.parse(req.params.id))); }),
    photo: ah(async (req, res) => {
      const p = await svc.webgisPhoto(idParam.parse(req.params.id), idParam.parse(req.params.photoId));
      let stream;
      try { stream = await p.stream(); } catch { throw new AppError(404, 'PHOTO_UNAVAILABLE', 'ไม่สามารถอ่านรูปนี้ได้ (ไฟล์อาจถูกย้ายหรือลบ)'); }
      res.setHeader('Content-Type', p.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, max-age=300');
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    }),
    csv: ah(async (_req, res) => {
      const { items, keys } = await svc.exportData();
      const headers = ['survey_id', 'type_id', 'type_name', 'latitude', 'longitude', 'description', ...(includeSurveyor ? ['surveyor_name'] : []), 'created_at', 'photo_count', ...keys.map((k) => `cf_${k}`)];
      const rows = items.map((i) => [i.surveyId, i.typeId, i.typeName, i.latitude, i.longitude, i.description, ...(includeSurveyor ? [(i as { surveyorName?: string }).surveyorName ?? ''] : []), i.createdAt, i.photoCount,
        ...keys.map((k) => i.customFields.find((f) => f.key === k)?.value ?? null)]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="surveys.csv"');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(toCsv(headers, rows));
    }),
    geojson: ah(async (_req, res) => {
      const { items } = await svc.exportData();
      const features = items.map((i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [i.longitude, i.latitude] }, // [lng, lat]
        properties: {
          survey_id: i.surveyId, type_id: i.typeId, type_name: i.typeName, description: i.description,
          ...(includeSurveyor ? { surveyor_name: (i as { surveyorName?: string }).surveyorName ?? '' } : {}),
          created_at: i.createdAt, photo_count: i.photoCount,
          ...Object.fromEntries(i.customFields.map((f) => [`cf_${f.key}`, f.value])),
        },
      }));
      res.setHeader('Content-Type', 'application/geo+json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="surveys.geojson"');
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(JSON.stringify({ type: 'FeatureCollection', features }));
    }),
  };
}
