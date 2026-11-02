import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const pin = (color: string) => L.divIcon({ className: 'pin', html: `<span style="background:${color}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
export const OSM = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', max: 19 };

/** แผนที่ปักหมุด/ลากหมุดสำหรับแบบฟอร์ม */
export function LocationMap({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onPick); cb.current = onPick;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: [13.75, 100.5], zoom: 6 });
    L.tileLayer(OSM.url, { attribution: OSM.attr, maxZoom: OSM.max }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => cb.current(e.latlng.lat, e.latlng.lng));
    map.current = m;
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current; if (!m) return;
    if (lat === null || lng === null) { marker.current?.remove(); marker.current = null; return; }
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { draggable: true, icon: pin('#dc2626') }).addTo(m);
      marker.current.on('dragend', () => { const p = marker.current!.getLatLng(); cb.current(p.lat, p.lng); });
      m.setView([lat, lng], Math.max(m.getZoom(), 16));
    } else {
      const cur = marker.current.getLatLng();
      if (Math.abs(cur.lat - lat) > 1e-9 || Math.abs(cur.lng - lng) > 1e-9) { marker.current.setLatLng([lat, lng]); m.panTo([lat, lng]); }
    }
  }, [lat, lng]);

  return <div ref={el} className="locmap" role="application" aria-label="แผนที่ปักหมุดตำแหน่ง" />;
}
