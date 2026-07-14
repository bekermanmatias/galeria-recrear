import { useState } from 'react';
import { CheckCircle2, Trash2, Image, LogOut, ChevronRight, AlertCircle } from 'lucide-react';

const MOCK_BATCHES = [
  { id: '1', school: 'Colegio San Luis', turno: 'Mañana', count: 48 },
  { id: '2', school: 'Instituto Belgrano', turno: 'Tarde', count: 32 },
  { id: '3', school: 'Colegio San Luis', turno: 'Noche', count: 61 },
  { id: '4', school: 'Escuela Rivadavia', turno: 'Mañana', count: 27 },
];

// Generate deterministic placeholder colors for photos
const PHOTO_COLORS = [
  '#C7D2FE', '#A5F3FC', '#BBF7D0', '#FDE68A', '#FECACA',
  '#DDD6FE', '#BAE6FD', '#A7F3D0', '#FEF08A', '#FBCFE8',
  '#E0E7FF', '#CFFAFE', '#D1FAE5', '#FEF3C7', '#FEE2E2',
  '#EDE9FE', '#E0F2FE', '#ECFDF5', '#FFFBEB', '#FFF1F2',
];

export default function AdminPanel() {
  const [batches, setBatches] = useState(MOCK_BATCHES);
  const [selectedId, setSelectedId] = useState('1');
  const [deletedPhotos, setDeletedPhotos] = useState<Set<number>>(new Set());
  const [hovered, setHovered] = useState<number | null>(null);
  const [approvedBatches, setApprovedBatches] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  const selectedBatch = batches.find(b => b.id === selectedId);
  const photoCount = selectedBatch ? selectedBatch.count : 0;
  const photos = Array.from({ length: photoCount }, (_, i) => i);
  const visiblePhotos = photos.filter(i => !deletedPhotos.has(i));
  const isApproved = approvedBatches.has(selectedId);

  const handleDelete = (idx: number) => {
    setDeletedPhotos(prev => new Set([...prev, idx]));
  };

  const handleApprove = () => {
    setApprovedBatches(prev => new Set([...prev, selectedId]));
    setShowConfirm(false);
    setBatches(prev => prev.filter(b => b.id !== selectedId));
    const remaining = batches.filter(b => b.id !== selectedId);
    if (remaining.length > 0) setSelectedId(remaining[0].id);
    setDeletedPhotos(new Set());
  };

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#F8FAFC',
    }}>
      {/* Header */}
      <header style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', background: '#4F46E5',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Image size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0F172A' }}>Galería Recrear</span>
          <span style={{
            marginLeft: '6px', padding: '2px 8px',
            background: '#EEF2FF', color: '#4F46E5',
            borderRadius: '99px', fontSize: '11px', fontWeight: 600,
          }}>Admin</span>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748B', fontSize: '13px', fontFamily: 'inherit',
          padding: '6px 8px', borderRadius: '6px', transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: '260px',
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '16px 16px 8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Lotes Pendientes
            </span>
          </div>
          {batches.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <CheckCircle2 size={32} color="#BBF7D0" style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>Sin lotes pendientes</p>
            </div>
          ) : (
            batches.map(batch => (
              <button
                key={batch.id}
                onClick={() => { setSelectedId(batch.id); setDeletedPhotos(new Set()); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: selectedId === batch.id ? '#EEF2FF' : 'transparent',
                  borderLeft: `3px solid ${selectedId === batch.id ? '#4F46E5' : 'transparent'}`,
                  border: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  borderBottom: 'none',
                  borderLeftWidth: '3px',
                  borderLeftStyle: 'solid',
                  borderLeftColor: selectedId === batch.id ? '#4F46E5' : 'transparent',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => selectedId !== batch.id && (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => selectedId !== batch.id && (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                    {batch.school}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                    Turno {batch.turno} · {batch.count} fotos
                  </p>
                </div>
                <ChevronRight size={14} color="#94A3B8" />
              </button>
            ))
          )}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedBatch ? (
            <>
              {/* Toolbar */}
              <div style={{
                padding: '16px 24px',
                background: '#FFFFFF',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <div>
                  <h1 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
                    {selectedBatch.school} — Turno {selectedBatch.turno}
                  </h1>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                    {visiblePhotos.length} fotos · {deletedPhotos.size > 0 ? `${deletedPhotos.size} eliminadas` : 'Sin cambios'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {deletedPhotos.size > 0 && (
                    <span style={{ fontSize: '12px', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={13} />
                      {deletedPhotos.size} {deletedPhotos.size === 1 ? 'foto eliminada' : 'fotos eliminadas'}
                    </span>
                  )}
                  {isApproved ? (
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      color: '#16A34A', fontWeight: 600, fontSize: '13px',
                    }}>
                      <CheckCircle2 size={16} /> Aprobado
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowConfirm(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: '#16A34A', color: '#FFFFFF',
                        border: 'none', borderRadius: '8px',
                        padding: '9px 18px', fontSize: '13px',
                        fontWeight: 600, fontFamily: 'inherit',
                        cursor: 'pointer', transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#15803D')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#16A34A')}
                    >
                      <CheckCircle2 size={15} />
                      Aprobar lote
                    </button>
                  )}
                </div>
              </div>

              {/* Photo grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '10px',
                }}>
                  {visiblePhotos.map(i => (
                    <div
                      key={i}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: PHOTO_COLORS[i % PHOTO_COLORS.length],
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    >
                      {/* Simulated photo */}
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.4,
                      }}>
                        <Image size={24} color="#64748B" />
                      </div>
                      {/* Hover overlay */}
                      {hovered === i && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.35)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'opacity 0.15s',
                        }}>
                          <button
                            onClick={() => handleDelete(i)}
                            style={{
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              borderRadius: '8px',
                              padding: '8px',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#FEF2F2')}
                          >
                            <Trash2 size={16} color="#DC2626" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: '#94A3B8',
            }}>
              <CheckCircle2 size={48} color="#BBF7D0" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', fontWeight: 500 }}>Todos los lotes aprobados</p>
            </div>
          )}
        </main>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '12px',
            padding: '24px', maxWidth: '360px', width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
              ¿Aprobar este lote?
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748B', lineHeight: 1.5 }}>
              Las {visiblePhotos.length} fotos de <strong>{selectedBatch?.school} — Turno {selectedBatch?.turno}</strong> pasarán a estado <strong>Publicado</strong>.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '9px 16px', background: 'none',
                  border: '1px solid #E2E8F0', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', color: '#374151',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                style={{
                  padding: '9px 16px', background: '#16A34A',
                  border: 'none', borderRadius: '8px',
                  fontSize: '13px', fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer', color: '#FFFFFF',
                }}
              >
                Sí, aprobar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
