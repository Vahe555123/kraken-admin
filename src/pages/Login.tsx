import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAuthToken } from '../App';
import { buildApiUrl } from '../env';

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl('/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Invalid credentials');
        return;
      }
      if (data.ok && data.token) {
        setAuthToken(data.token);
        navigate('/dashboard');
      } else {
        setError('Login failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Admin Panel</h1>
        <p style={styles.subtitle}>Bot Credit</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="Login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            style={styles.input}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Loading...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    padding: 40,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '4px 0 24px',
    color: '#666',
    fontSize: 14,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    padding: '12px 16px',
    fontSize: 16,
    border: '1px solid #ddd',
    borderRadius: 8,
    outline: 'none',
  },
  error: {
    margin: 0,
    color: '#c00',
    fontSize: 14,
  },
  button: {
    padding: 12,
    fontSize: 16,
    fontWeight: 600,
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
};
