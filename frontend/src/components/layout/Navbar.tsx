import { useState, useRef, useEffect } from 'react';
import { LogOut, Settings, User, ChevronDown, Menu } from 'lucide-react';
import { api, type SessionUser } from '../../lib/api';

interface NavbarProps {
  role: 'parent' | 'coordinator' | 'admin';
  onMenuToggle?: () => void;
}

export default function Navbar({ role, onMenuToggle }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const roleLabel = role === 'admin' ? 'Administrador' : role === 'coordinator' ? 'Coordinador' : 'Familia';
  const logout = async () => {
    try { await api.logout(); } finally { window.location.href = '/login'; }
  };
  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordMessage('');
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordMessage('Contraseña actualizada.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (reason) {
      setPasswordMessage(reason instanceof Error ? reason.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSavingPassword(false);
    }
  };

  useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener('open-account-settings', openSettings);
    api.me().then(({ user }) => setSession(user)).catch(() => { window.location.href = '/login'; });
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('open-account-settings', openSettings); };
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
                {session?.name ?? 'Cargando…'}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>
                {roleLabel}
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
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#18181B' }}>{session?.name ?? 'Cargando…'}</div>
                <div style={{ fontSize: '12px', color: '#71717A', marginTop: '2px' }}>{session?.email ?? ''}</div>
              </div>
              <div style={{ height: '1px', background: '#E4E4E7', margin: '4px 0' }} />

              <button
                onClick={logout}
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
      {settingsOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
        <form onSubmit={changePassword} style={{ width: 'min(100%,420px)', padding: 28, borderRadius: 12, background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,.22)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}><h2 style={{ margin: 0, color: '#1A4B77', fontSize: 20 }}>Cambiar contraseña</h2><button type="button" onClick={() => setSettingsOpen(false)} style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 22 }}>×</button></div>
          <label style={{ display: 'grid', gap: 7, marginBottom: 16, color: '#334155', fontSize: 13, fontWeight: 600 }}>Contraseña actual<input type="password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} style={{ padding: 11, border: '1px solid #CBD5E1', borderRadius: 7 }}/></label>
          <label style={{ display: 'grid', gap: 7, color: '#334155', fontSize: 13, fontWeight: 600 }}>Nueva contraseña<input type="password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} style={{ padding: 11, border: '1px solid #CBD5E1', borderRadius: 7 }}/></label>
          {passwordMessage && <p style={{ color: passwordMessage.includes('actualizada') ? '#15803D' : '#B91C1C', fontSize: 13 }}>{passwordMessage}</p>}
          <button disabled={savingPassword} style={{ width: '100%', marginTop: 20, padding: 12, border: 0, borderRadius: 7, background: '#1A4B77', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{savingPassword ? 'Guardando…' : 'Guardar contraseña'}</button>
        </form>
      </div>}
    </nav>
  );
}
