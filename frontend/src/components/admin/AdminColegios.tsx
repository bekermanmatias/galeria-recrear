import { useEffect, useState } from 'react';
import { adminRequest, type School, type AdminUser } from '../../lib/api';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';
import ConfirmDialog from '../ui/ConfirmDialog';

interface Colegio {
  id: string;
  nombre: string;
  codigo: string;
  fechaInicio: string;
  fechaFin: string;
  coordinadores: string[];
  coordinator_ids?: string[];
}

export default function AdminColegios() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [coordinators, setCoordinators] = useState<AdminUser[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', codigo: '', fechaInicio: '', fechaFin: '' });
  const [coordinatorIds, setCoordinatorIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinatorSearch, setCoordinatorSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  
  const load = () => {
    adminRequest<{items: School[]}>('/schools').then(data => setColegios(data.items.map(item => ({ id:item.id,nombre:item.name,codigo:item.code,fechaInicio:item.start_date ?? '',fechaFin:item.end_date ?? '',coordinadores:item.coordinators || [], coordinator_ids: item.coordinator_ids || [] }))));
    adminRequest<{items: AdminUser[]}>('/users').then(data => setCoordinators(data.items.filter(u => u.role === 'COORDINATOR')));
  };
  useEffect(() => { load(); }, []);
  const openModal = (col?: Colegio) => {
    if (col) {
      setEditingId(col.id);
      setFormData({ nombre: col.nombre, codigo: col.codigo, fechaInicio: col.fechaInicio, fechaFin: col.fechaFin });
      setCoordinatorIds(col.coordinator_ids || []);
    } else {
      setEditingId(null);
      setFormData({ nombre: '', codigo: '', fechaInicio: '', fechaFin: '' });
      setCoordinatorIds([]);
    }
    setCoordinatorSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.codigo) return;
    const saved = await adminRequest<School>('/schools'+(editingId ? '/'+editingId : ''), { method:editingId ? 'PATCH' : 'POST', body:JSON.stringify({ name:formData.nombre, code:formData.codigo, botCode:formData.codigo.toUpperCase(), startDate:formData.fechaInicio || null, endDate:formData.fechaFin || null }) });
    await adminRequest('/schools/'+saved.id+'/coordinators', { method: 'PUT', body: JSON.stringify({ coordinatorIds }) });
    setIsModalOpen(false); await load();
  };
  const handleDelete = (id:string) => setPendingDelete(id);
  const confirmDelete = async () => { if (!pendingDelete) return; try { setDeleteBusy(true); await adminRequest('/schools/'+pendingDelete,{method:'DELETE'}); setPendingDelete(null); await load(); } finally { setDeleteBusy(false); } };

  const filteredColegios = colegios.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.codigo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1A4B77' }}>Colegios</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Gestión de colegios y asignación de coordinadores.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
            <input
              type="text"
              placeholder="Buscar colegio..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                padding: '10px 16px 10px 36px', border: '1px solid #E4E4E7',
                borderRadius: '6px', fontSize: '13px', outline: 'none', width: '250px'
              }}
              onFocus={e => e.target.style.borderColor = '#1A4B77'}
              onBlur={e => e.target.style.borderColor = '#E4E4E7'}
            />
          </div>
          <button
            onClick={() => openModal()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', background: '#1A4B77', color: 'white',
              border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              cursor: 'pointer', transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#133656')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1A4B77')}
          >
            <Plus size={16} /> Nuevo Colegio
          </button>
        </div>
      </div>

      <div style={{ background: '#FFFFFF' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E4E4E7' }}>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Código</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Rango Fechas</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Coordinadores</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredColegios.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#71717A', fontSize: '14px' }}>
                  No se encontraron colegios con "{searchQuery}"
                </td>
              </tr>
            ) : (
              filteredColegios.map(col => (
              <tr key={col.id} style={{ borderBottom: '1px solid #E4E4E7' }}>
                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 500 }}>{col.codigo}</td>
                <td style={{ padding: '16px 24px', fontSize: '14px' }}>{col.nombre}</td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: '#71717A' }}>{col.fechaInicio} a {col.fechaFin}</td>
                <td style={{ padding: '16px 24px', fontSize: '13px' }}>{col.coordinadores.join(', ')}</td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <button onClick={() => openModal(col)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', marginRight: '16px' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(col.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1A4B77' }}>{editingId ? 'Editar Colegio' : 'Nuevo Colegio'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#71717A" /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Nombre del Colegio
                <input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Código / Abreviatura
                <input value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej: 1a" style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                  Fecha Inicio
                  <input type="date" value={formData.fechaInicio} onChange={e => setFormData({ ...formData, fechaInicio: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                  Fecha Fin
                  <input type="date" value={formData.fechaFin} onChange={e => setFormData({ ...formData, fechaFin: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Coordinadores Asignados
                <input type="text" placeholder="Buscar coordinador..." value={coordinatorSearch} onChange={e => setCoordinatorSearch(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #E4E4E7', borderRadius: '6px', fontSize: '13px', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#1A4B77'} onBlur={e => e.target.style.borderColor = '#E4E4E7'} />
                <div style={{ padding: '8px 12px', border: '1px solid #E4E4E7', borderRadius: '6px', background: 'white', maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {coordinators.filter(u => u.active !== false && u.name.toLowerCase().includes(coordinatorSearch.toLowerCase())).map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 400, cursor: 'pointer', padding: '2px 0' }}>
                      <input type="checkbox" checked={coordinatorIds.includes(u.id)} onChange={e => {
                        if (e.target.checked) setCoordinatorIds([...coordinatorIds, u.id]);
                        else setCoordinatorIds(coordinatorIds.filter(id => id !== u.id));
                      }} style={{ cursor: 'pointer' }} />
                      {u.name} <span style={{ color: '#A1A1AA', fontSize: '12px' }}>({u.email})</span>
                    </label>
                  ))}
                  {coordinators.filter(u => u.active !== false && u.name.toLowerCase().includes(coordinatorSearch.toLowerCase())).length === 0 && (
                    <span style={{ color: '#A1A1AA', fontSize: '12px', fontStyle: 'italic' }}>No se encontraron coordinadores.</span>
                  )}
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 16px', background: '#F4F4F5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} style={{ padding: '10px 16px', background: '#1A4B77', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog open={pendingDelete!==null} title="¿Desactivar colegio?" description="El colegio dejará de estar disponible para accesos y nuevas cargas. Su historial no se eliminará." confirmLabel="Desactivar" busy={deleteBusy} onCancel={()=>!deleteBusy&&setPendingDelete(null)} onConfirm={confirmDelete}/>
    </div>
  );
}



