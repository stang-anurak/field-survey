import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' ใช้ได้กับ GitHub Pages ทุก repo path; ใช้ HashRouter จึง Refresh หน้าย่อยแล้วไม่ 404
export default defineConfig({ base: './', plugins: [react()], build: { sourcemap: false } });
