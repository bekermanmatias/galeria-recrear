import { useEffect, useRef, useState } from 'react';
import { X, QrCode, Check, Link, Unlink, AlertCircle } from 'lucide-react';
import { api, type Passenger } from '../../lib/api';

// jsQR loaded from CDN via dynamic import fallback
declare const jsQR: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | undefined;

interface Props {
  passenger: Passenger;
  onClose: () => void;
  onLinked: (code: string) => void;
  onUnlinked: () => void;
}

export default function WristbandScannerModal({ passenger, onClose, onLinked, onUnlinked }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [phase, setPhase] = useState<'scanning' | 'confirm' | 'success' | 'error' | 'unlink'>('scanning');
  const [detectedCode, setDetectedCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [jsQrLoaded, setJsQrLoaded] = useState(false);

  // Load jsQR dynamically
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      script.onload = () => setJsQrLoaded(true);
      script.onerror = () => setCameraError('No se pudo cargar el lector de QR. Verificá tu conexión.');
      document.head.appendChild(script);
    } else {
      setJsQrLoaded(true);
    }
  }, []);

  // Start camera
  useEffect(() => {
    if (!jsQrLoaded || phase !== 'scanning') return;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => setCameraError('No se pudo acceder a la cámara. Verificá los permisos del navegador.'));
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [jsQrLoaded, phase]);

  // Scan loop
  useEffect(() => {
    if (phase !== 'scanning' || !jsQrLoaded) return;
    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const jsQrFn = (window as any).jsQR as typeof jsQR;
          if (jsQrFn) {
            const result = jsQrFn(imageData.data, imageData.width, imageData.height);
            if (result?.data) {
              // Stop camera and show confirm
              streamRef.current?.getTracks().forEach(t => t.stop());
              streamRef.current = null;
              cancelAnimationFrame(rafRef.current);
              setDetectedCode(result.data.trim());
              setPhase('confirm');
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    };
    rafRef.current = requestAnimationFrame(scan);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, jsQrLoaded]);

  const handleConfirm = async () => {
    setBusy(true);
    setErrMsg('');
    try {
      await api.linkWristband(passenger.id, detectedCode);
      setPhase('success');
      onLinked(detectedCode);
    } catch (e: any) {
      setErrMsg(e.message || 'No se pudo vincular la pulsera.');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    setBusy(true);
    setErrMsg('');
    try {
      await api.unlinkWristband(passenger.id);
      setPhase('success');
      onUnlinked();
    } catch (e: any) {
      setErrMsg(e.message || 'No se pudo desvincular la pulsera.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.75)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: 'min(100%, 440px)', background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.35)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1A4B77', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <QrCode size={20} />
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {phase === 'unlink' ? 'Desvincular pulsera' : 'Vincular pulsera'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 0, borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={18} />
          </button>
        </div>

        {/* Passenger name strip */}
        <div style={{ padding: '12px 20px', background: '#F1F5F9', borderBottom: '1px solid #E5E7EB', fontSize: 13, color: '#475569' }}>
          <strong style={{ color: '#1A4B77' }}>{passenger.full_name}</strong>
          {passenger.wristband_code && (
            <span style={{ marginLeft: 10, padding: '2px 8px', background: '#DCFCE7', color: '#15803D', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
              Pulsera: {passenger.wristband_code}
            </span>
          )}
        </div>

        <div style={{ padding: 20 }}>
          {/* SCANNING phase */}
          {phase === 'scanning' && (
            <>
              {cameraError ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#B91C1C', background: '#FEF2F2', borderRadius: 10, marginBottom: 12, fontSize: 14 }}>
                  <AlertCircle size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
                  {cameraError}
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '1', marginBottom: 14 }}>
                    <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {/* Scanning overlay */}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: '60%', aspectRatio: '1', border: '3px solid rgba(255,255,255,.8)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' }} />
                    </div>
                    <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }}>
                      Apuntá al QR de la pulsera
                    </div>
                  </div>
                  {!jsQrLoaded && <p style={{ textAlign: 'center', color: '#64748B', fontSize: 13 }}>Cargando lector QR…</p>}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </>
              )}
              {passenger.wristband_code && (
                <button onClick={() => setPhase('unlink')} style={{ width: '100%', padding: '10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontWeight: 600, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Unlink size={16} /> Desvincular pulsera actual ({passenger.wristband_code})
                </button>
              )}
            </>
          )}

          {/* CONFIRM phase */}
          {phase === 'confirm' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#DBEAFE', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <QrCode size={36} color="#1A4B77" />
              </div>
              <p style={{ fontSize: 15, color: '#1A4B77', fontWeight: 700, margin: '0 0 6px' }}>Código detectado</p>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', letterSpacing: 4, margin: '0 0 6px', fontFamily: 'monospace' }}>{detectedCode}</div>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>¿Vincular esta pulsera a <strong>{passenger.full_name}</strong>?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setDetectedCode(''); setPhase('scanning'); }} style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Volver a escanear
                </button>
                <button onClick={handleConfirm} disabled={busy} style={{ flex: 1, padding: '10px', background: '#1A4B77', border: 0, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontSize: 14, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Vinculando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {/* UNLINK confirm */}
          {phase === 'unlink' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <Unlink size={36} color="#B91C1C" />
              </div>
              <p style={{ fontSize: 15, color: '#B91C1C', fontWeight: 700, margin: '0 0 6px' }}>Desvincular pulsera</p>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 4px' }}>Código actual: <strong style={{ fontFamily: 'monospace', fontSize: 16 }}>{passenger.wristband_code}</strong></p>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>¿Desvincular de <strong>{passenger.full_name}</strong>?</p>
              {errMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginBottom: 12 }}>{errMsg}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPhase('scanning')} style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Cancelar
                </button>
                <button onClick={handleUnlink} disabled={busy} style={{ flex: 1, padding: '10px', background: '#B91C1C', border: 0, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: busy ? 'wait' : 'pointer', fontSize: 14, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Desvinculando…' : 'Desvincular'}
                </button>
              </div>
            </div>
          )}

          {/* SUCCESS phase */}
          {phase === 'success' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#DCFCE7', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <Check size={36} color="#15803D" />
              </div>
              <p style={{ fontSize: 16, color: '#15803D', fontWeight: 700, margin: '0 0 6px' }}>¡Listo!</p>
              <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px' }}>
                {detectedCode ? `Pulsera ${detectedCode} vinculada a ${passenger.full_name}` : `Pulsera desvinculada de ${passenger.full_name}`}
              </p>
              <button onClick={onClose} style={{ padding: '10px 28px', background: '#1A4B77', border: 0, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Cerrar
              </button>
            </div>
          )}

          {/* ERROR phase */}
          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                <AlertCircle size={36} color="#B91C1C" />
              </div>
              <p style={{ fontSize: 16, color: '#B91C1C', fontWeight: 700, margin: '0 0 6px' }}>No se pudo vincular</p>
              <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 20px' }}>{errMsg}</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { setPhase('scanning'); setErrMsg(''); setDetectedCode(''); }} style={{ padding: '10px 24px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8, color: '#475569', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Reintentar
                </button>
                <button onClick={onClose} style={{ padding: '10px 24px', background: '#1A4B77', border: 0, borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
