import { api, ApiError } from '../services/api';
import type { Picked } from '../components/Photos';

/** อัปโหลดทีละรูปตามลำดับ (กันโควตา Sheets/หน่วยความจำ Server) คืนจำนวนที่ล้มเหลว */
export async function uploadAll(surveyId: string, code: string, items: Picked[], set: (key: string, patch: Partial<Picked>) => void): Promise<number> {
  let failed = 0;
  for (const it of items) {
    if (it.state === 'UPLOADED' || !it.photoId) continue;
    set(it.key, { state: 'UPLOADING', progress: 0, error: undefined });
    try {
      await api.uploadPhoto(surveyId, code, it.photoId, it.file, (pct) => set(it.key, { progress: pct }));
      set(it.key, { state: 'UPLOADED', progress: 100 });
    } catch (e) {
      failed++;
      set(it.key, { state: 'FAILED', error: e instanceof ApiError ? e.message : 'อัปโหลดไม่สำเร็จ' });
    }
  }
  return failed;
}
