# TESTING — สิ่งที่ทดสอบจริงและสิ่งที่ยังไม่ได้ทดสอบ

## ✅ ทดสอบจริงแล้ว (รันใน sandbox: `cd backend && npm test`, 15/15 ผ่าน)
ทดสอบ `SurveyService` กับ **ตารางและที่เก็บไฟล์จำลองในหน่วยความจำ** (ไม่ใช่ Google จริง):
- W1 ส่งโดยไม่มีรูป → READY และขึ้น WebGIS; ผลลัพธ์ WebGIS ไม่มีรหัสแก้ไข/hash/ฟิลด์ที่ไม่ public
- W2 รูป 3 ใบ → ซ่อนจนครบทั้งหมด
- W3/W4 อัปโหลดล้มเหลว → UPLOAD_FAILED ไม่ขึ้นแผนที่; retry ใช้ Survey_ID เดิมแล้ว READY
- W5 ส่งซ้ำ/ส่งพร้อมกันด้วย Idempotency-Key เดิม → ไม่มีรายการ/แถวรูปซ้ำ ได้รหัสเดิม
- ไฟล์อัปโหลดสำเร็จแต่บันทึก Metadata ล้มเหลว → retry ไม่สร้างไฟล์ซ้ำ; อัปโหลดรูปเดิมซ้ำไม่เรียก Drive ซ้ำ
- W6–W8 แก้ไขด้วยรหัสถูก; รหัสผิด/รหัสรายการอื่น/ไม่มีรหัส/รายการที่ไม่มีอยู่ → 403
- Soft Delete → หายจากแผนที่, แถวยังอยู่, ดำเนินการต่อ 410
- Validation ฝั่ง Server (ฟิลด์บังคับ, ตัวเลือก, พิกัด, >5 รูป, HEIC, ประเภทงานไม่มี); ไฟล์ปลอมถูกปฏิเสธด้วยลายเซ็นไฟล์
- แก้ไข READY โดยเพิ่มรูป → กลับไป PENDING_UPLOAD และซ่อนจนครบ
- ตั้งค่าฟิลด์ผิดถูกข้าม + เตือน; รูปของรายการที่ยังไม่ READY/ของรายการอื่นอ่านไม่ได้
- CSV Formula Injection + BOM, การ derive/normalize รหัสแก้ไข, magic bytes, Export เฉพาะ READY + public

## ⚠ ยังไม่ได้ทดสอบ/ยังไม่ได้ยืนยัน (sandbox ไม่มีเครือข่าย ติดตั้ง npm ไม่ได้)
- **ยังไม่เคยคอมไพล์ด้วย `tsc` และยังไม่เคย build Vite**: โค้ด Express/googleapis/multer/zod และทั้ง Frontend (React/Leaflet) เขียนแล้วแต่ **ไม่เคยรัน** — คาดว่าจะมี type error เล็กน้อยที่ต้องแก้ตอน `npm run typecheck` / `npm run build` ครั้งแรก
- ไม่ได้ทดสอบกับ Google Sheets/Drive จริง (SheetsTable, DriveFileStore, setup-sheets) รวมถึงปัญหาโควตา Service Account ใน My Drive (ดู GOOGLE_SETUP.md)
- ไม่ได้ทดสอบ HTTP layer: CORS, Rate Limiting, ตรวจ X-WebGIS-Token (W9), Turnstile siteverify, ขนาด Request/ไฟล์ผ่าน multer, การสตรีมรูป
- ไม่ได้ทดสอบ UI บนมือถือ/เบราว์เซอร์จริง, GPS, Leaflet, การ Export เปิดใน Excel ภาษาไทย (BOM ใส่แล้วแต่ยังไม่ทดสอบ), Deploy GitHub Pages/Render
- ยังไม่ได้ตรวจ Bundle Frontend ว่าไม่มี Secret (W13) — โค้ดไม่อ้างอิง Secret ใดและสแกนซอร์สไม่พบคีย์ แต่ต้องตรวจ `dist/` หลัง build
- ไม่มี Test อัตโนมัติสำหรับ Frontend

## Checklist ให้ผู้ใช้ทดสอบหลังตั้งค่าบัญชีจริง
1. `npm run typecheck`, `npm run build` (backend และ frontend) ผ่าน
2. `/api/health` และ `/api/health/ready` = ok บน Render
3. ส่งแบบฟอร์มไม่มีรูป → ขึ้นบนแผนที่ภายใน ~30 วินาที
4. ส่งพร้อม 3 รูป; ตัดเน็ตระหว่างอัปโหลด → ไม่ขึ้นแผนที่; เปิด “แก้ไข/ส่งต่อ” ใส่รหัส แล้วส่งรูปที่ค้าง → ขึ้นแผนที่
5. รหัสผิด 11 ครั้ง → 429; `curl` WebGIS API ไม่มี/ผิด token → 401
6. เปิดไฟล์ใน Drive แบบไม่ล็อกอิน → เข้าไม่ได้
7. Export CSV เปิดใน Excel (ไทย) และ GeoJSON เปิดใน QGIS; ตรวจว่าไม่มี Edit_Token/hash
8. `grep -r "private_key" frontend/dist` ต้องไม่พบ
9. ตรวจ Origin อื่นเรียก API จากเบราว์เซอร์ ต้องถูกบล็อกโดย CORS
