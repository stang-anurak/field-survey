import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { FormField, SurveyType } from '../types';
import { SurveyBody, emptyValues } from '../components/SurveyBody';
import type { Values } from '../components/SurveyBody';
import { PhotoPicker } from '../components/Photos';
import type { Picked } from '../components/Photos';
import { Turnstile } from '../components/Turnstile';
import type { TurnstileHandle } from '../components/Turnstile';
import { newIdemKey, validateCoords, validateFields } from '../utils/validation';
import { uploadAll } from '../utils/upload';

interface Created { surveyId: string; editCode: string; status: string }

export default function FormPage() {
  const [types, setTypes] = useState<SurveyType[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [typeId, setTypeId] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Values>(emptyValues());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [notice, setNotice] = useState('');
  const [tsToken, setTsToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [created, setCreated] = useState<Created | null>(null);
  const [final, setFinal] = useState<'READY' | 'INCOMPLETE' | null>(null);
  const [copied, setCopied] = useState(false);
  const idem = useRef(newIdemKey());
  const ts = useRef<TurnstileHandle>(null);
  const onToken = useCallback((t: string) => setTsToken(t), []);

  const loadTypes = useCallback(() => { setLoadErr(''); api.types().then(setTypes).catch((e: ApiError) => setLoadErr(e.message)); }, []);
  useEffect(loadTypes, [loadTypes]);
  useEffect(() => {
    if (!typeId) { setFields([]); return; }
    api.formSchema(typeId).then((s) => setFields(s.fields)).catch((e: ApiError) => setFormErr(e.message));
  }, [typeId]);

  const setPhoto = useCallback((key: string, patch: Partial<Picked>) => setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p))), []);

  async function finish(c: Created, list: Picked[]) {
    const failed = await uploadAll(c.surveyId, c.editCode, list, setPhoto);
    if (failed === 0) {
      try { const s = await api.status(c.surveyId, c.editCode); setFinal(s.status === 'READY' ? 'READY' : 'INCOMPLETE'); }
      catch { setFinal('INCOMPLETE'); }
    } else setFinal('INCOMPLETE');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFormErr('');
    const errs = validateFields(fields, values.custom);
    const c = validateCoords(values.lat, values.lng);
    if (c.error) errs.location = c.error;
    if (!typeId) errs.type = 'กรุณาเลือกประเภทงาน';
    if (!tsToken) errs.turnstile = 'กรุณายืนยันว่าไม่ใช่บอท';
    setErrors(errs);
    if (Object.keys(errs).length) { document.querySelector('.err')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }

    setBusy(true);
    try {
      const customFields = Object.fromEntries(Object.entries(values.custom).filter(([, v]) => v !== undefined && v !== ''));
      const data = await api.create({
        surveyTypeId: typeId, latitude: c.lat, longitude: c.lng, gpsAccuracy: values.accuracy,
        surveyorName: values.surveyorName || undefined, description: values.description || undefined, customFields,
        photos: photos.map((p) => ({ name: p.file.name, size: p.file.size, mime: p.file.type })), turnstileToken: tsToken,
      }, idem.current);
      const mapped = photos.map((p, i) => ({ ...p, photoId: data.photos[i]?.photoId }));
      setPhotos(mapped);
      const cr = { surveyId: data.surveyId, editCode: data.editCode, status: data.status };
      setCreated(cr);
      if (mapped.length === 0 && data.status === 'READY') setFinal('READY'); else await finish(cr, mapped);
    } catch (err) {
      const e2 = err as ApiError;
      setFormErr(e2.message);
      if (e2.details) setErrors((old) => ({ ...old, ...e2.details }));
      // ข้อผิดพลาดเครือข่าย/5xx: คง Idempotency-Key เดิมเพื่อไม่ให้เกิดรายการซ้ำ; 4xx: ข้อมูลเปลี่ยนได้จึงขอคีย์ใหม่
      if (!e2.network && e2.status > 0 && e2.status < 500) idem.current = newIdemKey();
      ts.current?.reset();
    } finally { setBusy(false); }
  }

  async function retryUploads() {
    if (!created) return;
    setBusy(true); setFinal(null);
    try { await api.retry(created.surveyId, created.editCode); } catch { /* ไปต่อด้วยการอัปโหลดซ้ำ */ }
    await finish(created, photos);
    setBusy(false);
  }

  function copy() { navigator.clipboard?.writeText(created!.editCode).then(() => setCopied(true)).catch(() => setCopied(false)); }

  if (created) {
    return (
      <main className="page">
        <h1>{final === 'READY' ? '✅ ส่งข้อมูลสำเร็จครบถ้วน' : final === 'INCOMPLETE' ? '⚠ บันทึกข้อมูลแล้ว แต่รูปยังอัปโหลดไม่ครบ' : 'กำลังอัปโหลด…'}</h1>
        <section className="card key">
          <p>รหัสรายการ: <strong className="mono">{created.surveyId}</strong></p>
          <p>รหัสแก้ไข: <strong className="mono big">{created.editCode}</strong></p>
          <button type="button" className="btn secondary" onClick={copy}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัสแก้ไข'}</button>
          <p className="warn"><strong>โปรดจดหรือบันทึกรหัสนี้ไว้ตอนนี้</strong> หน้านี้จะไม่แสดงรหัสอีก ใช้รหัสนี้เพื่อกลับมาอัปโหลดรูปต่อ แก้ไข หรือลบรายการ หากรหัสหาย ระบบไม่สามารถกู้รหัสเดิมให้ได้</p>
        </section>
        {photos.length > 0 && <section className="card"><h2>สถานะรูปภาพ</h2><PhotoPicker items={photos} onChange={setPhotos} locked onNotice={setNotice} /></section>}
        {final === 'INCOMPLETE' && (<section className="card"><p>รายการนี้ <strong>ยังไม่แสดงบนแผนที่</strong> จนกว่ารูปทั้งหมดจะอัปโหลดครบ</p>
          <button className="btn" onClick={retryUploads} disabled={busy}>ลองอัปโหลดรูปที่ค้างอีกครั้ง</button>
          <p className="hint">ถ้าปิดหน้านี้ไปแล้ว ให้ใช้เมนู “แก้ไข/ส่งต่อ” พร้อมรหัสแก้ไข แล้วเลือกไฟล์รูปที่ค้างใหม่</p></section>)}
        {final === 'READY' && <p>ข้อมูลของคุณพร้อมแสดงบน WebGIS แล้ว</p>}
        <Link className="btn secondary" to="/" reloadDocument>กรอกรายการใหม่</Link>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>แบบฟอร์มสำรวจภาคสนาม</h1>
      {loadErr && <div className="banner err" role="alert">{loadErr} <button className="btn small" onClick={loadTypes}>ลองใหม่</button></div>}
      {!types && !loadErr && <p>กำลังโหลดประเภทงาน…</p>}
      {types && types.length === 0 && <p>ยังไม่มีประเภทงานที่เปิดใช้งาน (ผู้ดูแลต้องเพิ่มในชีต SurveyTypes)</p>}
      {types && types.length > 0 && (
        <form onSubmit={submit} noValidate>
          <section className="card"><div className={`field${errors.type ? ' has-err' : ''}`}><label htmlFor="type">ประเภทงานสำรวจ <span className="req">*</span></label>
            <select id="type" value={typeId} onChange={(e) => { setTypeId(e.target.value); setValues((v) => ({ ...v, custom: {} })); }}>
              <option value="">— เลือกประเภทงาน —</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            {errors.type && <p className="err">{errors.type}</p>}</div></section>
          {typeId && <>
            <SurveyBody fields={fields} values={values} errors={errors} onChange={setValues} />
            <section className="card"><h2>รูปถ่าย</h2><PhotoPicker items={photos} onChange={setPhotos} locked={busy} onNotice={setNotice} />
              {notice && <p className="err" role="alert">{notice}</p>}</section>
            <section className="card"><h2>ยืนยันตัวตน</h2><Turnstile ref={ts} onToken={onToken} />{errors.turnstile && <p className="err">{errors.turnstile}</p>}</section>
            {formErr && <div className="banner err" role="alert">{formErr}</div>}
            <button className="btn big" type="submit" disabled={busy}>{busy ? 'กำลังส่ง… กรุณาอย่าปิดหน้านี้' : 'ส่งข้อมูล'}</button>
          </>}
        </form>
      )}
    </main>
  );
}
