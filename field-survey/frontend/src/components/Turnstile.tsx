import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void } } }
export interface TurnstileHandle { reset: () => void }
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    let s = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (!s) { s = document.createElement('script'); s.src = SRC; s.async = true; s.dataset.turnstile = '1'; document.head.appendChild(s); }
    s.addEventListener('load', () => resolve());
    s.addEventListener('error', () => reject(new Error('turnstile script')));
  });
}

export const Turnstile = forwardRef<TurnstileHandle, { onToken: (t: string) => void }>(function Turnstile({ onToken }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  useImperativeHandle(ref, () => ({ reset: () => { onToken(''); if (id.current) window.turnstile?.reset(id.current); } }), [onToken]);
  useEffect(() => {
    if (!SITE_KEY) return;
    let dead = false;
    loadScript().then(() => {
      if (dead || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY, callback: (t: string) => onToken(t), 'expired-callback': () => onToken(''), 'error-callback': () => onToken(''),
      });
    }).catch(() => onToken(''));
    return () => { dead = true; if (id.current) window.turnstile?.remove(id.current); };
  }, [onToken]);
  if (!SITE_KEY) return <p className="hint">โหมดพัฒนา: ยังไม่ได้ตั้ง VITE_TURNSTILE_SITE_KEY (Backend production จะปฏิเสธการส่ง)</p>;
  return <div ref={box} className="turnstile" />;
});
