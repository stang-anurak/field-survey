import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { DriveFileStore, createClients, createTables } from './services/google.ts';
import { SurveyService } from './services/surveyService.ts';

const { env, config } = loadEnv();
const { sheets, drive } = createClients(env);
const tables = createTables(sheets, env.SPREADSHEET_ID);
const svc = new SurveyService({
  tables, files: new DriveFileStore(drive, env.DRIVE_FOLDER_ID), editSecret: env.EDIT_TOKEN_SECRET, publicSurveyorName: config.publicSurveyorName,
});

// ตรวจ Header ของชีตก่อนเปิดรับคำขอ (ล้มเร็วพร้อมข้อความชัดเจนถ้าตั้งค่าไม่ถูก)
for (const [name, t] of Object.entries(tables)) {
  try { await t.readAll({ fresh: true }); } catch (e) { console.error(`ตรวจชีต ${name} ไม่ผ่าน:`, (e as Error).message); process.exit(1); }
}

const server = createApp(svc, config).listen(config.port, () => console.log(`API listening on :${config.port}`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('unhandledRejection', (e) => console.error('unhandledRejection', (e as Error)?.message));
