import { useEffect, useState } from 'react';
import { adminRequest, type CatalogItem } from '../../lib/api';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

interface Turno {
  id: string;
  nombre: string;
  codigo: string;
}

export default function AdminTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: '', codigo: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const load = () => adminRequest<{items: CatalogItem[]}>( '/shifts' ).then(data => setTurnos(data.items.map(item => ({ id:item.id, nombre:item.name, codigo:item.bot_code }))));
  useEffect(() => { load(); }, []);

  const openModal = (t?: Turno) => {
    if (t) {
      setEditingId(t.id);
      setFormData({ nombre: t.nombre, codigo: t.codigo });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', codigo: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => { if (!formData.nombre || !formData.codigo) return; await adminRequest('/shifts'+(editingId ? '/'+editingId : ''), { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify({ name:formData.nombre, botCode:formData.codigo }) }); setIsModalOpen(false); await load(); };

  const handleDelete = async (id: string) => { if (confirm('¿Desactivar este registro?')) { await adminRequest('/shifts/'+id,{method:'DELETE'}); await load(); } };

  const filteredTurnos = turnos.filter(t => 
    t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.codigo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1A4B77' }}>Turnos</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Gestión de turnos horarios.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
            <input
              type="text"
              placeholder="Buscar turno..."
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
            <Plus size={16} /> Nuevo Turno
          </button>
        </div>
      </div>

      <div style={{ background: '#FFFFFF' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E4E4E7' }}>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', width: '20%' }}>Código</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredTurnos.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ padding: '32px', textAlign: 'center', color: '#71717A', fontSize: '14px' }}>
                  No se encontraron turnos con "{searchQuery}"
                </td>
              </tr>
            ) : (
              filteredTurnos.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #E4E4E7' }}>
                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 500 }}>{t.codigo}</td>
                <td style={{ padding: '16px 24px', fontSize: '14px' }}>{t.nombre}</td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <button onClick={() => openModal(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', marginRight: '16px' }}><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={16} /></button>
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
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1A4B77' }}>{editingId ? 'Editar Turno' : 'Nuevo Turno'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#71717A" /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Nombre del Turno
                <input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Código / Abreviatura
                <input value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value })} placeholder="Ej: m" style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
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


