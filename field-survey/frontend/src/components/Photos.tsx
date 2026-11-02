import { useEffect, useRef } from 'react';
import { MAX_PHOTOS, checkImage, fmtSize } from '../utils/validation';

export type UpState = 'READY_TO_SEND' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
export interface Picked { key: string; file: File; preview: string; state: UpState; progress: number; error?: string; photoId?: string }

export function makePicked(file: File): Picked { return { key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), state: 'READY_TO_SEND', progress: 0 }; }

const label: Record<UpState, string> = { READY_TO_SEND: 'รอส่ง', UPLOADING: 'กำลังอัปโหลด', UPLOADED: '✓ อัปโหลดแล้ว', FAILED: '✗ ไม่สำเร็จ' };

export function PhotoPicker({ items, onChange, locked, max = MAX_PHOTOS, existing = 0, onNotice }: {
  items: Picked[]; onChange: (p: Picked[]) => void; locked?: boolean; max?: number; existing?: number; onNotice: (m: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  urls.current = items.map((i) => i.preview);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function add(files: FileList | null) {
    if (!files) return;
    const next = [...items]; const notes: string[] = [];
    for (const f of Array.from(files)) {
      if (next.length + existing >= max) { notes.push(`แนบได้สูงสุด ${max} รูป`); break; }
      const err = checkImage(f);
      if (err) notes.push(`${f.name}: ${err}`); else next.push(makePicked(f));
    }
    onNotice(notes.join(' • '));
    onChange(next);
    if (input.current) input.current.value = '';
  }
  function remove(k: string) {
    const it = items.find((i) => i.key === k); if (it) URL.revokeObjectURL(it.preview);
    onChange(items.filter((i) => i.key !== k));
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
      <button type="button" className="btn secondary" disabled={locked || items.length + existing >= max} onClick={() => input.current?.click()}>📷 เพิ่มรูป ({items.length + existing}/{max})</button>
      <p className="hint">JPG, PNG, WebP ไม่เกิน 10 MB ต่อรูป (ยังไม่รองรับ HEIC)</p>
      <ul className="photos">
        {items.map((p) => (
          <li key={p.key} className={`photo ${p.state.toLowerCase()}`}>
            <img src={p.preview} alt="" />
            <div className="meta"><strong>{p.file.name}</strong><span>{fmtSize(p.file.size)} · {label[p.state]}</span>
              {p.state === 'UPLOADING' && <progress max={100} value={p.progress} />}
              {p.error && <span className="err">{p.error}</span>}</div>
            {!locked && p.state !== 'UPLOADING' && p.state !== 'UPLOADED' && <button type="button" className="btn small danger" onClick={() => remove(p.key)} aria-label={`นำ ${p.file.name} ออก`}>นำออก</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
