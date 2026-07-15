import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Download, CheckSquare, ArrowLeft, Camera, User, ChevronDown, LogOut, Settings, X, Sun, Cloud, Moon } from 'lucide-react';
import Lightbox from '../ui/Lightbox';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const USUARIO = { nombre: 'Martín García', colegio: 'Colegio San Luis', viaje: 'Viaje de Egresados 2026' };

interface Album {
  id: string;
  actividad: string;
  fecha: string;
  diaLabel: string;
  turno: 'Mañana' | 'Tarde' | 'Noche';
  totalFotos: number;
  seed: string;
}

const ALBUMS: Album[] = [
  { id: 'a1', actividad: 'Cabalgata', fecha: '14 Jul', diaLabel: 'Día 1', turno: 'Mañana', totalFotos: 38, seed: 'cabalg1' },
  { id: 'a2', actividad: 'Pileta', fecha: '14 Jul', diaLabel: 'Día 1', turno: 'Tarde', totalFotos: 24, seed: 'pileta1' },
  { id: 'a3', actividad: 'Fogón nocturno', fecha: '14 Jul', diaLabel: 'Día 1', turno: 'Noche', totalFotos: 17, seed: 'fogon1' },
  { id: 'a4', actividad: 'Excursión al río', fecha: '15 Jul', diaLabel: 'Día 2', turno: 'Mañana', totalFotos: 52, seed: 'excur1' },
  { id: 'a5', actividad: 'Taller de arte', fecha: '15 Jul', diaLabel: 'Día 2', turno: 'Tarde', totalFotos: 29, seed: 'taller1' },
  { id: 'a6', actividad: 'Mateada grupal', fecha: '16 Jul', diaLabel: 'Día 3', turno: 'Mañana', totalFotos: 21, seed: 'mateada1' },
  { id: 'a7', actividad: 'Deportes al aire libre', fecha: '16 Jul', diaLabel: 'Día 3', turno: 'Tarde', totalFotos: 44, seed: 'deport1' },
  { id: 'a8', actividad: 'Noche de talentos', fecha: '16 Jul', diaLabel: 'Día 3', turno: 'Noche', totalFotos: 33, seed: 'noche1' },
];

const DIAS_UNICOS = Array.from(new Map(ALBUMS.map(a => [a.diaLabel, { label: a.diaLabel, fecha: a.fecha }])).values());
const TURNOS_FILTER = ['Todos', 'Mañana', 'Tarde', 'Noche'] as const;

const TURNO_ICON = { Mañana: Sun, Tarde: Cloud, Noche: Moon };

// ─── User Avatar Menu ─────────────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = USUARIO.nombre.split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-slate-100 transition-colors duration-150"
      >
        <div className="w-8 h-8 rounded-full bg-[#1A4B77] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="text-sm font-medium text-slate-700 hidden sm:block">{USUARIO.nombre}</span>
        <ChevronDown size={14} className="text-slate-400" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] bg-white border border-slate-100 rounded-xl shadow-xl w-52 py-1 z-50">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-semibold text-slate-800">{USUARIO.nombre}</div>
            <div className="text-xs text-slate-400 mt-0.5">{USUARIO.colegio}</div>
          </div>
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors text-left">
            <Settings size={14} className="text-slate-400" /> Configuración
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors text-left">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Album Card ───────────────────────────────────────────────────────────────

