import { useState } from 'react';
import { Image as ImageIcon, Download, Search, X, ZoomIn, ZoomOut } from 'lucide-react';

const PHOTOS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  url: `/placeholder-photo-${i}.jpg`, 
  colegio: i % 2 === 0 ? 'Escuela Normal' : 'Colegio San Luis',
  actividad: i % 3 === 0 ? 'Pileta' : 'Cabalgata',
  turno: i % 2 === 0 ? 'Mañana' : 'Tarde',
  fecha: i % 2 === 0 ? '2026-07-14' : '2026-07-15',
}));

export default function AdminGaleria() {
  const [filtroColegio, setFiltroColegio] = useState('Todos');
  const [filtroTurno, setFiltroTurno] = useState('Todos');
  const [filtroActividad, setFiltroActividad] = useState('Todos');
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  
  const filteredPhotos = PHOTOS.filter(p => {
    const matchColegio = filtroColegio === 'Todos' || p.colegio === filtroColegio;
    const matchTurno = filtroTurno === 'Todos' || p.turno === filtroTurno;
    const matchActividad = filtroActividad === 'Todos' || p.actividad === filtroActividad;
    const matchFechaInicio = !filtroFechaInicio || p.fecha >= filtroFechaInicio;
    const matchFechaFin = !filtroFechaFin || p.fecha <= filtroFechaFin;
    
    return matchColegio && matchTurno && matchActividad && matchFechaInicio && matchFechaFin;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1A4B77' }}>Galería</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Vista global de todas las fotos aprobadas en el sistema.</p>
          </div>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', background: '#F4F4F5', color: '#1A4B77',
              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            <Download size={16} /> Descargar Lote
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <select
            value={filtroColegio}
            onChange={(e) => setFiltroColegio(e.target.value)}
            style={{
              padding: '8px 16px', border: '1px solid #E4E4E7', borderRadius: '6px',
              fontSize: '13px', color: '#09090B', outline: 'none'
            }}
          >
            <option value="Todos">Todos los colegios</option>
            <option value="Escuela Normal">Escuela Normal</option>
            <option value="Colegio San Luis">Colegio San Luis</option>
          </select>
          <select
            value={filtroTurno}
            onChange={(e) => setFiltroTurno(e.target.value)}
            style={{
              padding: '8px 16px', border: '1px solid #E4E4E7', borderRadius: '6px',
              fontSize: '13px', color: '#09090B', outline: 'none'
            }}
          >
            <option value="Todos">Todos los turnos</option>
            <option value="Mañana">Mañana</option>
            <option value="Tarde">Tarde</option>
            <option value="Noche">Noche</option>
          </select>
          <select
            value={filtroActividad}
            onChange={(e) => setFiltroActividad(e.target.value)}
            style={{
              padding: '8px 16px', border: '1px solid #E4E4E7', borderRadius: '6px',
              fontSize: '13px', color: '#09090B', outline: 'none'
            }}
          >
            <option value="Todos">Todas las actividades</option>
            <option value="Cabalgata">Cabalgata</option>
            <option value="Pileta">Pileta</option>
            <option value="Hotel">Hotel</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F4F4F5', padding: '4px 8px', borderRadius: '6px' }}>
            <span style={{ fontSize: '12px', color: '#71717A', fontWeight: 500 }}>Desde:</span>
            <input
              type="date"
              value={filtroFechaInicio}
              onChange={(e) => setFiltroFechaInicio(e.target.value)}
              style={{ padding: '4px', border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', color: '#09090B' }}
            />
            <span style={{ fontSize: '12px', color: '#71717A', fontWeight: 500 }}>Hasta:</span>
            <input
              type="date"
              value={filtroFechaFin}
              onChange={(e) => setFiltroFechaFin(e.target.value)}
              style={{ padding: '4px', border: 'none', background: 'transparent', fontSize: '13px', outline: 'none', color: '#09090B' }}
            />
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '4px',
      }}>
        {filteredPhotos.map((photo) => (
          <div
            key={photo.id}
            style={{
              position: 'relative',
              aspectRatio: '1',
              background: '#F4F4F5',
              cursor: 'pointer',
              overflow: 'hidden'
            }}
            onClick={() => setSelectedPhoto(photo.url)}
            onMouseEnter={e => {
              const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = '1';
            }}
            onMouseLeave={e => {
              const overlay = e.currentTarget.querySelector('.overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = '0';
            }}
          >
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={32} color="#A1A1AA" strokeWidth={1} />
            </div>

            <div
              className="overlay"
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                opacity: 0,
                transition: 'opacity 0.2s',
                display: 'flex', flexDirection: 'column',
                justifyContent: 'flex-end', padding: '12px',
              }}
            >
              <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{photo.colegio}</span>
              <span style={{ color: '#E4E4E7', fontSize: '11px' }}>{photo.actividad} • {photo.turno}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <LightboxViewer
          src={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </div>
  );
}

function LightboxViewer({ src, onClose }: { src: string, onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div 
        style={{ flex: 1, width: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: zoom > 1 ? 'grab' : 'default' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={src} 
          alt="Vista completa" 
          style={{ 
            maxWidth: '100%', maxHeight: '100%', 
            objectFit: 'contain', 
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease-out'
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
          onClick={() => setZoom(z => Math.max(0.5, z - 0.5))}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomOut size={20} />
        </button>
        <span style={{ color: 'white', display: 'flex', alignItems: 'center', fontSize: '13px', minWidth: '48px', justifyContent: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button 
          onClick={() => setZoom(z => Math.min(3, z + 0.5))}
          style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}
        >
          <ZoomIn size={20} />
        </button>
      </div>
    </div>
  );
}
