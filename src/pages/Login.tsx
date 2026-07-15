import { useState } from 'react';
import { login } from '../lib/auth';
import { logActivity } from '../lib/logger';

interface LoginProps {
  onLoginSuccess: () => void;
}

const USERS = [
  { key: 'jorge', label: 'Jorge Quispe', avatar: 'JQ' },
  { key: 'isamar', label: 'Isamar Silvestre', avatar: 'IS' },
];

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return setError('Selecciona un usuario.');
    setLoading(true);
    setError('');

    const user = login(selectedUser, password);

    if (user) {
      await logActivity('LOGIN', `${user.name} inició sesión en el sistema.`);
      onLoginSuccess();
    } else {
      setError('Contraseña incorrecta. Intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: '3rem 2.5rem'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            width: '80px', 
            height: '80px', 
            background: 'var(--color-primary)', 
            color: '#000', 
            borderRadius: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '40px',
            fontWeight: '900',
            margin: '0 auto 1.5rem',
            boxShadow: '0 0 30px rgba(255, 128, 0, 0.4)'
          }}>Z</div>
          <h1 style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '-0.02em', margin: '0 0 0.25rem' }}>ZIGMA ERP</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Gestión Comercial · Industrial</p>
        </div>

        {/* User selector */}
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem', textAlign: 'center' }}>Selecciona tu Perfil</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {USERS.map(u => (
              <button
                key={u.key}
                type="button"
                onClick={() => { setSelectedUser(u.key); setError(''); }}
                className={`glass-panel ${selectedUser === u.key ? 'active-user' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '1.25rem',
                  border: selectedUser === u.key ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: selectedUser === u.key ? 'rgba(255,128,0,0.1)' : 'rgba(255,255,255,0.02)',
                  transform: selectedUser === u.key ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: selectedUser === u.key ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', fontSize: '1.25rem', color: selectedUser === u.key ? '#000' : 'var(--color-text)',
                  boxShadow: selectedUser === u.key ? '0 0 20px rgba(255, 128, 0, 0.3)' : 'none'
                }}>
                  {u.avatar}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{u.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
              Contraseña
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {error && (
            <div className="animate-fade-in" style={{
              padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px', color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1.5rem',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !selectedUser}
            style={{ width: '100%', padding: '1rem' }}
          >
            {loading ? 'Verificando...' : 'Entrar al Sistema'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2rem', letterSpacing: '0.05em' }}>
          ZIGMA INDUSTRIAL ERP · v1.0
        </p>
      </div>
    </div>
  );
};

export default Login;
