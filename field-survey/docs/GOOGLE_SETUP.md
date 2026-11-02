# GOOGLE_SETUP

1. สร้าง Google Cloud Project → เปิด **Google Sheets API** และ **Google Drive API**
2. IAM → Service Accounts → สร้างบัญชี → Keys → สร้าง JSON key (เก็บเป็นความลับ, ห้ามลง Git)
3. แปลงเป็น base64 บรรทัดเดียวแล้วใส่ใน `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`: `base64 -w0 key.json` (macOS: `base64 -i key.json`)
4. สร้าง Google Spreadsheet ว่าง → แชร์ให้อีเมลของ Service Account สิทธิ์ **Editor** → ค่าจาก URL `/d/<ID>/` คือ `SPREADSHEET_ID`
5. รัน `npm run setup:sheets -- --seed` เพื่อสร้างชีตและ Header

## Drive (ข้อควรระวังสำคัญ)
Service Account **ไม่มีโควตาพื้นที่เก็บข้อมูลของตัวเอง** การอัปโหลดไฟล์ลง "My Drive" ส่วนตัวผ่าน Service Account มักล้มเหลวด้วย `storageQuotaExceeded` ทางเลือก:
- **A (แนะนำถ้ามี Google Workspace):** สร้าง **Shared Drive** แล้วเพิ่ม Service Account เป็น Content manager; `DRIVE_FOLDER_ID` = โฟลเดอร์ใน Shared Drive (โค้ดส่ง `supportsAllDrives` แล้ว)
- **B (บัญชี Gmail ทั่วไป):** สร้าง OAuth Client (Desktop/Web) ขอ refresh token ด้วยบัญชีเจ้าของโฟลเดอร์ scope `https://www.googleapis.com/auth/drive` แล้วตั้ง `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` (Drive จะใช้บัญชีนั้น ส่วน Sheets ยังใช้ Service Account) — ยังไม่ได้ทดสอบกับบัญชีจริง
ห้ามแชร์โฟลเดอร์แบบ "ทุกคนที่มีลิงก์" ระบบไม่ได้ตั้งสิทธิ์ Public ให้ไฟล์ใด ๆ

## ตรวจสิทธิ์ว่าไม่เปิดสาธารณะ
เปิดไฟล์ในโฟลเดอร์ด้วยหน้าต่างไม่ล็อกอิน ต้องเข้าไม่ได้

## Cloudflare Turnstile
Dashboard → Turnstile → Add widget (Managed) ใส่โดเมน `USER.github.io` → **Site key** ใส่ GitHub variable `VITE_TURNSTILE_SITE_KEY` / **Secret key** ใส่ Render `TURNSTILE_SECRET_KEY`
