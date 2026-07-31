import { useEffect, useState } from 'react';
import { Edit2, Check, X, Trash2 } from 'lucide-react';
import { api, type LotSummary } from '../../lib/api';

const isDeletable = (lot: LotSummary) => ['DRAFT', 'UPLOADING'].includes(lot.status);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function AdminEstadoCargas() {
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [error, setError] = useState('');
  
  const [editingLotId, setEditingLotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  
  const [deletingLotId, setDeletingLotId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.lots().then(data => {
      if (mounted) setLots(data.items);
    }).catch(reason => {
      if (mounted) setError(reason.message);
    });
    return () => { mounted = false; };
  }, []);

  const startEditName = (lot: LotSummary) => {
    setEditingLotId(lot.id);
    setEditingName(lot.album_name || lot.activity_name);
  };

  const saveEditName = async (lotId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) { setEditingLotId(null); return; }
    setEditBusy(true);
    setError('');
    try {
      await api.renameLot(lotId, trimmed);
      setLots(prev => prev.map(l => l.id === lotId ? { ...l, album_name: trimmed } : l));
      setEditingLotId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo renombrar el álbum.');
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = (lotId: string) => {
    setDeletingLotId(lotId);
  };

  const executeDelete = async () => {
    if (!deletingLotId) return;
    setDeleteBusy(true);
    setError('');
    try {
      await api.deleteLot(deletingLotId);
      setLots(prev => prev.filter(l => l.id !== deletingLotId));
      setDeletingLotId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el lote.');
      setDeletingLotId(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px', color: '#1A4B77' }}>Estado de Lotes</h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#71717A' }}>Estado de todo el material cargado en la plataforma.</p>

        {error && (
          <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.2fr 1fr 100px', gap: '12px', padding: '12px 16px', background: '#F8FAFC', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <div>Salida / Escuela</div>
            <div>Álbum / Actividad</div>
            <div>Fecha</div>
            <div>Creador</div>
            <div>Estado</div>
            <div style={{ textAlign: 'right' }}>Acciones</div>
          </div>

          {lots.map(lot => (
            <div key={lot.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1.2fr 1fr 100px', gap: '12px', alignItems: 'center', padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', transition: 'all 0.2s ease' }}>
              <div style={{ fontWeight: 600, color: '#1A4B77', fontSize: '14px' }}>
                {lot.departure_name ?? lot.school_name}
              </div>

              <div>
                {editingLotId === lot.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') void saveEditName(lot.id); if (e.key === 'Escape') setEditingLotId(null); }}
                      maxLength={160}
                      style={{ width: '100%', height: '30px', padding: '0 8px', border: '1px solid #1A4B77', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                    />
                    <button onClick={() => void saveEditName(lot.id)} disabled={editBusy} style={{ height: '30px', width: '30px', border: 'none', borderRadius: '4px', background: '#1A4B77', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingLotId(null)} disabled={editBusy} style={{ height: '30px', width: '30px', border: '1px solid #E4E4E7', borderRadius: '4px', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#334155', fontSize: '14px' }}>{lot.album_name || lot.activity_name}</span>
                    {isDeletable(lot) && (
                      <button onClick={() => startEditName(lot)} title="Editar nombre del álbum" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div style={{ color: '#64748B', fontSize: '13px' }}>
                {formatDate(lot.event_date)}
              </div>

              <div style={{ color: '#64748B', fontSize: '13px' }}>
                {lot.created_by_name || 'Coordinador'}
              </div>

              <div>
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '14px', background: lot.status === 'PUBLISHED' ? '#DCFCE7' : lot.status === 'PENDING' ? '#FEF3C7' : '#E2E8F0', color: lot.status === 'PUBLISHED' ? '#166534' : lot.status === 'PENDING' ? '#92400E' : '#475569', fontSize: '12px', fontWeight: 600 }}>
                  {lot.status === 'PUBLISHED' ? 'Publicado' : lot.status === 'PENDING' ? 'Pendiente' : (lot.status === 'UPLOADING' && lot.submitted_at) ? 'Procesando' : 'En carga'}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                {isDeletable(lot) && editingLotId !== lot.id && (
                  <button onClick={() => confirmDelete(lot.id)} title="Eliminar lote" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
          {!lots.length && <p style={{ color: '#71717A', padding: '16px 0' }}>Todavía no hay lotes cargados.</p>}
        </div>
      </div>

      {deletingLotId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ width: 'min(100%, 400px)', background: '#fff', borderRadius: '12px', padding: '28px', boxShadow: '0 20px 50px rgba(15,23,42,.2)' }}>
            <h3 style={{ margin: '0 0 10px', color: '#1A4B77', fontSize: '17px' }}>¿Eliminar este lote?</h3>
            <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#64748B' }}>Se eliminará el lote y todos sus archivos. Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDeletingLotId(null)} disabled={deleteBusy} style={{ padding: '10px 18px', border: '1px solid #E4E4E7', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={() => void executeDelete()} disabled={deleteBusy} style={{ padding: '10px 18px', border: 'none', borderRadius: '6px', background: '#EF4444', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: deleteBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: deleteBusy ? 0.7 : 1 }}>
                {deleteBusy ? 'Eliminando...' : 'Eliminar lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
