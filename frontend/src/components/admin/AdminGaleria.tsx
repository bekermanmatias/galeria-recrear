import { useState } from 'react';
import { Image as ImageIcon, Download, Search } from 'lucide-react';

const PHOTOS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  url: `/placeholder-photo-${i}.jpg`, // Just a visual mock
  colegio: i % 2 === 0 ? 'Escuela Normal' : 'Colegio San Luis',
  actividad: i % 3 === 0 ? 'Pileta' : 'Cabalgata',
  turno: i % 2 === 0 ? 'Mañana' : 'Tarde',
}));

export default function AdminGaleria() {
  const [filtroColegio, setFiltroColegio] = useState('Todos');
  
  const filteredPhotos = PHOTOS.filter(p => filtroColegio === 'Todos' || p.colegio === filtroColegio);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1A4B77' }}>Galería Total</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Vista global de todas las fotos aprobadas en el sistema.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
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
    </div>
  );
}
