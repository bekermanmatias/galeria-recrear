import { useState, useMemo } from 'react';
import { Image as ImageIcon, School, Download, CheckSquare, Square, ArrowLeft, Search, SlidersHorizontal, Camera, ChevronDown, Sun, CloudSun, Moon } from 'lucide-react';
import DashboardLayout from '../layout/DashboardLayout';
import Lightbox from '../ui/Lightbox';

// ─── Mock Data ───────────────────────────────────────────────────────────────

const COLEGIOS_USUARIO = [
  { id: 'colegio-1', nombre: 'Colegio San Luis', codigo: 'CSL' },
  { id: 'colegio-2', nombre: 'Instituto Belgrano', codigo: 'IB' },
];

interface Album {
  id: string;
  colegioId: string;
  actividad: string;
  fecha: string;
  turno: 'Mañana' | 'Tarde' | 'Noche';
  totalFotos: number;
  seed: string;
}

const ALBUMS: Album[] = [
  { id: 'a1', colegioId: 'colegio-1', actividad: 'Cabalgata', fecha: '14 Jul 2026', turno: 'Mañana', totalFotos: 38, seed: 'cabalg1' },
  { id: 'a2', colegioId: 'colegio-1', actividad: 'Pileta', fecha: '14 Jul 2026', turno: 'Tarde', totalFotos: 24, seed: 'pileta1' },
  { id: 'a3', colegioId: 'colegio-1', actividad: 'Fogón', fecha: '14 Jul 2026', turno: 'Noche', totalFotos: 17, seed: 'fogon1' },
  { id: 'a4', colegioId: 'colegio-1', actividad: 'Excursión al río', fecha: '15 Jul 2026', turno: 'Mañana', totalFotos: 52, seed: 'excur1' },
  { id: 'a5', colegioId: 'colegio-1', actividad: 'Taller de arte', fecha: '15 Jul 2026', turno: 'Tarde', totalFotos: 29, seed: 'taller1' },
  { id: 'a6', colegioId: 'colegio-1', actividad: 'Mateada grupal', fecha: '16 Jul 2026', turno: 'Mañana', totalFotos: 21, seed: 'mateada1' },
  { id: 'a7', colegioId: 'colegio-2', actividad: 'Cabalgata', fecha: '12 Jul 2026', turno: 'Mañana', totalFotos: 44, seed: 'ibc1' },
  { id: 'a8', colegioId: 'colegio-2', actividad: 'Noche de talentos', fecha: '12 Jul 2026', turno: 'Noche', totalFotos: 33, seed: 'ibt1' },
  { id: 'a9', colegioId: 'colegio-2', actividad: 'Deportes en la naturaleza', fecha: '13 Jul 2026', turno: 'Mañana', totalFotos: 61, seed: 'ibdeport1' },
];

const TURNOS_FILTER = ['Todos', 'Mañana', 'Tarde', 'Noche'] as const;
const SORT_OPTIONS = ['Más reciente', 'Más antiguo', 'Más fotos'] as const;

const getTurnoIcon = (turno: string, size = 14) => {
  switch (turno) {
    case 'Mañana': return <Sun size={size} />;
    case 'Tarde': return <CloudSun size={size} />;
    case 'Noche': return <Moon size={size} />;
    default: return null;
  }
};

// ─── AlbumCard Component ──────────────────────────────────────────────────────

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        cursor: 'pointer',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1';
        const img = e.currentTarget.querySelector('.album-cover') as HTMLElement;
        if (img) img.style.transform = 'scale(1.04)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#E2E8F0';
        const img = e.currentTarget.querySelector('.album-cover') as HTMLElement;
        if (img) img.style.transform = 'scale(1)';
      }}
    >
      {/* Split Grid Collage */}
      <div style={{ position: 'relative', height: '200px', display: 'flex', gap: '3px', background: '#E2E8F0', overflow: 'hidden' }}>
        {/* Hero image (70%) */}
        <div style={{ flex: '0 0 68%', position: 'relative', overflow: 'hidden' }}>
          <img
            className="album-cover"
            src={`https://picsum.photos/seed/${album.seed}/600/600`}
            alt={album.actividad}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
          />
        </div>

        {/* Right column: two stacked images (30%) */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <img
              src={`https://picsum.photos/seed/${album.seed}b/400/300`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
            />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <img
              src={`https://picsum.photos/seed/${album.seed}c/400/300`}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
            />
          </div>
        </div>

        {/* Photo count badge */}
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(12px)',
          color: '#FFFFFF', fontSize: '12px', fontWeight: 600,
          padding: '3px 10px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <Camera size={12} />
          {album.totalFotos}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
          {album.actividad}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B' }}>
          {album.fecha}
          <span style={{ fontSize: '10px' }}>•</span>
          Turno {album.turno}
        </div>
      </div>
    </div>
  );
}

