import { useCallback, useState } from 'react';

export type GeoState = 'idle' | 'searching' | 'granted' | 'denied' | 'unavailable' | 'insecure';
export interface Fix { lat: number; lng: number; accuracy: number }

export function useGeolocation() {
  const [state, setState] = useState<GeoState>('idle');
  const [fix, setFix] = useState<Fix | null>(null);
  const request = useCallback(() => {
    if (!window.isSecureContext) return setState('insecure');
    if (!navigator.geolocation) return setState('unavailable');
    setState('searching');
    navigator.geolocation.getCurrentPosition(
      (p) => { setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setState('granted'); },
      (e) => setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, []);
  return { state, fix, request };
}

export const geoMessage: Record<GeoState, string> = {
  idle: 'กดปุ่มเพื่ออ่านตำแหน่งปัจจุบัน หรือปักหมุด/กรอกพิกัดเองได้',
  searching: 'กำลังค้นหาตำแหน่ง… (ถ้ามีหน้าต่างขออนุญาต ให้กด "อนุญาต")',
  granted: 'อ่านตำแหน่งสำเร็จ ลากหมุดเพื่อปรับให้ตรงจุดได้',
  denied: 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — เปิดสิทธิ์ตำแหน่งให้เบราว์เซอร์ หรือปักหมุด/กรอกพิกัดเอง',
  unavailable: 'ไม่พบตำแหน่ง (สัญญาณ GPS อ่อนหรืออุปกรณ์ไม่รองรับ) — ปักหมุดหรือกรอกพิกัดเองแทนได้',
  insecure: 'การอ่าน GPS ต้องเปิดผ่าน HTTPS — ปักหมุดหรือกรอกพิกัดเองแทนได้',
};
