import { randomBytes, createHash } from 'node:crypto';

const token = randomBytes(32).toString('base64url'); // 256 บิต
const hash = createHash('sha256').update(token).digest('hex');
console.log('WebGIS token (เก็บเป็นความลับ ใช้ต่อท้ายลิงก์ #/map?t=...):\n  ' + token);
console.log('\nเพิ่มค่านี้ใน WEBGIS_TOKEN_HASHES บน Render (คั่นด้วยคอมมาถ้ามีหลายค่า):\n  ' + hash);
console.log('\nเพิกถอน: ลบ hash เดิมออกจาก WEBGIS_TOKEN_HASHES แล้ว Restart/Deploy');