// ─── PhotoGrid (inside an album) ──────────────────────────────────────────────

function AlbumView({
  album,
  onBack,
}: {
  album: Album;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const photos = Array.from({ length: album.totalFotos }, (_, i) => i);

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handlePhotoClick = (i: number) => {
    if (selectionMode) { toggleSelect(i); return; }
    setLightbox(i);
  };

  const handleSelectAll = () => {
    if (selected.size === photos.length) setSelected(new Set());
    else setSelected(new Set(photos));
  };

  const exitSelection = () => { setSelectionMode(false); setSelected(new Set()); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '0 24px',
        height: '80px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#F1F5F9', border: 'none', borderRadius: '8px',
              padding: '8px 14px', cursor: 'pointer', color: '#475569',
              fontSize: '13px', fontWeight: 500, transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E2E8F0')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F1F5F9')}
          >
            <ArrowLeft size={16} />
            Álbumes
          </button>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#1A4B77', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {album.actividad}
            </div>
            <div style={{ fontSize: '13px', color: '#64748B' }}>
              {album.fecha} · Turno {album.turno} · {album.totalFotos} fotos
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectionMode ? (
            <>
              <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                {selected.size} seleccionada{selected.size !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleSelectAll}
                style={{
                  background: '#F1F5F9', border: 'none', borderRadius: '8px',
                  padding: '8px 14px', cursor: 'pointer', color: '#475569',
                  fontSize: '13px', fontWeight: 500,
                }}
              >
                {selected.size === photos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              {selected.size > 0 && (
                <button
                  style={{
                    background: '#1A4B77', border: 'none', borderRadius: '8px',
                    padding: '8px 14px', cursor: 'pointer', color: '#FFFFFF',
                    fontSize: '13px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  <Download size={15} />
                  Descargar ({selected.size})
                </button>
              )}
              <button
                onClick={exitSelection}
                style={{
                  background: 'none', border: '1px solid #E2E8F0', borderRadius: '8px',
                  padding: '8px 14px', cursor: 'pointer', color: '#64748B',
                  fontSize: '13px', fontWeight: 500,
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#F1F5F9', border: 'none', borderRadius: '8px',
                  padding: '8px 14px', cursor: 'pointer', color: '#475569',
                  fontSize: '13px', fontWeight: 500, transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#E2E8F0')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F1F5F9')}
              >
                <CheckSquare size={15} />
                Seleccionar
              </button>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#1A4B77', border: 'none', borderRadius: '8px',
                  padding: '8px 14px', cursor: 'pointer', color: '#FFFFFF',
                  fontSize: '13px', fontWeight: 600,
                }}
              >
                <Download size={15} />
                Descargar todo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '12px',
        }}>
          {photos.map(i => {
            const isSelected = selected.has(i);
            return (
              <div
                key={i}
                onClick={() => handlePhotoClick(i)}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  outline: isSelected ? '3px solid #1A4B77' : '3px solid transparent',
                  outlineOffset: '0px',
                  transition: 'outline 0.15s ease, transform 0.15s ease',
                  transform: isSelected ? 'scale(0.97)' : 'scale(1)',
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)';
                  if (selectionMode) {
                    const ov = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                    if (ov) ov.style.opacity = '1';
                  }
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                  if (selectionMode && !isSelected) {
                    const ov = e.currentTarget.querySelector('.photo-overlay') as HTMLElement;
                    if (ov) ov.style.opacity = '0';
                  }
                }}
              >
                <img
                  src={`https://picsum.photos/seed/${album.seed}${i}/400/400`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* Selection checkbox */}
                <div
                  className="photo-overlay"
                  style={{
                    position: 'absolute', inset: 0,
                    background: isSelected ? 'rgba(26,75,119,0.2)' : 'rgba(0,0,0,0.12)',
                    opacity: isSelected || selectionMode ? 1 : 0,
                    transition: 'opacity 0.2s',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
                    padding: '8px',
                  }}
                >
                  <div style={{
                    width: '22px', height: '22px',
                    borderRadius: '50%',
                    background: isSelected ? '#1A4B77' : 'rgba(255,255,255,0.85)',
                    border: `2px solid ${isSelected ? '#1A4B77' : 'rgba(255,255,255,0.9)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    transition: 'all 0.15s',
                  }}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <Lightbox
          src={`https://picsum.photos/seed/${album.seed}${lightbox}/1200/800`}
          onClose={() => setLightbox(null)}
          onNext={lightbox < photos.length - 1 ? () => setLightbox(p => p !== null ? p + 1 : p) : undefined}
          onPrev={lightbox > 0 ? () => setLightbox(p => p !== null ? p - 1 : p) : undefined}
        />
      )}
    </div>
  );
}

// ─── Main Portal ──────────────────────────────────────────────────────────────

export default function ParentPortal() {
  const [colegioActivo, setColegioActivo] = useState(COLEGIOS_USUARIO[0].id);
  const [albumAbierto, setAlbumAbierto] = useState<Album | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [turnoFilter, setTurnoFilter] = useState<typeof TURNOS_FILTER[number]>('Todos');
  const [sort, setSort] = useState<typeof SORT_OPTIONS[number]>('Más reciente');
  const [sortOpen, setSortOpen] = useState(false);

  const TABS = COLEGIOS_USUARIO.map(c => ({
    id: c.id,
    label: c.nombre,
    icon: School,
  }));

  const albumsFiltrados = useMemo(() => {
    let list = ALBUMS.filter(a => a.colegioId === colegioActivo);
    if (turnoFilter !== 'Todos') list = list.filter(a => a.turno === turnoFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.actividad.toLowerCase().includes(q) ||
        a.fecha.toLowerCase().includes(q)
      );
    }
    if (sort === 'Más fotos') list = [...list].sort((a, b) => b.totalFotos - a.totalFotos);
    else if (sort === 'Más antiguo') list = [...list].reverse();
    return list;
  }, [colegioActivo, turnoFilter, searchQuery, sort]);

  const colegio = COLEGIOS_USUARIO.find(c => c.id === colegioActivo)!;

  return (
    <DashboardLayout
      role="parent"
      tabs={TABS}
      activeTab={colegioActivo}
      onTabChange={(id) => { setColegioActivo(id); setAlbumAbierto(null); }}
    >
      {albumAbierto ? (
        <AlbumView album={albumAbierto} onBack={() => setAlbumAbierto(null)} />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Page header + filters */}
          <div style={{
            padding: '20px 24px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flexShrink: 0,
          }}>
            {/* Nivel Superior */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#1A4B77', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {colegio.nombre}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Buscar álbum..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                      outline: 'none',
                      color: '#1E293B',
                      width: '240px',
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = '#1A4B77'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                  />
                </div>

                {/* Sort */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setSortOpen(!sortOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#F1F5F9', border: 'none', borderRadius: '8px',
                      padding: '8px 12px', cursor: 'pointer', color: '#475569',
                      fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
                      height: '37px', width: '140px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <SlidersHorizontal size={14} />
                      {sort}
                    </div>
                    <ChevronDown size={12} style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                  </button>
                  {sortOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                      background: '#FFFFFF', borderRadius: '10px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      border: '1px solid #E2E8F0',
                      zIndex: 50, overflow: 'hidden', minWidth: '160px',
                    }}>
                      {SORT_OPTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => { setSort(s); setSortOpen(false); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '10px 14px', border: 'none',
                            background: sort === s ? '#F1F5F9' : 'transparent',
                            color: sort === s ? '#1A4B77' : '#374151',
                            fontSize: '13px', fontWeight: sort === s ? 600 : 400,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => { if (sort !== s) (e.currentTarget.style.background = '#F8FAFC'); }}
                          onMouseLeave={e => { if (sort !== s) (e.currentTarget.style.background = 'transparent'); }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Nivel Inferior */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Turno filter pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {TURNOS_FILTER.map(t => (
                  <button
                    key={t}
                    onClick={() => setTurnoFilter(t)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      border: 'none',
                      background: turnoFilter === t ? '#1A4B77' : '#F1F5F9',
                      color: turnoFilter === t ? '#FFFFFF' : '#475569',
                      fontSize: '12px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ width: '1px', height: '14px', background: '#E2E8F0' }} />

              <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
                {albumsFiltrados.length} álbume{albumsFiltrados.length !== 1 ? 's' : ''} disponible{albumsFiltrados.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Albums grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px' }}>
            {albumsFiltrados.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '12px', color: '#94A3B8' }}>
                <ImageIcon size={48} strokeWidth={1} />
                <div style={{ fontSize: '16px', fontWeight: 500 }}>No se encontraron álbumes</div>
                <div style={{ fontSize: '13px' }}>Probá con otro filtro o término de búsqueda</div>
              </div>
            ) : (
              <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '24px',
                }}>
                  {albumsFiltrados.map(album => (
                    <AlbumCard key={album.id} album={album} onClick={() => setAlbumAbierto(album)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
