const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  status: number; code: string; details?: Record<string, string>; network: boolean;
  constructor(status: number, code: string, message: string, details?: Record<string, string>, network = false) {
    super(message); this.status = status; this.code = code; this.details = details; this.network = network;
  }
}

async function parse<T>(res: Response): Promise<T> {
  let body: any = null;
  try { body = await res.json(); } catch { /* ไม่ใช่ JSON */ }
  if (!res.ok || !body?.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'HTTP_' + res.status, e?.message ?? 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', e?.details);
  }
  return body.data as T;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) throw new ApiError(0, 'NO_API_URL', 'ยังไม่ได้ตั้งค่า VITE_API_BASE_URL', undefined, true);
  try {
    return await parse<T>(await fetch(BASE + path, init));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'NETWORK', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่ (เซิร์ฟเวอร์ฟรีอาจต้องใช้เวลาปลุกประมาณ 1 นาที)', undefined, true);
  }
}

const json = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit =>
  ({ method, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const edit = (code: string) => ({ 'X-Edit-Token': code });

export const api = {
  types: () => call<import('../types').SurveyType[]>('/api/survey-types'),
  formSchema: (id: string) => call<{ type: { id: string; name: string }; fields: import('../types').FormField[] }>(`/api/survey-types/${encodeURIComponent(id)}/form-schema`),
  create: (body: unknown, idemKey: string) => call<{ surveyId: string; editCode: string; status: string; photos: { photoId: string }[]; replayed: boolean }>('/api/surveys', json('POST', body, { 'Idempotency-Key': idemKey })),
  getForEdit: (id: string, code: string) => call<import('../types').OwnerView>(`/api/surveys/${id}/edit`, { headers: edit(code) }),
  resume: (id: string, code: string) => call<import('../types').OwnerView>(`/api/surveys/${id}/resume`, { method: 'POST', headers: edit(code) }),
  retry: (id: string, code: string) => call<import('../types').OwnerView>(`/api/surveys/${id}/photos/retry`, { method: 'POST', headers: edit(code) }),
  patch: (id: string, code: string, body: unknown) => call<import('../types').OwnerView>(`/api/surveys/${id}`, json('PATCH', body, edit(code))),
  remove: (id: string, code: string) => call<{ status: string }>(`/api/surveys/${id}`, { method: 'DELETE', headers: edit(code) }),
  status: (id: string, code: string) => call<{ status: string; expectedPhotoCount: number; uploadedPhotoCount: number }>(`/api/surveys/${id}/submission-status`, { headers: edit(code) }),

  /** อัปโหลดทีละไฟล์ด้วย XHR เพื่อรายงานความคืบหน้า */
  uploadPhoto(id: string, code: string, photoId: string, file: File, onProgress: (pct: number) => void) {
    return new Promise<{ surveyStatus: string }>((resolve, reject) => {
      if (!BASE) return reject(new ApiError(0, 'NO_API_URL', 'ยังไม่ได้ตั้งค่า VITE_API_BASE_URL', undefined, true));
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/api/surveys/${id}/photos`);
      xhr.setRequestHeader('X-Edit-Token', code);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onerror = () => reject(new ApiError(0, 'NETWORK', 'อัปโหลดไม่สำเร็จ (เครือข่ายขัดข้อง)', undefined, true));
      xhr.ontimeout = xhr.onerror;
      xhr.timeout = 120_000;
      xhr.onload = () => {
        try {
          const b = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && b.ok) return resolve(b.data);
          reject(new ApiError(xhr.status, b?.error?.code ?? 'UPLOAD', b?.error?.message ?? 'อัปโหลดไม่สำเร็จ', b?.error?.details));
        } catch { reject(new ApiError(xhr.status, 'UPLOAD', 'อัปโหลดไม่สำเร็จ')); }
      };
      const fd = new FormData();
      fd.append('photoId', photoId); // ต้องมาก่อนไฟล์
      fd.append('file', file);
      xhr.send(fd);
    });
  },

  // WebGIS: token ส่งทาง Header เท่านั้น
  webgisList: (token: string) => call<import('../types').PublicSurvey[]>('/api/webgis/surveys', { headers: { 'X-WebGIS-Token': token } }),
  webgisDetail: (token: string, id: string) => call<import('../types').PublicSurvey>(`/api/webgis/surveys/${id}`, { headers: { 'X-WebGIS-Token': token } }),
  async webgisPhotoBlob(token: string, id: string, photoId: string): Promise<Blob> {
    const res = await fetch(`${BASE}/api/webgis/surveys/${id}/photos/${photoId}`, { headers: { 'X-WebGIS-Token': token } });
    if (!res.ok) throw new ApiError(res.status, 'PHOTO', 'โหลดรูปไม่สำเร็จ');
    return res.blob();
  },
  async download(token: string, path: string, filename: string) {
    const res = await fetch(BASE + path, { headers: { 'X-WebGIS-Token': token } });
    if (!res.ok) throw new ApiError(res.status, 'EXPORT', 'ส่งออกข้อมูลไม่สำเร็จ');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
};
