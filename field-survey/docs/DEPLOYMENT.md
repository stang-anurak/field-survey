# DEPLOYMENT

## Render (Backend)
- Web Service จาก repo นี้ (`render.yaml` เตรียมไว้) rootDir=`backend`, Build `npm ci && npm run build`, Start `npm start`, Health check `/api/health`
- **Instance เดียวเท่านั้น** (คิวเขียน/Idempotency อาศัย in-process lock)
- Environment (Secret ทั้งหมดตั้งในหน้า Render ไม่ใส่ใน Git): `NODE_ENV=production`, `ALLOWED_ORIGINS=https://USER.github.io` (เฉพาะ origin ไม่มี path/ท้าย /), `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `SPREADSHEET_ID`, `DRIVE_FOLDER_ID`, (`GOOGLE_OAUTH_*`), `EDIT_TOKEN_SECRET` (>=32 ตัวอักษร), `WEBGIS_TOKEN_HASHES`, `TURNSTILE_SECRET_KEY`, `PUBLIC_SURVEYOR_NAME`
- ข้อจำกัดแผนฟรี: instance หลับเมื่อไม่ใช้งาน (ตื่นช้า ~1 นาที), RAM จำกัด (อัปโหลด 10MB/คำขอถูกบัฟเฟอร์ในหน่วยความจำ จึงส่งทีละรูป), ห้ามเก็บข้อมูลบน Disk (ไม่มีการใช้ Disk)
- CORS: อนุญาตเฉพาะ origin ใน `ALLOWED_ORIGINS` (CORS ไม่ใช่การพิสูจน์ตัวตน)

## GitHub Pages (Frontend)
1. Settings → Pages → Source: GitHub Actions
2. Settings → Secrets and variables → Actions → **Variables**: `VITE_API_BASE_URL` (URL Render), `VITE_TURNSTILE_SITE_KEY` (ค่าเหล่านี้เป็นสาธารณะ ไม่ใช่ Secret)
3. push ไป `main` → workflow `deploy-frontend.yml` build และ deploy
- ใช้ HashRouter และ `base: './'` จึง Refresh หน้าย่อยไม่ 404 และใช้ได้กับ path `/<repo>/`
- ลิงก์ WebGIS: `https://USER.github.io/REPO/#/map?t=<TOKEN>` (token อยู่หลัง `#` ไม่ถูกส่งไปเซิร์ฟเวอร์/Referer และถูกลบออกจากแถบที่อยู่หลังโหลด)

## Tile / โควตา / เงื่อนไข
- OpenStreetMap: ใช้ `tile.openstreetmap.org` ตาม Tile Usage Policy (ไม่เหมาะกับทราฟฟิกสูง; ต้องมี Attribution) ถ้าใช้หนัก ให้ใช้ผู้ให้บริการ Tile เชิงพาณิชย์
- Esri World Imagery: ต้องแสดง Attribution และปฏิบัติตามข้อกำหนดการใช้งานของ Esri/ArcGIS (ตรวจสอบเงื่อนไขและโควตาปัจจุบันก่อนใช้เชิงพาณิชย์)
- Google Sheets API มีโควตาต่อนาที ระบบแคชการอ่าน 5 วินาที และ WebGIS poll ทุก 30 วินาที

## Retention / สำรองข้อมูล
ตั้งสำเนาสำรอง Spreadsheet เป็นระยะ (File → Make a copy / Apps Script) และสำรองโฟลเดอร์ Drive; รายการที่ลบเป็น Soft Delete และไฟล์ Drive ไม่ถูกลบอัตโนมัติ
