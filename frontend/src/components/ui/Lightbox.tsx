import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, Share2, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  src: string;
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

export default function Lightbox({ src, alt = '', onClose, actions, info, downloadUrl, downloadName, isDeleted, onNext, onPrev }: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const dragStart = useRef({ x: 0, y: 0 });
  const touchStart = useRef({ x: 0, y: 0, time: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    setZoom(prev => {
      const newZoom = e.deltaY < 0 ? Math.min(prev + 0.25, 4) : Math.max(prev - 0.25, 0.5);
      if (newZoom <= 1) {
         setPan({x: 0, y: 0});
      }
      return newZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) {
      return;
    }
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (zoom > 1 || e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const elapsed = Date.now() - touchStart.current.time;
    const isHorizontalSwipe = Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3;

    if (!isHorizontalSwipe || elapsed > 700) return;

    e.stopPropagation();
    if (deltaX < 0) {
      onNext?.();
    } else {
      onPrev?.();
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const handleDownload = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      setDownloadError('');
      const response = await fetch(downloadUrl || src, { credentials: 'include' });
      if (!response.ok) throw new Error('No se pudo descargar la imagen');
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = downloadName || alt || `recrear-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      setDownloadError('No se pudo descargar');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    try {
      setIsSharing(true);
      setShareStatus('');
      const response = await fetch(downloadUrl || src, { credentials: 'include' });
      if (!response.ok) throw new Error('No se pudo obtener la imagen');
      const blob = await response.blob();
      const filename = downloadName || alt || `recrear-${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      const shareData = { files: [file], title: 'Foto de Recrear' };

      if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
        await navigator.share(shareData);
        return;
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setShareStatus('Se descargó para compartir');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('No se pudo compartir');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      onWheel={handleWheel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{ 
          flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' 
        }}
        onClick={onClose}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img 
          src={src} 
          alt={alt} 
          draggable={false}
          onClick={(e) => {
            e.stopPropagation();
            if (zoom <= 1) {
              setZoom(2);
            }
          }}
          style={{ 
            maxWidth: '90%', maxHeight: '90%', 
            objectFit: 'contain', 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            opacity: isDeleted ? 0.5 : 1
          }}
        />
      </div>

      <button 
        onClick={onClose}
        style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'rgba(255, 255, 255, 0.1)', border: 'none',
          borderRadius: '50%', width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', zIndex: 10
        }}
      >
        <X size={24} />
      </button>

      {onPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev(); }}
          style={{
            position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#FFFFFF', transition: 'background 0.2s', zIndex: 10
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
        >
          <ChevronLeft size={32} strokeWidth={1.5} />
        </button>
      )}

      {onNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext(); }}
          style={{
            position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', padding: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#FFFFFF', transition: 'background 0.2s', zIndex: 10
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
        >
          <ChevronRight size={32} strokeWidth={1.5} />
        </button>
      )}

      {/* Toolbar */}
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', bottom: '32px',
          background: 'rgba(39, 39, 42, 0.8)', backdropFilter: 'blur(8px)',
          padding: '8px', borderRadius: '12px',
          display: 'flex', gap: '8px', zIndex: 10
        }}
      >
        <button 
          onClick={() => {
             setZoom(z => {
                const newZoom = Math.max(0.5, z - 0.5);
                if (newZoom <= 1) setPan({x: 0, y: 0});
                return newZoom;
             });
          }}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomOut size={20} />
        </button>
        <span style={{ color: 'white', display: 'flex', alignItems: 'center', fontSize: '13px', minWidth: '48px', justifyContent: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={() => setZoom(z => Math.min(4, z + 0.5))}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomIn size={20} />
        </button>
        {info && <><div style={{ width: '1px', height: 22, background: 'rgba(255,255,255,.2)', margin: '0 4px' }} /><span style={{ color: '#fff', display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', padding: '0 4px' }}>{info}</span></>}
        
        {actions || (
           <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button
                onClick={handleShare}
                disabled={isSharing}
                title={shareStatus || 'Compartir en redes sociales'}
                style={{ background: 'transparent', border: 'none', color: shareStatus.startsWith('No') ? '#FCA5A5' : 'white', cursor: isSharing ? 'wait' : 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSharing ? .65 : 1 }}
              >
                <Share2 size={20} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{isSharing ? 'Preparando…' : shareStatus || 'Compartir'}</span>
              </button>
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                title={downloadError || 'Descargar archivo original'}
                style={{ background: 'transparent', border: 'none', color: downloadError ? '#FCA5A5' : 'white', cursor: isDownloading ? 'wait' : 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', opacity: isDownloading ? .65 : 1 }}
              >
                <Download size={20} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{isDownloading ? 'Descargando…' : downloadError || 'Descargar'}</span>
              </button>
           </>
        )}
      </div>
    </div>
  );
}










