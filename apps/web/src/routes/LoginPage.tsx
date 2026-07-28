import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/inbox');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal login, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-split-page">
      <div className="auth-split-card">
        <form className="auth-split-form" onSubmit={handleSubmit}>
          <div className="auth-brand">
            <img src="/logo.png" alt="SendagoMail" className="auth-brand-mark" />
            <div>
              <div className="auth-brand-name">SendagoMail</div>
              <div className="auth-brand-tagline">EMAIL ENGINE</div>
            </div>
          </div>

          <h1>Selamat datang kembali</h1>
          <p className="auth-subtitle">Masuk untuk kelola email domain Anda sendiri.</p>

          <label>
            Email
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domainanda.com"
              />
            </div>
          </label>

          <label>
            Password
            <div className="input-with-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="input-icon-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Memproses…' : 'Masuk →'}
          </button>

          <p className="auth-switch">
            Belum punya akun? <Link to="/register">Daftar</Link>
          </p>
        </form>

        <div className="auth-split-illustration">
          <div className="auth-illustration-badge">✉️</div>
          <h2>Email Profesional, Domain Sendiri</h2>
          <p>
            Kirim &amp; terima email dengan alamat domain Anda sendiri — self-hosted, kontrol
            penuh, tanpa biaya langganan bulanan pihak ketiga.
          </p>
          <ul className="auth-illustration-list">
            <li>✓ Recall/Unsend email kapan saja</li>
            <li>✓ Kalender &amp; tugas terintegrasi</li>
            <li>✓ Automation rules untuk inbox Anda</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
