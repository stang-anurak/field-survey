# SHEETS_SCHEMA
ระบบอ่าน/เขียนตามชื่อ Header (ไม่ใช่ตำแหน่งคอลัมน์) จึงเพิ่มคอลัมน์ของผู้ดูแลได้โดยไม่กระทบ ตัวเลข/สูตรถูกเขียนแบบ RAW (ไม่ตีความเป็นสูตร) ค่า Boolean ใช้ `TRUE/FALSE`
สร้างอัตโนมัติด้วย `npm run setup:sheets`

- **Surveys**: Survey_ID, Survey_Type_ID, Latitude, Longitude, GPS_Accuracy, Surveyor_Name, Description, Custom_Fields_JSON, Status, Expected_Photo_Count, Uploaded_Photo_Count, Edit_Token_Hash, Idempotency_Key_Hash, Created_At, Updated_At, Deleted_At
- **Photos**: Photo_ID, Survey_ID, Original_File_Name, Drive_File_ID, MIME_Type, File_Size, Upload_Status (`PENDING|UPLOADED|FAILED|REMOVED`), Sort_Order, Created_At, Uploaded_At, Error_Code
- **SurveyTypes**: Survey_Type_ID, Type_Name, Description, Is_Active, Sort_Order, Created_At, Updated_At, Marker_Color (`#rrggbb`)
- **FormFields**: Field_ID, Survey_Type_ID, Field_Key, Field_Label, Field_Type, Required, Options, Sort_Order, Is_Active, Placeholder, Help_Text, Is_Public
- **ActivityLog**: Log_ID, Survey_ID, Action, Actor_Type, Timestamp, Details

## ผู้ดูแลแก้ไขฟิลด์
- `Field_Type`: text, textarea, number, date, select, multiselect, checkbox (หรือ boolean)
- `Field_Key`: `a-z0-9_` ขึ้นต้นด้วยตัวอักษร ≤40 ตัว ไม่ซ้ำในประเภทงาน ห้ามซ้ำคำสงวน (survey_id, latitude, longitude, description, status, type, type_id, type_name, created_at, photo_count, surveyor_name) — **เปลี่ยน Label ได้แต่อย่าเปลี่ยน Field_Key** ของฟิลด์ที่มีข้อมูลแล้ว
- `Options` ของ select/multiselect: คั่นด้วย `|` หรือขึ้นบรรทัดใหม่
- `Is_Active`/`Is_Public` ต้องเป็น `TRUE` อย่างชัดเจน (ว่าง = FALSE) `Is_Public=TRUE` เท่านั้นที่ขึ้น WebGIS/Export
- แถวที่ตั้งค่าผิดจะถูก **ข้ามพร้อมบันทึกคำเตือนใน Log ของ Render** ไม่ทำให้ระบบล่ม ข้อมูลเดิมไม่ถูกแก้
- อย่าแก้ Surveys/Photos ด้วยมือ ยกเว้นกู้คืน; อย่าเรียง (sort) ชีตขณะระบบเขียนข้อมูล
- ระบบหา Row จาก ID ทุกครั้ง ไม่ใช้เลขแถวเป็น Key
