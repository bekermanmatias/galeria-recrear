import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown, Menu } from 'lucide-react';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
  onMenuToggle?: () => void;
}

export default function Navbar({ role, onMenuToggle }: NavbarProps) {
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
          style={{ height: '64px', width: 'auto', objectFit: 'contain' }} 
        />
        <div className="hide-on-mobile" style={{ height: '40px', width: '2px', background: '#E2E8F0', borderRadius: '2px' }} />
        <span className="hide-on-mobile" style={{ fontSize: '22px', fontWeight: 800, color: '#1A4B77', letterSpacing: '-0.03em' }}>
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
            <div className="hide-on-mobile" style={{ position: 'relative' }} ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: menuOpen ? '#F8FAFC' : 'transparent', border: 'none', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: '8px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => !menuOpen && (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={18} color="#64748B" />
                </div>
                <span className="hide-on-mobile" style={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                  {role === 'coordinator' ? 'Coordinador' : 'Administrador'}
                </span>
                <ChevronDown size={16} color="#94A3B8" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '4px' }} />
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
            {onMenuToggle && (
              <button 
                className="show-on-mobile" 
                onClick={onMenuToggle}
                style={{ 
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <Menu size={24} color="#1A4B77" />
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
