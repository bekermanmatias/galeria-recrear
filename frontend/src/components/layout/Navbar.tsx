import { LogOut } from 'lucide-react';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
}

export default function Navbar({ role }: NavbarProps) {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      borderBottom: '1px solid #E4E4E7',
      background: '#FFFFFF',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img 
          src="/logo-recrear.png" 
          alt="Galería Recrear" 
          style={{ height: '44px', width: 'auto', objectFit: 'contain' }} 
        />
        <div style={{ height: '32px', width: '1px', background: '#E4E4E7' }} />
        <span style={{ fontSize: '18px', fontWeight: 600, color: '#1A4B77', letterSpacing: '-0.02em' }}>
          Portal de Fotos
        </span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {role === 'parent' && (
          <span style={{ fontSize: '15px', color: '#71717A' }}>
            Viaje de Egresados
          </span>
        )}
        
        {(role === 'coordinator' || role === 'admin') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A4B77', background: '#F4F4F5', padding: '6px 12px', borderRadius: '6px' }}>
              {role === 'coordinator' ? 'Coordinador' : 'Administrador'}
            </span>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#71717A', fontSize: '14px', fontFamily: 'inherit',
              transition: 'color 0.2s', padding: 0,
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#09090B')}
              onMouseLeave={e => (e.currentTarget.style.color = '#71717A')}
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
