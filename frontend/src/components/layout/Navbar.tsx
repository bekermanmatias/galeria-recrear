import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown } from 'lucide-react';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
}

const ROLE_LABELS: Record<string, string> = {
  parent: 'Portal de Padres',
  coordinator: 'Coordinador',
  admin: 'Administrador',
};

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
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      height: '56px',
      background: '#0F2340',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '34px', height: '34px',
          background: '#2A6DB5',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '16px', color: 'white', letterSpacing: '-0.5px',
          flexShrink: 0,
        }}>
          R
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            RECREAR
          </div>
          <div style={{ fontSize: '11px', color: '#94A3B8', letterSpacing: '0.04em', lineHeight: 1.1 }}>
            Portal de Fotos
          </div>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: 'none', cursor: 'pointer',
            padding: '6px 10px', borderRadius: '8px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => !menuOpen && (e.currentTarget.style.background = 'transparent')}
        >
          {/* Avatar */}
          <div style={{
            width: '32px', height: '32px',
            background: '#2A6DB5',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={16} color="#FFFFFF" />
          </div>
          {/* Name */}
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>
            {ROLE_LABELS[role]}
          </span>
          <ChevronDown
            size={14}
            color="#94A3B8"
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            width: '200px', padding: '8px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            zIndex: 100,
          }}>
            {/* User header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #F4F4F5', marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#09090B' }}>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: '12px', color: '#71717A' }}>usuario@recrear.com</div>
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontSize: '13px', color: '#3F3F46', borderRadius: '6px',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F4F4F5')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <Settings size={14} color="#71717A" /> Configuración
            </button>
            <div style={{ height: '1px', background: '#F4F4F5', margin: '2px 0' }} />
            <button style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontSize: '13px', color: '#EF4444', borderRadius: '6px',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
