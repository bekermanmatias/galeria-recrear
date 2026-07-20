import { useEffect, useState } from 'react';
import { adminRequest, type School } from '../../lib/api';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

interface Colegio {
  id: string;
  nombre: string;
  codigo: string;
  fechaInicio: string;
  fechaFin: string;
  coordinadores: string[];
}

export default function AdminColegios() {
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', codigo: '', fechaInicio: '', fechaFin: '', coordinadores: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const load = () => adminRequest<{items: School[]}>('/schools').then(data => setColegios(data.items.map(item => ({ id:item.id,nombre:item.name,codigo:item.code,fechaInicio:item.start_date ?? '',fechaFin:item.end_date ?? '',coordinadores:[] }))));
  useEffect(() => { load(); }, []);
  const openModal = (col?: Colegio) => {
    if (col) {
      setEditingId(col.id);
      setFormData({ ...col, coordinadores: col.coordinadores.join(', ') });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', codigo: '', fechaInicio: '', fechaFin: '', coordinadores: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.codigo) return;
    await adminRequest('/schools'+(editingId ? '/'+editingId : ''), { method:editingId ? 'PATCH' : 'POST', body:JSON.stringify({ name:formData.nombre, code:formData.codigo, botCode:formData.codigo.toUpperCase(), startDate:formData.fechaInicio || null, endDate:formData.fechaFin || null }) });
    setIsModalOpen(false); await load();
  };
  const handleDelete = async (id:string) => { if(confirm('¿Eliminar este colegio?')) { await adminRequest('/schools/'+id,{method:'DELETE'}); await load(); } };

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
                Coordinadores Asignados (separados por coma)
                <input value={formData.coordinadores} onChange={e => setFormData({ ...formData, coordinadores: e.target.value })} placeholder="Ej: Juan, Maria" style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button onClick={() => setIsModalOpen(false)} style={{ padding: '10px 16px', background: '#F4F4F5', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} style={{ padding: '10px 16px', background: '#1A4B77', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

