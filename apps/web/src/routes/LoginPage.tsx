import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';

export default function LoginPage() {
  const { login, login2FA } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (step === 'credentials') {
        const res = await login(email, password);
        if (res && res.require2FA && res.mfaToken) {
          setMfaToken(res.mfaToken);
          setStep('2fa');
        } else {
          navigate('/dashboard');
        }
      } else if (step === '2fa' && mfaToken) {
        await login2FA(mfaToken, twoFactorCode);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal login, coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBackToCredentials() {
    setStep('credentials');
    setMfaToken(null);
    setTwoFactorCode('');
    setError(null);
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

          {step === 'credentials' ? (
            <>
              <h1>Selamat datang kembali</h1>
              <p className="auth-subtitle">Masuk untuk kelola email domain Anda sendiri.</p>

              <label htmlFor="login-email">
                Email
                <div className="input-with-icon">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domainanda.com"
                  />
                </div>
              </label>

              <label htmlFor="login-password">
                Password
                <div className="input-with-icon">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="11" width="16" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 karakter"
                  />
                  <button
                    type="button"
                    className="input-icon-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <>
              <h1>Verifikasi Google 2FA 🔑</h1>
              <p className="auth-subtitle">
                Buka aplikasi Google Authenticator kamu dan masukkan 6 digit kode keamanan.
              </p>

              <label htmlFor="login-2fa-code">
                Kode Verifikasi (6 Digit)
                <div className="input-with-icon">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <circle cx="12" cy="16" r="1" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                  </div>
                  <input
                    id="login-2fa-code"
                    type="text"
                    required
                    maxLength={6}
                    pattern="[0-9]{6}"
                    autoFocus
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 123456"
                    style={{ letterSpacing: '3px', fontSize: '1.1rem', fontWeight: 600 }}
                  />
                </div>
              </label>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting
              ? 'Memproses…'
              : step === 'credentials'
              ? 'Masuk →'
              : 'Verifikasi Kode & Masuk →'}
          </button>

          {step === '2fa' && (
            <button
              type="button"
              className="btn-ghost btn-block"
              onClick={handleBackToCredentials}
              style={{ marginTop: '0.5rem' }}
            >
              ← Kembali ke login
            </button>
          )}

          {step === 'credentials' && (
            <p className="auth-switch">
              Belum punya akun? <Link to="/register">Daftar</Link>
            </p>
          )}
        </form>

        <div className="auth-split-illustration">
          <div className="auth-illustration-badge">🔐</div>
          <h2>Keamanan Akun Tingkat Tinggi</h2>
          <p>
            Lindungi email &amp; domain kamu dengan Autentikasi Dua Faktor (2FA) Google Authenticator.
          </p>

          <ul className="auth-illustration-list">
            <li>✓ Proteksi Google Authenticator TOTP</li>
            <li>✓ Isolasi tenant &amp; enkripsi data</li>
            <li>✓ Kontrol penuh domain milik sendiri</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

