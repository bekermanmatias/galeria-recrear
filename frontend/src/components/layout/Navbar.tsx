import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown } from 'lucide-react';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
}

export default function Navbar({ role }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="navbar-container">
      <div className="navbar-brand">
        <img 
          src="/logo-recrear.png" 
          alt="Galería Recrear" 
          style={{ height: '44px', width: 'auto', objectFit: 'contain' }} 
        />
        <div className="hide-on-mobile" style={{ height: '32px', width: '1px', background: '#E4E4E7' }} />
        <span className="hide-on-mobile" style={{ fontSize: '18px', fontWeight: 600, color: '#1A4B77', letterSpacing: '-0.02em' }}>
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
            <span className="hide-on-mobile" style={{ fontSize: '14px', fontWeight: 500, color: '#1A4B77', background: '#F4F4F5', padding: '6px 12px', borderRadius: '6px' }}>
              {role === 'coordinator' ? 'Coordinador' : 'Administrador'}
            </span>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: menuOpen ? '#F4F4F5' : 'transparent', border: 'none', cursor: 'pointer',
                  color: '#1A4B77', padding: '6px 8px', borderRadius: '99px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
                onMouseLeave={e => !menuOpen && (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: '28px', height: '28px', background: '#E4E4E7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={16} color="#3F3F46" />
                </div>
                <ChevronDown size={14} color="#71717A" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  width: '180px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: '13px', color: '#3F3F46', borderRadius: '4px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <Settings size={14} /> Configuración
                  </button>
                  <div style={{ height: '1px', background: '#E4E4E7', margin: '4px 0' }} />
                  <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: '13px', color: '#EF4444', borderRadius: '4px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
