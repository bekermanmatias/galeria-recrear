import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, RefreshCw, AlertCircle, User, Bus, School, Phone, Mail, CreditCard, Calendar, MapPin, Hash } from 'lucide-react';
import { api, type Passenger, type PassengerAssociation } from '../../lib/api';

declare const jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | undefined;

type ScanResult = Passenger & { schools: PassengerAssociation[]; departures: PassengerAssociation[] };

const fmt = (v?: string | null) => v ? v.slice(0, 10).split('-').reverse().join('/') : null;
const isActive = (active: boolean) => active
  ? <span style={{ padding: '3px 10px', background: '#DCFCE7', color: '#15803D', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Activo</span>
  : <span style={{ padding: '3px 10px', background: '#FEF2F2', color: '#B91C1C', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>Inactivo</span>;

function DataRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF4F8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon size={16} color="#1A4B77" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#1E293B', fontWeight: 500, marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

export default function AdminQRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [phase, setPhase] = useState<'loading' | 'scanning' | 'found' | 'notfound' | 'cameraError'>('loading');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [lastCode, setLastCode] = useState('');
  const [jsQrReady, setJsQrReady] = useState(false);

  // Load jsQR
  useEffect(() => {
    if ((window as any).jsQR) { setJsQrReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => setJsQrReady(true);
    s.onerror = () => setPhase('cameraError');
    document.head.appendChild(s);
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(() => {
    setPhase('scanning');
    setResult(null);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setPhase('cameraError'));
  }, []);

  useEffect(() => {
    if (jsQrReady) startCamera();
    return stopCamera;
  }, [jsQrReady]);

  // Scan loop
  useEffect(() => {
    if (phase !== 'scanning') return;
    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const fn = (window as any).jsQR as typeof jsQR;
          if (fn) {
            const qr = fn(img.data, img.width, img.height);
            if (qr?.data) {
              const code = qr.data.trim();
              setLastCode(code);
              stopCamera();
              setPhase('loading');
              api.scanWristband(code)
                .then(data => { setResult(data); setPhase('found'); })
                .catch(() => { setResult(null); setPhase('notfound'); });
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    };
    rafRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  const reset = () => startCamera();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEF4F8', display: 'grid', placeItems: 'center' }}>
            <QrCode size={22} color="#1A4B77" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: '#1A4B77', fontWeight: 700 }}>Escáner QR</h2>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>Escaneá la pulsera de un pasajero para ver su información</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 20, maxWidth: 520, margin: '0 auto', width: '100%' }}>

        {/* Camera or loading */}
        {(phase === 'scanning' || phase === 'loading') && (
          <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden', background: '#000', aspectRatio: '1', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {/* Overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '58%', aspectRatio: '1', border: '3px solid rgba(255,255,255,.9)', borderRadius: 14, boxShadow: '0 0 0 9999px rgba(0,0,0,.5)' }} />
            </div>
            {phase === 'loading' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center' }}>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Buscando pasajero…</div>
              </div>
            )}
            {phase === 'scanning' && (
              <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                Apuntá al QR de la pulsera
              </div>
            )}
          </div>
        )}

        {/* Camera error */}
        {phase === 'cameraError' && (
          <div style={{ textAlign: 'center', padding: 28, background: '#FEF2F2', borderRadius: 16, width: '100%' }}>
            <AlertCircle size={40} color="#B91C1C" style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#B91C1C', fontWeight: 700, margin: '0 0 6px' }}>Error de cámara</p>
            <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>No se pudo acceder a la cámara. Verificá los permisos del navegador.</p>
          </div>
        )}

        {/* Not found */}
        {phase === 'notfound' && (
          <div style={{ textAlign: 'center', padding: 28, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 16, width: '100%' }}>
            <AlertCircle size={40} color="#D97706" style={{ display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: '#92400E', fontWeight: 700, margin: '0 0 6px' }}>Pasajero no encontrado</p>
            <p style={{ color: '#64748B', fontSize: 13, margin: '0 0 4px' }}>Código escaneado:</p>
            <code style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{lastCode}</code>
            <p style={{ color: '#64748B', fontSize: 12, margin: '8px 0 0' }}>Este código no está vinculado a ningún pasajero de tus salidas.</p>
          </div>
        )}

        {/* Found: passenger card */}
        {phase === 'found' && result && (
          <div style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.07)' }}>
            {/* Top strip */}
            <div style={{ background: result.active ? '#1A4B77' : '#64748B', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                  Pulsera {result.wristband_code}
                </div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{result.full_name}</div>
                {result.external_number && <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, marginTop: 4 }}>Nro. externo: {result.external_number}</div>}
              </div>
              {isActive(result.active)}
            </div>

            {/* Body */}
            <div style={{ padding: '6px 20px 16px' }}>
              <DataRow icon={CreditCard} label="Documento" value={`${result.document_type} ${result.document_number}`} />
              <DataRow icon={Calendar} label="Fecha de nacimiento" value={fmt(result.birth_date)} />
              <DataRow icon={Calendar} label="Venc. documento" value={fmt(result.document_expires_at)} />
              <DataRow icon={MapPin} label="País" value={result.country} />
              <DataRow icon={Hash} label="Estado pasajero" value={result.passenger_status} />
              <DataRow icon={Hash} label="Bonificación" value={result.bonus} />
              <DataRow icon={Phone} label="Teléfono" value={result.phone || result.mobile} />
              <DataRow icon={Mail} label="Email" value={result.email} />

              {result.schools?.length > 0 && (
                <div style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF4F8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <School size={16} color="#1A4B77" />
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Colegios</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 42 }}>
                    {result.schools.map(s => (
                      <span key={s.id} style={{ padding: '4px 10px', background: '#EEF4F8', borderRadius: 20, fontSize: 13, color: '#1A4B77', fontWeight: 600 }}>{s.name}</span>
                    ))}
                  </div>
                </div>
              )}

              {result.departures?.length > 0 && (
                <div style={{ padding: '10px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF4F8', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Bus size={16} color="#1A4B77" />
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Salidas</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 42 }}>
                    {result.departures.map(d => (
                      <span key={d.id} style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                        {d.type === 'MICRO' ? '🚌' : '✈️'} {d.name}
                        {d.code && <span style={{ color: '#94A3B8', fontSize: 11, marginLeft: 6 }}>{d.code}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan again button */}
        {(phase === 'found' || phase === 'notfound') && (
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#1A4B77', color: '#fff', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,75,119,.3)' }}>
            <RefreshCw size={18} /> Escanear otro
          </button>
        )}
      </div>
    </div>
  );
}
