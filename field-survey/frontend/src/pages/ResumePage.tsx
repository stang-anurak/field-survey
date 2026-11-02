import { useEffect, useState } from 'react';
import { api, ApiError } from '../services/api';
import type { FormField, OwnerView } from '../types';
import { SurveyBody, emptyValues } from '../components/SurveyBody';
import type { Values } from '../components/SurveyBody';
import { PhotoPicker, makePicked } from '../components/Photos';
import type { Picked } from '../components/Photos';
import { checkImage, validateCoords, validateFields } from '../utils/validation';

export default function ResumePage() {
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [view, setView] = useState<OwnerView | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Values>(emptyValues());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<string, Picked | undefined>>({});
  const [added, setAdded] = useState<Picked[]>([]);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [deleted, setDeleted] = useState(false);

  function hydrate(v: OwnerView) {
    setView(v);
    setValues({ surveyorName: v.surveyorName, description: v.description, lat: String(v.latitude), lng: String(v.longitude), accuracy: v.gpsAccuracy, custom: v.customFields });
  }
  useEffect(() => { if (view) api.formSchema(view.surveyTypeId).then((s) => setFields(s.fields)).catch(() => setFields([])); }, [view?.surveyTypeId]); // eslint-disable-line

  async function open(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { hydrate(await api.resume(id.trim(), code.trim())); } catch (x) { setErr((x as ApiError).message); } finally { setBusy(false); }
  }

  async function uploadSlot(photoId: string, file: File) {
    const bad = checkImage(file); if (bad) { setErr(bad); return; }
    setErr(''); setBusy(true);
    const p = { ...makePicked(file), photoId, state: 'UPLOADING' as const };
    setSlots((s) => ({ ...s, [photoId]: p }));
    try {
      await api.uploadPhoto(id.trim(), code.trim(), photoId, file, (pct) => setSlots((s) => ({ ...s, [photoId]: { ...(s[photoId] as Picked), progress: pct } })));
      hydrate(await api.resume(id.trim(), code.trim()));
      setSlots((s) => ({ ...s, [photoId]: undefined })); setMsg('อัปโหลดรูปสำเร็จ');
    } catch (x) { setSlots((s) => ({ ...s, [photoId]: { ...p, state: 'FAILED', error: (x as ApiError).message } })); } finally { setBusy(false); }
  }

  async function save() {
    if (!view) return;
    const errs = validateFields(fields, values.custom); const c = validateCoords(values.lat, values.lng);
    if (c.error) errs.location = c.error; setErrors(errs); if (Object.keys(errs).length) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const customFields = Object.fromEntries(Object.entries(values.custom).filter(([, v]) => v !== undefined && v !== ''));
      const before = new Set(view.photos.map((p) => p.photoId));
      const next = await api.patch(view.surveyId, code.trim(), {
        latitude: c.lat, longitude: c.lng, gpsAccuracy: values.accuracy, surveyorName: values.surveyorName, description: values.description, customFields,
        addPhotos: added.map((p) => ({ name: p.file.name, size: p.file.size, mime: p.file.type })),
      });
      hydrate(next);
      const newIds = next.photos.filter((p) => !before.has(p.photoId)).map((p) => p.photoId);
      for (let i = 0; i < added.length && i < newIds.length; i++) await api.uploadPhoto(view.surveyId, code.trim(), newIds[i], added[i].file, () => {});
      setAdded([]); hydrate(await api.resume(view.surveyId, code.trim())); setMsg('บันทึกการแก้ไขแล้ว');
    } catch (x) { const a = x as ApiError; setErr(a.message); if (a.details) setErrors(a.details); } finally { setBusy(false); }
  }

  async function removePhoto(photoId: string) {
    if (!view || !confirm('นำรูปนี้ออกจากรายการ?')) return;
    setBusy(true); try { hydrate(await api.patch(view.surveyId, code.trim(), { removePhotoIds: [photoId] })); } catch (x) { setErr((x as ApiError).message); } finally { setBusy(false); }
  }
  async function del() {
    if (!view || !confirm('ลบรายการนี้? รายการจะหายจากแผนที่ (ข้อมูลถูกเก็บไว้เพื่อตรวจสอบย้อนหลัง)')) return;
    setBusy(true); try { await api.remove(view.surveyId, code.trim()); setDeleted(true); setView(null); } catch (x) { setErr((x as ApiError).message); } finally { setBusy(false); }
  }

  if (deleted) return <main className="page"><h1>ลบรายการแล้ว</h1></main>;
  if (!view) return (
    <main className="page"><h1>กลับมาดำเนินการต่อ / แก้ไขรายการ</h1>
      <form className="card" onSubmit={open}>
        <div className="field"><label htmlFor="rid">รหัสรายการ (Survey ID)</label><input id="rid" value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" required /></div>
        <div className="field"><label htmlFor="rcode">รหัสแก้ไข</label><input id="rcode" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" required /></div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn big" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'เปิดรายการ'}</button>
        <p className="hint">หากรหัสหาย ระบบไม่สามารถกู้รหัสเดิมได้ ให้สร้างรายการใหม่หรือแจ้งผู้ดูแลระบบ</p>
      </form></main>
  );

  const pending = view.photos.filter((p) => p.status !== 'UPLOADED');
  return (
    <main className="page">
      <h1>รายการ {view.surveyId}</h1>
      <div className={`banner ${view.status === 'READY' ? 'ok' : 'warnb'}`}>สถานะ: <strong>{view.status === 'READY' ? 'เผยแพร่บนแผนที่แล้ว' : 'ยังไม่เผยแพร่ (รอรูปครบ)'}</strong> · รูป {view.uploadedPhotoCount}/{view.expectedPhotoCount}</div>
      {pending.length > 0 && <section className="card"><h2>รูปที่ยังอัปโหลดไม่สำเร็จ</h2>
        {pending.map((p) => (<div key={p.photoId} className="slot"><p><strong>{p.fileName}</strong> ({p.status === 'FAILED' ? 'ล้มเหลว' : 'รออัปโหลด'}) — เลือกไฟล์เดิมอีกครั้ง</p>
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && uploadSlot(p.photoId, e.target.files[0])} />
          {slots[p.photoId]?.state === 'UPLOADING' && <progress max={100} value={slots[p.photoId]?.progress ?? 0} />}
          {slots[p.photoId]?.error && <p className="err">{slots[p.photoId]?.error}</p>}
          <button className="btn small danger" disabled={busy} onClick={() => removePhoto(p.photoId)}>ไม่ต้องการรูปนี้แล้ว</button></div>))}</section>}
      <SurveyBody fields={fields} values={values} errors={errors} onChange={setValues} />
      <section className="card"><h2>เพิ่มรูปใหม่</h2>
        <PhotoPicker items={added} onChange={setAdded} existing={view.photos.length} onNotice={setMsg} /></section>
      {err && <div className="banner err" role="alert">{err}</div>}{msg && <div className="banner ok" role="status">{msg}</div>}
      <button className="btn big" onClick={save} disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}</button>
      <button className="btn danger" onClick={del} disabled={busy}>ลบรายการนี้</button>
    </main>
  );
}
