import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown, Menu } from 'lucide-react';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
  onMenuToggle?: () => void;
}

const SESSION_BY_ROLE = {
  admin: {
    name: 'Admin Master',
    label: 'Administrador',
    email: 'admin@recrear.com',
  },
  coordinator: {
    name: 'Juan Perez',
    label: 'Coordinador',
    email: 'juan@recrear.com',
  },
  parent: {
    name: 'Usuario',
    label: 'Usuario',
    email: 'usuario@recrear.com',
  },
} as const;

export default function Navbar({ role, onMenuToggle }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = SESSION_BY_ROLE[role];

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="hide-on-mobile" style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: menuOpen ? '#F8FAFC' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => !menuOpen && (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#64748B" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                {session.name}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>
                {session.label}
              </span>
            </div>
            <ChevronDown size={16} color="#94A3B8" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }} />
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              background: '#FFFFFF',
              border: '1px solid #E4E4E7',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              width: '220px',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 80,
            }}>
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#18181B' }}>{session.name}</div>
                <div style={{ fontSize: '12px', color: '#71717A', marginTop: '2px' }}>{session.email}</div>
              </div>
              <div style={{ height: '1px', background: '#E4E4E7', margin: '4px 0' }} />
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#3F3F46',
                  borderRadius: '4px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Settings size={14} /> Configuración
              </button>
              <div style={{ height: '1px', background: '#E4E4E7', margin: '4px 0' }} />
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#EF4444',
                  borderRadius: '4px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>

        <div className="show-on-mobile" style={{ alignItems: 'center', gap: '10px' }}>
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Menu size={24} color="#1A4B77" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
