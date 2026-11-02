# API
Response: สำเร็จ `{ "ok": true, "data": ... }` / ผิดพลาด `{ "ok": false, "error": { "code", "message", "details?" } }`
Header: `X-Edit-Token` (รหัสแก้ไข), `X-WebGIS-Token`, `Idempotency-Key` (16–64 ตัว `[A-Za-z0-9_-]`) — ไม่ใช้ query string

| Method & Path | Auth | หมายเหตุ |
|---|---|---|
| GET `/api/health`, `/api/health/ready` | – | ready ตรวจ Sheets |
| GET `/api/survey-types` | – | เฉพาะ Is_Active |
| GET `/api/survey-types/:id/form-schema` | – | ฟิลด์ที่ active และถูกต้อง |
| POST `/api/surveys` | Turnstile + Idempotency-Key | body: surveyTypeId, latitude, longitude, gpsAccuracy?, surveyorName?, description?, customFields, photos[{name,size,mime}], turnstileToken → 201 `{surveyId, editCode, status, photos[{photoId}]}`; ส่งซ้ำด้วย key เดิม → 200 ผลเดิม (`replayed:true`) |
| POST `/api/surveys/:id/photos` | X-Edit-Token | multipart: `photoId` (ก่อน) + `file`; ทีละไฟล์, idempotent ต่อ photoId |
| POST `/api/surveys/:id/photos/retry` | X-Edit-Token | รีเซ็ตรูป FAILED → PENDING คืนรายการที่ค้าง |
| GET `/api/surveys/:id/submission-status` | X-Edit-Token | สถานะ/จำนวนรูป |
| POST `/api/surveys/:id/resume` | X-Edit-Token | คำนวณสถานะใหม่ + รายการรูปที่ค้าง |
| GET `/api/surveys/:id/edit` | X-Edit-Token | ข้อมูลสำหรับแก้ไข (ไม่มีรหัส) |
| PATCH `/api/surveys/:id` | X-Edit-Token | แก้ฟิลด์ + addPhotos[] + removePhotoIds[] |
| DELETE `/api/surveys/:id` | X-Edit-Token | Soft Delete |
| GET `/api/webgis/surveys` · `/:id` · `/:id/photos/:photoId` | X-WebGIS-Token | เฉพาะ READY; รูปสตรีมผ่าน Backend |
| GET `/api/export/surveys.csv` · `.geojson` | X-WebGIS-Token | เฉพาะ READY + ฟิลด์ public; Header CSV `cf_<Field_Key>` |

รหัสข้อผิดพลาดหลัก: 400 `IDEMPOTENCY_KEY_REQUIRED`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`/`TURNSTILE_FAILED`, 404, 410 `DELETED`, 413, 415 `UNSUPPORTED_FILE`, 422 `VALIDATION_FAILED`, 429, 502 `UPLOAD_FAILED`/`METADATA_FAILED`
`403 FORBIDDEN` ใช้ข้อความเดียวกันทั้ง "ไม่พบรายการ" และ "รหัสผิด" เพื่อกันการไล่เดา Survey_ID
