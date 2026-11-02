# SECURITY
- **รหัสแก้ไข**: สุ่ม 100 บิต (`XXXXX-XXXXX-XXXXX-XXXXX`) derive ด้วย HMAC(`EDIT_TOKEN_SECRET`, SurveyID|Idempotency-Key); เก็บเฉพาะ SHA-256 ใน Sheets; เทียบแบบ constant-time; จำกัดการลองผิด (10 ครั้ง/15 นาที/IP และ 30 ครั้ง/15 นาที/รายการ, in-memory)
  - ผลข้างเคียง: ผู้ที่มี Idempotency-Key เดิมจะได้รหัสเดิมเมื่อ replay (คีย์สุ่มต่อการส่ง อยู่ในหน่วยความจำของ Browser) และ **เปลี่ยน `EDIT_TOKEN_SECRET` แล้วรหัสของรายการเดิมยังใช้ได้ (เก็บ hash ไว้) แต่ replay จะได้รหัสใหม่ที่ไม่ตรง**
  - รหัสหาย: กู้ไม่ได้ ผู้ดูแลต้องตรวจสอบตัวตนนอกระบบแล้วจัดการในชีตเอง (เช่น ลบ/ตั้ง Status=DELETED หรือให้ส่งใหม่) ห้ามออกรหัสให้ผู้ที่พิสูจน์ความเป็นเจ้าของไม่ได้
- **WebGIS token**: สร้างด้วย `npm run token:generate` (256 บิต) เก็บเฉพาะ hash ใน `WEBGIS_TOKEN_HASHES` เพิกถอน = ลบ hash แล้ว Restart; หมุนเวียน = ใส่ hash ใหม่ควบคู่แล้วค่อยลบของเก่า ส่งทาง Header เท่านั้น อยู่ใน URL fragment (`#`) ของหน้าเว็บ ไม่ถูกส่งไป Server/Referer และไม่ถูก log (log เก็บเฉพาะ method/path/status) มี `Referrer-Policy: no-referrer` ใน meta. เป็นเพียงการจำกัดการเข้าถึงขั้นพื้นฐาน: ผู้ที่ได้ลิงก์ต่อไปได้เข้าถึงได้ เก็บใน sessionStorage ของแท็บ
- **ภาพ**: ตรวจ magic bytes (JPEG/PNG/WebP) ไม่เชื่อ Content-Type; ไม่ตั้ง Public; อ่านผ่าน Backend + token; `nosniff`; ไม่รองรับ SVG/HEIC
- **Turnstile**: ตรวจ siteverify ฝั่ง Backend ที่ POST /surveys (ตรวจ replay ก่อนเพราะ token ใช้ครั้งเดียว)
- **ข้อจำกัดที่ต้องทราบ**
  1. คิวเขียนเป็น in-process: ใช้ได้เฉพาะ instance เดียว ถ้าขยายหลาย instance ข้อมูลอาจชนกัน (ต้องย้ายไป DB ที่มี transaction)
  2. Rate limit/ตัวนับ brute-force เก็บในหน่วยความจำ รีเซ็ตเมื่อ restart
  3. Google Sheets เป็น DB ที่ช้า/มีโควตา ไม่มี transaction ข้ามชีต (ลำดับการเขียนออกแบบให้กู้คืนได้ — ดู surveyService.ts) ถ้าข้อมูลหลักหมื่นรายการขึ้นไป หรือต้องการ spatial query ให้ย้ายไป **PostgreSQL/PostGIS** (Table interface ใน `types/index.ts` แทนที่ได้โดยไม่แตะตรรกะ)
  4. รูปที่ถูกนำออกและรายการที่ลบถูกเก็บไว้ใน Drive (ไม่ลบถาวร) ต้องมีนโยบาย Retention/ล้างข้อมูลเอง
  5. ไม่มีการลบรายการค้างอัตโนมัติ (ตามข้อกำหนด)
  6. Description/ชื่อผู้สำรวจ/ภาพ อาจมีข้อมูลส่วนบุคคล — พิจารณา PDPA; ตั้ง `PUBLIC_SURVEYOR_NAME=false` (ค่าเริ่มต้น) และเปิด `Is_Public` เฉพาะฟิลด์ที่ต้องเผยแพร่
- Secrets: ใส่ใน Render env เท่านั้น; `.gitignore` กัน `.env`/key; Frontend มีเฉพาะ API URL และ Turnstile site key
