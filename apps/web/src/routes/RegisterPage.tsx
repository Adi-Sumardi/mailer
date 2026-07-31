import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      // Fase 1 UI: registrasi selalu sebagai end_user dengan tenantId yang sudah ada
      // (dibuat Super Admin/Tenant Admin lewat domain-provisioning). Alur tenant_admin/
      // super_admin onboarding belum ada layar terpisah — lihat README.
      await register({ email, password, role: 'end_user', tenantId });
      navigate('/inbox');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mendaftar, coba lagi.');
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

          <h1>Buat Akun Baru</h1>
          <p className="auth-subtitle">Kelola email profesional dengan domain sendiri.</p>

          <label htmlFor="reg-email">
            Email
            <div className="input-with-icon">
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </div>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domainanda.com"
              />
            </div>
          </label>

          <label htmlFor="reg-password">
            Password
            <div className="input-with-icon">
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
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

          <label htmlFor="reg-tenant-id">
            Tenant ID
            <div className="input-with-icon">
              <div className="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 21V8l9-5 9 5v13" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </div>
              <input
                id="reg-tenant-id"
                type="text"
                required
                autoComplete="off"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="Diberikan oleh Tenant Admin Anda"
              />
            </div>
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Memproses…' : 'Daftar →'}
          </button>

          <p className="auth-switch">
            Sudah punya akun? <Link to="/login">Masuk</Link>
          </p>
        </form>

        <div className="auth-split-illustration">
          <div className="auth-illustration-badge">🚀</div>
          <h2>Mulai dalam Hitungan Menit</h2>
          <p>
            Satu akun untuk mail, kalender, tugas, dan automation rules — semua terintegrasi
            dalam satu workspace produktivitas.
          </p>
          <ul className="auth-illustration-list">
            <li>✓ Setup domain otomatis (SPF/DKIM/DMARC)</li>
            <li>✓ UI kustom, bukan template generik</li>
            <li>✓ Data Anda, kendali penuh di tangan Anda</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
