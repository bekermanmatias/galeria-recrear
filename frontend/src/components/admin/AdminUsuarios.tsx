import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

type UsuarioRol = 'admin' | 'coordinador' | 'user';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: UsuarioRol;
}

const MOCK_USUARIOS: Usuario[] = [
  { id: '1', nombre: 'Admin Master', email: 'admin@recrear.com', rol: 'admin' },
  { id: '2', nombre: 'Juan Perez', email: 'juan@recrear.com', rol: 'coordinador' },
  { id: '3', nombre: 'Maria Garcia', email: 'maria@recrear.com', rol: 'user' },
];

const roleLabel = (rol: UsuarioRol) => {
  switch (rol) {
    case 'admin':
      return 'Administrador';
    case 'coordinador':
      return 'Coordinador';
    case 'user':
      return 'Usuario';
  }
};

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(MOCK_USUARIOS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ nombre: string; email: string; rol: UsuarioRol }>({
    nombre: '',
    email: '',
    rol: 'user',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const openModal = (user?: Usuario) => {
    if (user) {
      setEditingId(user.id);
      setFormData({ nombre: user.nombre, email: user.email, rol: user.rol });
    } else {
      setEditingId(null);
      setFormData({ nombre: '', email: '', rol: 'user' });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.nombre || !formData.email) return;

    const newUser: Usuario = {
      id: editingId || Math.random().toString(36).slice(2),
      nombre: formData.nombre,
      email: formData.email,
      rol: formData.rol,
    };

    if (editingId) {
      setUsuarios(prev => prev.map(u => u.id === editingId ? newUser : u));
    } else {
      setUsuarios(prev => [...prev, newUser]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Eliminar este usuario?')) {
      setUsuarios(prev => prev.filter(u => u.id !== id));
    }
  };

  const filteredUsuarios = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    roleLabel(u.rol).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', color: '#1A4B77' }}>Usuarios</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>Gestión de accesos y roles del sistema.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717A' }} />
            <input
              type="text"
              placeholder="Buscar usuario..."
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
            <Plus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div style={{ background: '#FFFFFF' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E4E4E7' }}>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Nombre</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Email</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase' }}>Rol</th>
              <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#71717A', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsuarios.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#71717A', fontSize: '14px' }}>
                  No se encontraron usuarios con "{searchQuery}"
                </td>
              </tr>
            ) : (
              filteredUsuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #E4E4E7' }}>
                  <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 500 }}>{u.nombre}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px', color: '#71717A' }}>{u.email}</td>
                  <td style={{ padding: '16px 24px', fontSize: '14px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
                      background: u.rol === 'admin' ? '#FEE2E2' : u.rol === 'coordinador' ? '#DBEAFE' : '#F3F4F6',
                      color: u.rol === 'admin' ? '#991B1B' : u.rol === 'coordinador' ? '#1E40AF' : '#374151'
                    }}>
                      {roleLabel(u.rol)}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <button onClick={() => openModal(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', marginRight: '16px' }}><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1A4B77' }}>{editingId ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#71717A" /></button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Nombre completo
                <input value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Email
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                Rol
                <select value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value as UsuarioRol })} style={{ padding: '10px', border: '1px solid #E4E4E7', borderRadius: '6px', background: 'white' }}>
                  <option value="admin">Administrador</option>
                  <option value="coordinador">Coordinador</option>
                  <option value="user">Usuario</option>
                </select>
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