function AlbumCard({ album, onClick }: { album: Album; onClick: () => void }) {
  const TurnoIcon = TURNO_ICON[album.turno];
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-slate-200"
    >
      {/* Cover */}
      <div className="relative h-52 overflow-hidden bg-slate-100">
        <img
          src={`https://picsum.photos/seed/${album.seed}/600/400`}
          alt={album.actividad}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        {/* Photo count — glassmorphism */}
        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
          <Camera size={11} />
          {album.totalFotos}
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 py-3.5">
        <div className="font-semibold text-slate-800 text-base leading-tight mb-1">{album.actividad}</div>
        <div className="flex items-center gap-1.5 text-slate-400 text-sm">
          <TurnoIcon size={13} />
          <span>Turno {album.turno}</span>
          <span className="text-slate-200 mx-0.5">·</span>
          <span>{album.fecha}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Album View (inside album) ────────────────────────────────────────────────

function AlbumView({ album, onBack }: { album: Album; onBack: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const photos = Array.from({ length: album.totalFotos }, (_, i) => i);
  const TurnoIcon = TURNO_ICON[album.turno];

  const toggleSelect = (i: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const handlePhoto = (i: number) => { if (selectionMode) toggleSelect(i); else setLightbox(i); };
  const exitSelection = () => { setSelectionMode(false); setSelected(new Set()); };

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Álbumes</span>
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">{album.actividad}</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
              <TurnoIcon size={11} />
              <span>Turno {album.turno}</span>
              <span className="text-slate-300">·</span>
              <span>{album.fecha}</span>
              <span className="text-slate-300">·</span>
              <span>{album.totalFotos} fotos</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <span className="text-sm text-slate-500 font-medium">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
              <button
                onClick={() => setSelected(selected.size === photos.length ? new Set() : new Set(photos))}
                className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium"
              >
                {selected.size === photos.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
              {selected.size > 0 && (
                <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#1A4B77] text-white hover:bg-[#163d62] transition-colors font-semibold">
                  <Download size={14} />
                  Descargar ({selected.size})
                </button>
              )}
              <button
                onClick={exitSelection}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium"
              >
                <CheckSquare size={14} />
                Seleccionar
              </button>
              <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#1A4B77] text-white hover:bg-[#163d62] transition-colors font-semibold">
                <Download size={14} />
                Descargar todo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Photos */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {photos.map(i => {
            const isSelected = selected.has(i);
            return (
              <div
                key={i}
                onClick={() => handlePhoto(i)}
                className="relative cursor-pointer rounded-xl overflow-hidden aspect-square group/photo transition-transform duration-150"
                style={{
                  outline: isSelected ? '3px solid #1A4B77' : '3px solid transparent',
                  outlineOffset: '0px',
                  transform: isSelected ? 'scale(0.97)' : undefined,
                }}
              >
                <img
                  src={`https://picsum.photos/seed/${album.seed}${i}/400/400`}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/photo:scale-105"
                />
                <div
                  className="absolute inset-0 transition-opacity duration-150 flex items-start justify-start p-2"
                  style={{ opacity: isSelected || selectionMode ? 1 : 0, background: isSelected ? 'rgba(26,75,119,0.15)' : 'rgba(0,0,0,0.1)' }}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm transition-all duration-150 ${isSelected ? 'bg-[#1A4B77] border-[#1A4B77]' : 'bg-white/85 border-white/90'}`}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <div
                  className="absolute inset-0 opacity-0 group-hover/photo:opacity-100 transition-opacity duration-150"
                  style={{ background: 'rgba(0,0,0,0.06)', display: selectionMode ? 'none' : undefined }}
                />
              </div>
            );
          })}
        </div>
      </div>

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
  const [albumAbierto, setAlbumAbierto] = useState<Album | null>(null);
  const [diaActivo, setDiaActivo] = useState('Todos');
  const [turnoFilter, setTurnoFilter] = useState<typeof TURNOS_FILTER[number]>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const albumsFiltrados = useMemo(() => {
    let list = [...ALBUMS];
    if (diaActivo !== 'Todos') list = list.filter(a => a.diaLabel === diaActivo);
    if (turnoFilter !== 'Todos') list = list.filter(a => a.turno === turnoFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.actividad.toLowerCase().includes(q) || a.fecha.toLowerCase().includes(q));
    }
    return list;
  }, [diaActivo, turnoFilter, searchQuery]);

  const diasTabs = [{ label: 'Todos', fecha: '' }, ...DIAS_UNICOS];

  if (albumAbierto) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Minimal top bar for album view */}
        <header className="bg-white border-b border-slate-100 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <img src="/logo-recrear.png" alt="Recrear" style={{ height: '32px', width: 'auto', objectFit: 'contain' }} />
          </div>
          <UserMenu />
        </header>
        <div className="flex-1 overflow-hidden flex flex-col">
          <AlbumView album={albumAbierto} onBack={() => setAlbumAbierto(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* ── Hero Header ── */}
      <header className="bg-white border-b border-slate-100 px-6 sm:px-10 py-5">
        <div className="max-w-7xl mx-auto flex items-start justify-between gap-4">
          {/* Left: title */}
          <div className="flex items-center gap-4">
            <img src="/logo-recrear.png" alt="Recrear" style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight">
                {USUARIO.colegio}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {USUARIO.viaje} · <span className="font-medium">{albumsFiltrados.length} álbumes disponibles</span>
              </p>
            </div>
          </div>

          {/* Right: search + avatar */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center">
              {searchOpen ? (
                <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-150">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar actividad..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#1A4B77] w-48 text-slate-700 placeholder-slate-300 transition-all"
                  />
                  <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Search size={18} />
                </button>
              )}
            </div>
            <UserMenu />
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="max-w-7xl mx-auto mt-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          {/* Day tabs */}
          <div className="flex gap-1">
            {diasTabs.map(dia => {
              const isActive = diaActivo === dia.label;
              return (
                <button
                  key={dia.label}
                  onClick={() => setDiaActivo(dia.label)}
                  className={`flex flex-col items-center px-4 py-2 rounded-lg transition-all duration-150 text-left border-b-2 ${
                    isActive
                      ? 'border-[#1A4B77] text-[#1A4B77]'
                      : 'border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-200'
                  }`}
                >
                  <span className={`text-sm leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {dia.label}
                  </span>
                  {dia.fecha && (
                    <span className="text-[10px] mt-0.5 text-slate-400 font-normal">{dia.fecha}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-px h-8 bg-slate-100 hidden sm:block" />

          {/* Turno chips */}
          <div className="flex gap-2">
            {TURNOS_FILTER.map(t => {
              const isActive = turnoFilter === t;
              const TIcon = t !== 'Todos' ? TURNO_ICON[t as keyof typeof TURNO_ICON] : null;
              return (
                <button
                  key={t}
                  onClick={() => setTurnoFilter(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                  }`}
                >
                  {TIcon && <TIcon size={11} />}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Albums Grid ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-10 py-8">
        {albumsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-300 gap-3">
            <Search size={40} strokeWidth={1} />
            <div className="text-base font-medium text-slate-400">No se encontraron álbumes</div>
            <div className="text-sm text-slate-300">Probá ajustando los filtros</div>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {albumsFiltrados.map(album => (
              <AlbumCard key={album.id} album={album} onClick={() => setAlbumAbierto(album)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
