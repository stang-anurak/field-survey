import type { CustomValue, FormField } from '../types';
import { DynamicField } from './DynamicField';
import { LocationMap } from './MapBox';
import { geoMessage, useGeolocation } from '../hooks/useGeolocation';
import { useEffect } from 'react';

export interface Values { surveyorName: string; description: string; lat: string; lng: string; accuracy: number | null; custom: Record<string, CustomValue | undefined> }
export const emptyValues = (): Values => ({ surveyorName: '', description: '', lat: '', lng: '', accuracy: null, custom: {} });

interface Props { fields: FormField[]; values: Values; errors: Record<string, string>; onChange: (v: Values) => void }

export function SurveyBody({ fields, values, errors, onChange }: Props) {
  const geo = useGeolocation();
  useEffect(() => {
    if (geo.fix) onChange({ ...values, lat: geo.fix.lat.toFixed(6), lng: geo.fix.lng.toFixed(6), accuracy: Math.round(geo.fix.accuracy) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.fix]);
  const lat = values.lat.trim() !== '' && Number.isFinite(Number(values.lat)) ? Number(values.lat) : null;
  const lng = values.lng.trim() !== '' && Number.isFinite(Number(values.lng)) ? Number(values.lng) : null;
  const valid = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  return (
    <>
      <section className="card">
        <h2>ข้อมูลทั่วไป</h2>
        <div className="field"><label htmlFor="sn">ชื่อผู้สำรวจ (ไม่บังคับ)</label>
          <input id="sn" value={values.surveyorName} maxLength={100} onChange={(e) => onChange({ ...values, surveyorName: e.target.value })} /></div>
        <div className="field"><label htmlFor="ds">รายละเอียด / หมายเหตุ</label>
          <textarea id="ds" rows={4} maxLength={2000} value={values.description} onChange={(e) => onChange({ ...values, description: e.target.value })} />
          {errors.description && <p className="err">{errors.description}</p>}</div>
      </section>

      {fields.length > 0 && (
        <section className="card"><h2>ข้อมูลเฉพาะประเภทงาน</h2>
          {fields.map((f) => <DynamicField key={f.id} field={f} value={values.custom[f.key]} error={errors[f.key]}
            onChange={(v) => onChange({ ...values, custom: { ...values.custom, [f.key]: v } })} />)}
        </section>
      )}

      <section className="card">
        <h2>ตำแหน่ง (WGS84)</h2>
        <button type="button" className="btn secondary" onClick={geo.request} disabled={geo.state === 'searching'}>
          {geo.state === 'searching' ? 'กำลังค้นหาตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบัน (GPS)'}</button>
        <p className={`hint${geo.state === 'denied' || geo.state === 'unavailable' || geo.state === 'insecure' ? ' warn' : ''}`} aria-live="polite">{geoMessage[geo.state]}</p>
        <p className="hint">GPS ใช้ได้เมื่อเปิดผ่าน HTTPS และอนุญาตสิทธิ์ตำแหน่งในเบราว์เซอร์ ไม่บังคับ — แตะแผนที่เพื่อปักหมุด หรือกรอกพิกัดเองได้</p>
        <LocationMap lat={valid ? lat : null} lng={valid ? lng : null}
          onPick={(a, b) => onChange({ ...values, lat: a.toFixed(6), lng: b.toFixed(6), accuracy: null })} />
        <div className="row2">
          <div className="field"><label htmlFor="lat">Latitude</label>
            <input id="lat" inputMode="decimal" value={values.lat} onChange={(e) => onChange({ ...values, lat: e.target.value, accuracy: null })} /></div>
          <div className="field"><label htmlFor="lng">Longitude</label>
            <input id="lng" inputMode="decimal" value={values.lng} onChange={(e) => onChange({ ...values, lng: e.target.value, accuracy: null })} /></div>
        </div>
        {values.accuracy !== null && <p className="hint">ความแม่นยำ GPS ประมาณ ±{values.accuracy} ม.</p>}
        {errors.location && <p className="err" role="alert">{errors.location}</p>}
      </section>
    </>
  );
}
