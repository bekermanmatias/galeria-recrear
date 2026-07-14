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
      padding: '0 36px',
      height: '72px',
      background: '#071A2F',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img
          src="/logo-recrear.png"
          alt="Recrear"
          style={{ height: '44px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          onError={e => {
            // Fallback si no existe el logo
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const next = target.nextElementSibling as HTMLElement;
            if (next) next.style.display = 'flex';
          }}
        />
        {/* Fallback logo si no carga la imagen */}
        <div style={{
          display: 'none',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: '40px', height: '40px',
            background: '#1E4E8C',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '20px', color: 'white',
          }}>
            R
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
              RECREAR
            </div>
            <div style={{ fontSize: '11px', color: '#7B9FC4', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>
              Portal de Fotos
            </div>
          </div>
        </div>

        {/* Separador */}
        <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)', marginLeft: '4px' }} />
        <span style={{ fontSize: '13px', color: '#7B9FC4', fontWeight: 400, letterSpacing: '0.02em' }}>
          Portal de Fotos
        </span>
      </div>

      {/* Right side */}
      <div style={{ position: 'relative' }} ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
            border: '1px solid',
            borderColor: menuOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)',
            cursor: 'pointer',
            padding: '8px 14px 8px 10px',
            borderRadius: '10px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={e => {
            if (!menuOpen) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }
          }}
        >
          {/* Avatar */}
          <div style={{
            width: '34px', height: '34px',
            background: '#1E4E8C',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.15)',
          }}>
            <User size={16} color="#FFFFFF" />
          </div>
          {/* Name */}
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
              {ROLE_LABELS[role]}
            </div>
            <div style={{ fontSize: '11px', color: '#7B9FC4', lineHeight: 1.2 }}>
              usuario@recrear.com
            </div>
          </div>
          <ChevronDown
            size={14}
            color="#7B9FC4"
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }}
          />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            background: '#FFFFFF', border: '1px solid #E4E4E7', borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            width: '220px', padding: '8px',
            display: 'flex', flexDirection: 'column', gap: '2px',
            zIndex: 100,
          }}>
            <div style={{ padding: '10px 14px 12px', borderBottom: '1px solid #F4F4F5', marginBottom: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#09090B' }}>{ROLE_LABELS[role]}</div>
              <div style={{ fontSize: '12px', color: '#71717A', marginTop: '2px' }}>usuario@recrear.com</div>
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontSize: '13px', color: '#374151', borderRadius: '8px',
              fontFamily: 'inherit',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <Settings size={15} color="#6B7280" /> Configuración
            </button>
            <div style={{ height: '1px', background: '#F4F4F5', margin: '2px 0' }} />
            <button style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
              padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', fontSize: '13px', color: '#EF4444', borderRadius: '8px',
              fontFamily: 'inherit',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <LogOut size={15} /> Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
