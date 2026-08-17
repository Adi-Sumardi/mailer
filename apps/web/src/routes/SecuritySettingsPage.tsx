import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/apiClient';

export default function SecuritySettingsPage() {
  const { user, generate2FA, enable2FA, disable2FA } = useAuth();

  const [setupData, setSetupData] = useState<{ secret: string; otpauthUrl: string; qrCodeUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleStartSetup() {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const data = await generate2FA();
      setSetupData(data);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat QR Code 2FA');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEnable2FA(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await enable2FA(code);
      setSuccess('Google 2FA berhasil diaktifkan! Akun kamu sekarang dilindungi 2FA.');
      setSetupData(null);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengaktifkan 2FA. Pastikan kode 6 digit benar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDisable2FA(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      await disable2FA(disableCode);
      setSuccess('Google 2FA berhasil dinonaktifkan.');
      setShowDisableForm(false);
      setDisableCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menonaktifkan 2FA. Pastikan kode 6 digit benar.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div className="card-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Keamanan Akun (Google 2FA)</h1>
        <p style={{ color: 'var(--text-muted, #6b7280)', marginTop: '0.25rem' }}>
          Kelola Autentikasi Dua Faktor (2FA) untuk meningkatkan keamanan login akun kamu.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '0.375rem' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '0.375rem' }}>
          ✅ {success}
        </div>
      )}

      <div className="card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Google Authenticator (TOTP)</h3>
            <p style={{ color: '#4b5563', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Meminta kode 6 digit dari aplikasi Google Authenticator setiap kali kamu login.
            </p>
          </div>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: user?.isTwoFactorEnabled ? '#dcfce7' : '#f3f4f6',
              color: user?.isTwoFactorEnabled ? '#166534' : '#6b7280',
            }}
          >
            {user?.isTwoFactorEnabled ? '🔒 Aktif' : '⚪ Nonaktif'}
          </span>
        </div>

        {!user?.isTwoFactorEnabled && !setupData && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartSetup}
              disabled={isSubmitting}
              style={{ padding: '0.6rem 1.2rem' }}
            >
              {isSubmitting ? 'Menyiapkan…' : '🔑 Aktifkan Google 2FA'}
            </button>
          </div>
        )}

        {setupData && !user?.isTwoFactorEnabled && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Langkah-Langkah Setup Google 2FA:</h4>
            <ol style={{ paddingLeft: '1.25rem', color: '#374151', lineHeight: '1.6' }}>
              <li>Buka aplikasi <strong>Google Authenticator</strong> (atau Authy / 1Password) di HP kamu.</li>
              <li>Pindai (scan) QR Code di bawah ini:</li>
            </ol>

            <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
              <img
                src={setupData.qrCodeUrl}
                alt="QR Code Google 2FA"
                style={{ width: '180px', height: '180px', border: '1px solid #e5e7eb', padding: '0.5rem', borderRadius: '0.5rem', background: '#fff' }}
              />
              <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                Atau masukkan Kunci Setup secara manual:
                <br />
                <code style={{ background: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 700, letterSpacing: '1px', color: '#111827' }}>
                  {setupData.secret}
                </code>
              </div>
            </div>

            <form onSubmit={handleEnable2FA} style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <label htmlFor="verify-2fa-code" style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                3. Masukkan 6 Digit Kode dari Google Authenticator:
              </label>
              <input
                id="verify-2fa-code"
                type="text"
                required
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{
                  width: '100%',
                  maxWidth: '240px',
                  padding: '0.6rem 0.8rem',
                  fontSize: '1.2rem',
                  letterSpacing: '3px',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" className="btn-primary" disabled={isSubmitting || code.length !== 6}>
                  {isSubmitting ? 'Verifikasi…' : 'Verifikasi & Aktifkan 2FA'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setSetupData(null)}>
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {user?.isTwoFactorEnabled && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ color: '#15803d', fontWeight: 600, marginBottom: '1rem' }}>
              🔒 Akun kamu telah dilindungi oleh Google 2FA. Setiap kali login, kamu wajib memasukkan 6 digit kode dari Google Authenticator.
            </p>

            {!showDisableForm ? (
              <button
                type="button"
                className="btn-danger"
                onClick={() => setShowDisableForm(true)}
                style={{ padding: '0.5rem 1rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Nonaktifkan Google 2FA
              </button>
            ) : (
              <form onSubmit={handleDisable2FA} style={{ background: '#fef2f2', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#991b1b', fontWeight: 600 }}>Konfirmasi Menonaktifkan 2FA</h4>
                <p style={{ fontSize: '0.875rem', color: '#7f1d1d', marginBottom: '1rem' }}>
                  Masukkan 6 digit kode dari Google Authenticator kamu untuk mengonfirmasi penonaktifan:
                </p>
                <input
                  id="disable-2fa-code"
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  style={{
                    width: '100%',
                    maxWidth: '240px',
                    padding: '0.6rem 0.8rem',
                    fontSize: '1.2rem',
                    letterSpacing: '3px',
                    fontWeight: 600,
                    marginBottom: '1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #fca5a5',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="submit" className="btn-danger" disabled={isSubmitting || disableCode.length !== 6} style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem' }}>
                    {isSubmitting ? 'Memproses…' : 'Ya, Nonaktifkan 2FA'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setShowDisableForm(false)}>
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
