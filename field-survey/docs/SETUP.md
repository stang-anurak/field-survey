# SETUP (พัฒนาในเครื่อง)

ต้องมี Node.js >= 22.18

```bash
cd backend && npm install
cp .env.example .env        # กรอกค่า (ดู GOOGLE_SETUP.md) — ห้าม commit
npm test                    # ทดสอบตรรกะหลักด้วย in-memory (ไม่ต้องใช้ Google)
npm run setup:sheets -- --seed   # สร้างชีต/Header (+ข้อมูลตัวอย่าง)
npm run token:generate      # สร้าง WebGIS token + hash
npm run dev                 # http://localhost:3000/api/health

cd ../frontend && npm install
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:3000
npm run dev
```
ในเครื่องตั้ง `ALLOWED_ORIGINS=http://localhost:5173`, `NODE_ENV=development`, `TURNSTILE_BYPASS=true` ได้ (ใช้ได้เฉพาะนอก production) หรือใช้ Turnstile test keys ของ Cloudflare
GPS ในเบราว์เซอร์ใช้ได้บน `localhost` และ HTTPS เท่านั้น
