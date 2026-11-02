// Header ของทุกชีต (ใช้ทั้งตอน setup และตรวจสอบตอนเริ่มระบบ) ดู docs/SHEETS_SCHEMA.md
export const SHEETS = {
  Surveys: ['Survey_ID', 'Survey_Type_ID', 'Latitude', 'Longitude', 'GPS_Accuracy', 'Surveyor_Name', 'Description', 'Custom_Fields_JSON', 'Status', 'Expected_Photo_Count', 'Uploaded_Photo_Count', 'Edit_Token_Hash', 'Idempotency_Key_Hash', 'Created_At', 'Updated_At', 'Deleted_At'],
  Photos: ['Photo_ID', 'Survey_ID', 'Original_File_Name', 'Drive_File_ID', 'MIME_Type', 'File_Size', 'Upload_Status', 'Sort_Order', 'Created_At', 'Uploaded_At', 'Error_Code'],
  SurveyTypes: ['Survey_Type_ID', 'Type_Name', 'Description', 'Is_Active', 'Sort_Order', 'Created_At', 'Updated_At', 'Marker_Color'],
  FormFields: ['Field_ID', 'Survey_Type_ID', 'Field_Key', 'Field_Label', 'Field_Type', 'Required', 'Options', 'Sort_Order', 'Is_Active', 'Placeholder', 'Help_Text', 'Is_Public'],
  ActivityLog: ['Log_ID', 'Survey_ID', 'Action', 'Actor_Type', 'Timestamp', 'Details'],
} as const;
