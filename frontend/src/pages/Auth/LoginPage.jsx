import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import './Auth.css';

function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ email: '', username: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.details?.join(', ') || 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Animated background grid */}
      <div className="auth-grid" />

      <div className="auth-container fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">Q</div>
          <div>
            <div className="auth-logo-title">QuantDesk</div>
            <div className="auth-logo-sub">Bloomberg-Grade Terminal</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            id="tab-login"
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign In
          </button>
          <button
            id="tab-register"
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                id="input-fullname"
                className="form-input"
                type="text"
                name="full_name"
                placeholder="John Doe"
                value={form.full_name}
                onChange={handleChange}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="input-email"
              className="form-input"
              type="email"
              name="email"
              placeholder="trader@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                id="input-username"
                className="form-input"
                type="text"
                name="username"
                placeholder="john_trader"
                value={form.username}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={30}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="input-password"
              className="form-input"
              type="password"
              name="password"
              placeholder={mode === 'register' ? 'Min 8 characters' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              required
              minLength={mode === 'register' ? 8 : 1}
            />
          </div>

          {error && (
            <div className="auth-error">
              <span>⚠</span> {error}
            </div>
          )}

          <button
            id="btn-submit"
            type="submit"
            className="btn btn-primary w-full"
            style={{ justifyContent: 'center', padding: '10px', fontSize: '13px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'
            )}
          </button>
        </form>

        {/* Demo hint */}
        {mode === 'login' && (
          <div className="auth-hint">
            <span className="text-muted font-mono text-xs">Demo: </span>
            <code className="auth-code">admin@quantdesk.local</code>
            <span className="text-muted font-mono text-xs"> / </span>
            <code className="auth-code">admin123</code>
          </div>
        )}

        <div className="auth-footer">
          QuantDesk v1.0 · Self-hosted · Zero recurring cost
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
