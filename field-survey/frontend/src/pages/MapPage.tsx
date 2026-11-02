import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { api, ApiError } from '../services/api';
import type { CustomValue, PublicSurvey } from '../types';
import { OSM, pin } from '../components/MapBox';

const TOKEN_KEY = 'wg_token';
const ESRI = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community', max: 19 };
const show = (v: CustomValue) => (Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'ใช่' : 'ไม่ใช่') : String(v));

function AuthImage({ token, sid, pid }: { token: string; sid: string; pid: string }) {
  const [src, setSrc] = useState(''); const [bad, setBad] = useState(false);
  useEffect(() => {
    let url = ''; let dead = false;
    api.webgisPhotoBlob(token, sid, pid).then((b) => { if (!dead) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => !dead && setBad(true));
    return () => { dead = true; if (url) URL.revokeObjectURL(url); };
  }, [token, sid, pid]);
  if (bad) return <div className="imgbad">โหลดรูปไม่สำเร็จ</div>;
  return src ? <a href={src} target="_blank" rel="noreferrer"><img className="shot" src={src} alt="ภาพถ่ายภาคสนาม" /></a> : <div className="imgload">กำลังโหลดรูป…</div>;
}

export default function MapPage() {
  const [params] = useSearchParams(); const nav = useNavigate();
  const [token] = useState(() => {
    const t = params.get('t');
    if (t) { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } return t; }
    try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
  });
  useEffect(() => { if (params.get('t')) nav('/map', { replace: true }); }, [params, nav]); // ซ่อน token จากแถบที่อยู่/ประวัติ

  const [items, setItems] = useState<PublicSurvey[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [sel, setSel] = useState<PublicSurvey | null>(null); const [selLoading, setSelLoading] = useState(false);
  const [base, setBase] = useState<'osm' | 'esri'>('osm');
  const [q, setQ] = useState(''); const [typeId, setTypeId] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [fkey, setFkey] = useState(''); const [fval, setFval] = useState(''); const [panel, setPanel] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null); const map = useRef<L.Map | null>(null);
  const layer = useRef<L.TileLayer | null>(null); const cluster = useRef<L.MarkerClusterGroup | null>(null); const fitted = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try { setItems(await api.webgisList(token)); setError(''); }
    catch (e) { const a = e as ApiError; setError(a.status === 401 ? 'ลิงก์หรือ token ไม่ถูกต้องหรือถูกเพิกถอนแล้ว' : a.message); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); const t = setInterval(() => { if (document.visibilityState === 'visible') load(true); }, 30000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (!mapEl.current) return;
    const m = L.map(mapEl.current, { center: [13.75, 100.5], zoom: 6 });
    cluster.current = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 }).addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [token]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    layer.current?.remove();
    const b = base === 'osm' ? OSM : ESRI;
    layer.current = L.tileLayer(b.url, { attribution: b.attr, maxZoom: b.max }).addTo(m);
    layer.current.bringToBack();
  }, [base, token]);

  const types = useMemo(() => [...new Map(items.map((i) => [i.typeId, i.typeName])).entries()], [items]);
  const fieldKeys = useMemo(() => [...new Map(items.flatMap((i) => i.customFields.map((f) => [f.key, f.label] as const))).entries()], [items]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (typeId && i.typeId !== typeId) return false;
      const d = i.createdAt.slice(0, 10);
      if (from && d < from) return false; if (to && d > to) return false;
      if (fkey && fval.trim()) { const f = i.customFields.find((c) => c.key === fkey); if (!f || !show(f.value).toLowerCase().includes(fval.trim().toLowerCase())) return false; }
      if (needle) { const hay = [i.description, i.typeName, i.surveyId, ...i.customFields.map((c) => show(c.value))].join(' ').toLowerCase(); if (!hay.includes(needle)) return false; }
      return true;
    });
  }, [items, q, typeId, from, to, fkey, fval]);

  const choose = useCallback((s: PublicSurvey, zoom = false) => {
    setSel(s); setSelLoading(true);
    if (zoom) map.current?.setView([s.latitude, s.longitude], Math.max(map.current.getZoom(), 17));
    api.webgisDetail(token, s.surveyId).then((d) => setSel(d)).catch(() => undefined).finally(() => setSelLoading(false));
  }, [token]);

  useEffect(() => {
    const c = cluster.current; const m = map.current; if (!c || !m) return;
    c.clearLayers();
    c.addLayers(filtered.map((s) => L.marker([s.latitude, s.longitude], { icon: pin(s.color), title: s.typeName }).on('click', () => choose(s))));
    if (!fitted.current && filtered.length) { m.fitBounds(L.latLngBounds(filtered.map((s) => [s.latitude, s.longitude] as [number, number])), { padding: [40, 40], maxZoom: 16 }); fitted.current = true; }
  }, [filtered, choose]);

  if (!token) return <main className="page"><h1>WebGIS</h1><p>ต้องเปิดผ่านลิงก์ที่มี token จากผู้ดูแลระบบ</p></main>;
  const clear = () => { setQ(''); setTypeId(''); setFrom(''); setTo(''); setFkey(''); setFval(''); };

  return (
    <div className="gis">
      <div className="toolbar">
        <button className="btn small" onClick={() => setPanel((p) => !p)} aria-expanded={panel}>☰ ค้นหา/รายการ ({filtered.length})</button>
        <select aria-label="แผนที่พื้นหลัง" value={base} onChange={(e) => setBase(e.target.value as 'osm' | 'esri')}><option value="osm">OpenStreetMap</option><option value="esri">ภาพถ่ายดาวเทียม (Esri)</option></select>
        <button className="btn small secondary" onClick={() => load()}>↻</button>
        <button className="btn small secondary" onClick={() => api.download(token, '/api/export/surveys.csv', 'surveys.csv').catch((e: ApiError) => setError(e.message))}>CSV</button>
        <button className="btn small secondary" onClick={() => api.download(token, '/api/export/surveys.geojson', 'surveys.geojson').catch((e: ApiError) => setError(e.message))}>GeoJSON</button>
      </div>
      {loading && <div className="overlay">กำลังโหลดข้อมูล…</div>}
      {error && <div className="overlay errb" role="alert">{error} <button className="btn small" onClick={() => load()}>ลองใหม่</button></div>}
      {!loading && !error && items.length === 0 && <div className="overlay">ยังไม่มีข้อมูลที่เผยแพร่</div>}
      {!loading && !error && items.length > 0 && filtered.length === 0 && <div className="overlay">ไม่พบข้อมูลตามตัวกรอง <button className="btn small" onClick={clear}>ล้างตัวกรอง</button></div>}
      <div ref={mapEl} className="bigmap" />
      <aside className={`panel${panel ? ' open' : ''}`}>
        <input type="search" placeholder="ค้นหาคำสำคัญ…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="ประเภทงาน"><option value="">ทุกประเภทงาน</option>{types.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <div className="row2"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="ตั้งแต่วันที่" /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ถึงวันที่" /></div>
        <div className="row2"><select value={fkey} onChange={(e) => setFkey(e.target.value)} aria-label="ฟิลด์"><option value="">ฟิลด์…</option>{fieldKeys.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input placeholder="ค่าที่มี…" value={fval} onChange={(e) => setFval(e.target.value)} disabled={!fkey} /></div>
        <button className="btn small secondary" onClick={clear}>ล้างตัวกรอง</button>
        <ul className="list">{filtered.slice(0, 300).map((s) => (<li key={s.surveyId}><button onClick={() => { choose(s, true); setPanel(false); }}>
          <span className="dot" style={{ background: s.color }} /><strong>{s.typeName}</strong><small>{s.createdAt.slice(0, 10)} · {s.description.slice(0, 60)}</small></button></li>))}
          {filtered.length > 300 && <li className="hint">แสดง 300 รายการแรก ใช้ตัวกรองเพื่อจำกัดผลลัพธ์</li>}</ul>
      </aside>
      {sel && (<section className="detail" aria-label="รายละเอียด"><button className="btn small close" onClick={() => setSel(null)} aria-label="ปิด">✕</button>
        <h2><span className="dot" style={{ background: sel.color }} />{sel.typeName}</h2>
        <p className="mono small">{sel.surveyId} · {sel.createdAt.slice(0, 16).replace('T', ' ')}</p>
        {sel.surveyorName && <p>ผู้สำรวจ: {sel.surveyorName}</p>}
        {sel.description && <p className="pre">{sel.description}</p>}
        <dl>{sel.customFields.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{show(f.value)}</dd></div>)}</dl>
        <p className="mono small">{sel.latitude.toFixed(6)}, {sel.longitude.toFixed(6)}</p>
        {selLoading && <p className="hint">กำลังโหลดรูป…</p>}
        {sel.photos?.map((p) => <AuthImage key={p.photoId} token={token} sid={sel.surveyId} pid={p.photoId} />)}</section>)}
    </div>
  );
}
