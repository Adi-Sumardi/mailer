import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, apiPutJson, apiUploadFile, apiGetImageObjectUrl, ApiError } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import type { EmailTemplate } from '../lib/types';

const DEFAULT_PRIMARY = '#e11d48';
const DEFAULT_ACCENT = '#0b1c30';

export default function TemplatePage() {
  const { user } = useAuth();
  const mailboxId = user?.mailboxId ?? null;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [logoPosition, setLogoPosition] = useState<'left' | 'center' | 'right'>('left');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [footerText, setFooterText] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadTemplate() {
    if (!mailboxId) return;
    const template = await api.get<EmailTemplate | null>(`/mailboxes/${mailboxId}/template`);
    if (template) {
      setTitle(template.title ?? '');
      setSubtitle(template.subtitle ?? '');
      setLogoPosition(template.logoPosition);
      setPrimaryColor(template.primaryColor);
      setAccentColor(template.accentColor);
      setFooterText(template.footerText ?? '');
      if (template.logoFilename) {
        const url = await apiGetImageObjectUrl(`/mailboxes/${mailboxId}/template/logo`);
        setLogoPreviewUrl(url);
      }
    }
  }

  useEffect(() => {
    loadTemplate()
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat template.'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mailboxId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!mailboxId) return;
    setError(null);
    setSuccessMsg(null);
    setIsSaving(true);
    try {
      await apiPutJson(`/mailboxes/${mailboxId}/template`, {
        title: title || undefined,
        subtitle: subtitle || undefined,
        logoPosition,
        primaryColor,
        accentColor,
        footerText: footerText || undefined,
      });
      setSuccessMsg('Template tersimpan — berlaku untuk email berikutnya yang dikirim dari alamat Anda.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan template.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !mailboxId) return;
    setError(null);
    try {
      await apiUploadFile(`/mailboxes/${mailboxId}/template/logo`, 'logo', file);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      const url = await apiGetImageObjectUrl(`/mailboxes/${mailboxId}/template/logo`);
      setLogoPreviewUrl(url);
      setSuccessMsg('Logo berhasil diunggah.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunggah logo.');
    }
  }

  async function handleRemoveLogo() {
    if (!mailboxId) return;
    try {
      await api.delete(`/mailboxes/${mailboxId}/template/logo`);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus logo.');
    }
  }

  if (!mailboxId) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Template Email</h1>
        </div>
        <p className="email-list-empty">Akun Anda belum punya mailbox — fitur ini butuh mailbox aktif.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="page-loading">Memuat…</div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Template Email</h1>
      </div>
      <p className="auth-subtitle" style={{ margin: 0 }}>
        Kustomisasi footer email yang dikirim dari alamat <strong>{user?.email}</strong> — logo, judul,
        warna, dan teks footer sendiri, menggantikan branding default SendagoMail.
      </p>

      {error && <p className="form-error">{error}</p>}
      {successMsg && <p className="form-success">{successMsg}</p>}

      <div className="template-editor">
        <form className="template-form" onSubmit={handleSave}>
          <label>
            Logo
            <div className="template-logo-row">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Logo" className="template-logo-preview" />
              ) : (
                <div className="template-logo-placeholder">Belum ada logo</div>
              )}
              <div className="template-logo-actions">
                <input type="file" id="logo-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" style={{ display: 'none' }} onChange={handleLogoSelect} />
                <button type="button" className="btn-ghost" onClick={() => document.getElementById('logo-input')?.click()}>
                  {logoPreviewUrl ? 'Ganti Logo' : 'Unggah Logo'}
                </button>
                {logoPreviewUrl && (
                  <button type="button" className="btn-ghost" onClick={handleRemoveLogo}>
                    Hapus
                  </button>
                )}
              </div>
            </div>
            <span className="template-hint">PNG, JPEG, WEBP, atau SVG — maks. 2MB</span>
          </label>

          <label>
            Posisi Logo
            <select value={logoPosition} onChange={(e) => setLogoPosition(e.target.value as 'left' | 'center' | 'right')}>
              <option value="left">Kiri</option>
              <option value="center">Tengah</option>
              <option value="right">Kanan</option>
            </select>
          </label>

          <label>
            Judul
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. SIMONAS" />
          </label>

          <label>
            Subjudul
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="mis. Digital Asrama YAPI" />
          </label>

          <div className="template-color-row">
            <label>
              Warna Utama
              <div className="template-color-input">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                <input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </label>
            <label>
              Warna Aksen
              <div className="template-color-input">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                <input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
            </label>
          </div>

          <label>
            Teks Footer
            <input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="mis. Email otomatis dari SIMONAS — mohon tidak membalas"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Menyimpan…' : 'Simpan Template'}
          </button>
        </form>

        <div className="template-preview">
          <div className="template-preview-label">Preview Footer Email</div>
          <div className="template-preview-card">
            {(title || subtitle) && (
              <div style={{ textAlign: logoPosition, marginBottom: 16 }}>
                {title && <div style={{ fontSize: 18, fontWeight: 700, color: primaryColor }}>{title}</div>}
                {subtitle && <div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{subtitle}</div>}
              </div>
            )}
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>Isi email Anda akan tampil di sini…</div>
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${accentColor}`, textAlign: logoPosition }}>
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="logo" style={{ height: 28, width: 'auto' }} />
              ) : (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>(logo default SendagoMail)</div>
              )}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                {footerText || 'Dikirim lewat SendagoMail — produk adilabs'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
