import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  actions?: React.ReactNode;
  isDeleted?: boolean;
}

export default function Lightbox({ src, alt = '', onClose, actions, isDeleted }: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

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
      // If not zoomed in, maybe we just close if they click the background, but the image itself stops propagation.
      return;
    }
    e.preventDefault(); // Prevent default image drag
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

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <div 
      onClick={onClose}
      onWheel={handleWheel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden' // Prevent scrollbars
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
        
        {actions || (
           <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = src;
                  link.download = `recrear-${Date.now()}.jpg`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={20} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Descargar</span>
              </button>
           </>
        )}
      </div>
    </div>
  );
}
