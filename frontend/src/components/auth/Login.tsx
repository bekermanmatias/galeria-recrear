import { useState } from 'react';
import { api } from '../../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try { const { user } = await api.login(email, password); window.location.href = user.role === 'ADMIN' ? '/admin' : user.role === 'COORDINATOR' ? '/coordinator' : '/parent'; } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión'); } finally { setLoading(false); }
  };
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', fontFamily: 'Plus Jakarta Sans, sans-serif' }}><form onSubmit={submit} style={{ width: 'min(92vw, 390px)', padding: 32, borderRadius: 16, background: '#fff', boxShadow: '0 12px 30px #0f172a1a' }}><img src="/logo-recrear.png" alt="Recrear" style={{ height: 64, display: 'block', margin: '0 auto 20px' }} /><h1 style={{ color: '#1A4B77', fontSize: 24, margin: '0 0 8px' }}>Portal de fotos</h1><p style={{ color: '#64748b', margin: '0 0 24px' }}>Ingresá con tus credenciales.</p><label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label><label style={{ display: 'grid', gap: 6, marginBottom: 16 }}>Contraseña<input type="password" required value={password} onChange={event => setPassword(event.target.value)} style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }} /></label>{error && <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>}<button disabled={loading} style={{ width: '100%', padding: 12, border: 0, borderRadius: 8, background: '#1A4B77', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{loading ? 'Ingresando…' : 'Ingresar'}</button></form></main>;
}
