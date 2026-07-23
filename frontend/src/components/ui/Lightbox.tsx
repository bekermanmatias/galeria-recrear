import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Share2, X, ZoomIn, ZoomOut } from 'lucide-react';

interface LightboxProps {
  src: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  alt?: string;
  onClose: () => void;
  actions?: React.ReactNode;
  info?: React.ReactNode;
  downloadUrl?: string;
  downloadName?: string;
  isDeleted?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
}

export default function Lightbox({
  src, mediaType = 'IMAGE', alt = '', onClose, actions, info,
  downloadUrl, downloadName, isDeleted, onNext, onPrev,
}: LightboxProps) {
  const isVideo = mediaType === 'VIDEO';
  const [zoom, setZoom] = useState(.75);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [compact, setCompact] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didDrag = useRef(false);

  useEffect(() => {
    const update = () => setCompact(window.innerWidth < 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setZoom(.75);
    setPan({ x: 0, y: 0 });
    setMessage('');
  }, [src]);

  const download = async () => {
    if (downloading) return;
    try {
      setDownloading(true);
      setMessage('');
      const response = await fetch(downloadUrl || src, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName || alt || `recrear-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setMessage('No se pudo descargar');
    } finally {
      setDownloading(false);
    }
  };

  const share = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      setMessage('');
      const response = await fetch(downloadUrl || src, { credentials: 'include' });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const file = new File([blob], downloadName || alt || `recrear-${Date.now()}`, { type: blob.type });
      const shareData = { files: [file], title: isVideo ? 'Video de Recrear' : 'Foto de Recrear' };
      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }
      await download();
      setMessage('Archivo listo para compartir');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('No se pudo compartir');
    } finally {
      setSharing(false);
    }
  };

  const navigate = (direction: 'prev' | 'next') => {
    if (direction === 'prev') onPrev?.();
    else onNext?.();
  };

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (isVideo || zoom > 1 || event.changedTouches.length === 0) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Date.now() - touchStart.current.time < 700 && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      navigate(dx < 0 ? 'next' : 'prev');
    }
  };

  const beginDrag = (event: React.PointerEvent<HTMLImageElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    didDrag.current = false;
    dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!dragging) return;
    const x = event.clientX - dragStart.current.x;
    const y = event.clientY - dragStart.current.y;
    if (Math.abs(x) + Math.abs(y) > 3) didDrag.current = true;
    setPan({ x: dragStart.current.panX + x, y: dragStart.current.panY + y });
  };

  const endDrag = () => setDragging(false);

  const iconButton: React.CSSProperties = {
    width: compact ? 42 : 46, height: compact ? 42 : 46, display: 'grid', placeItems: 'center',
    border: 0, borderRadius: '50%', color: '#fff', cursor: 'pointer',
    background: 'rgba(15,23,42,.72)', boxShadow: '0 4px 16px rgba(0,0,0,.24)',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Reproductor de video' : 'Vista previa de imagen'}
      onClick={onClose}
      onWheel={event => {
        if (!isVideo) {
          event.preventDefault();
          setZoom(value => Math.max(.5, Math.min(4, value + (event.deltaY < 0 ? .25 : -.25))));
        }
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,6,23,.91)', display: 'grid', placeItems: 'center', padding: compact ? '64px 12px 92px' : '76px 88px 104px', boxSizing: 'border-box' }}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', minHeight: 0, position: 'relative' }}
      >
        {isVideo ? (
          <video
            key={src}
            src={src}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onClick={event => event.stopPropagation()}
            style={{ display: 'block', width: 'auto', maxWidth: compact ? '100%' : '76vw', height: 'auto', maxHeight: compact ? '100%' : '72vh', borderRadius: compact ? 8 : 12, background: '#000', boxShadow: '0 18px 52px rgba(0,0,0,.38)', opacity: isDeleted ? .55 : 1 }}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            draggable={false}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={event => event.stopPropagation()}
            style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: compact ? '92vw' : '70vw', maxHeight: compact ? 'calc(100vh - 170px)' : '66vh', objectFit: 'contain', cursor: dragging ? 'grabbing' : 'grab', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center', transition: dragging ? 'none' : 'transform .18s ease-out', userSelect: 'none', touchAction: 'none', opacity: isDeleted ? .55 : 1 }}
          />
        )}
      </div>

      <button onClick={event => { event.stopPropagation(); onClose(); }} aria-label="Cerrar" style={{ ...iconButton, position: 'absolute', top: compact ? 12 : 24, right: compact ? 12 : 24 }}><X size={compact ? 21 : 24}/></button>

      {onPrev && <button onClick={event => { event.stopPropagation(); navigate('prev'); }} aria-label="Anterior" style={{ ...iconButton, position: 'absolute', left: compact ? 8 : 24, top: '50%', transform: 'translateY(-50%)' }}><ChevronLeft size={compact ? 24 : 30}/></button>}
      {onNext && <button onClick={event => { event.stopPropagation(); navigate('next'); }} aria-label="Siguiente" style={{ ...iconButton, position: 'absolute', right: compact ? 8 : 24, top: '50%', transform: 'translateY(-50%)' }}><ChevronRight size={compact ? 24 : 30}/></button>}

      <div onClick={event => event.stopPropagation()} style={{ position: 'absolute', bottom: compact ? 12 : 28, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100% - 24px)', display: 'flex', alignItems: 'center', gap: compact ? 3 : 6, padding: compact ? 6 : 8, borderRadius: 12, background: 'rgba(24,24,27,.88)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 26px rgba(0,0,0,.26)', color: '#fff', whiteSpace: 'nowrap' }}>
        {!isVideo && <><button onClick={() => setZoom(value => Math.max(.5, value - .25))} aria-label="Alejar" style={{ ...iconButton, width: 34, height: 34, background: 'transparent', boxShadow: 'none' }}><ZoomOut size={18}/></button><span style={{ fontSize: 12, minWidth: 42, textAlign: 'center', fontWeight: 700 }}>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(value => Math.min(4, value + .25))} aria-label="Acercar" style={{ ...iconButton, width: 34, height: 34, background: 'transparent', boxShadow: 'none' }}><ZoomIn size={18}/></button></>}
        {info && <span style={{ borderLeft: !isVideo ? '1px solid rgba(255,255,255,.18)' : 0, padding: compact ? '0 5px' : '0 8px', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{info}</span>}
        {<><button onClick={share} disabled={sharing} title="Compartir" style={{ ...iconButton, width: 34, height: 34, background: 'transparent', boxShadow: 'none', opacity: sharing ? .6 : 1 }}><Share2 size={18}/></button><button onClick={download} disabled={downloading} title="Descargar" style={{ ...iconButton, width: 34, height: 34, background: 'transparent', boxShadow: 'none', opacity: downloading ? .6 : 1 }}><Download size={18}/></button></>}
        {actions}
      </div>
      {message && <div role="status" style={{ position: 'absolute', bottom: compact ? 66 : 84, left: '50%', transform: 'translateX(-50%)', padding: '7px 10px', borderRadius: 7, background: 'rgba(15,23,42,.9)', color: '#fff', fontSize: 12 }}>{message}</div>}
    </div>
  );
}
