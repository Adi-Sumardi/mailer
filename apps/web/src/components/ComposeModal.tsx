import { useState, type FormEvent, type ChangeEvent } from 'react';
import { api, apiUploadFile, ApiError } from '../lib/apiClient';
import type { EmailMessage } from '../lib/types';

interface AttachedFileItem {
  filename: string;
  sizeKb: number;
  fileObj: File;
}

interface ComposeModalProps {
  onClose: () => void;
  onSent: (email: EmailMessage) => void;
  replyTo?: { toAddr: string; subject: string; parentEmailId: string };
}

export default function ComposeModal({ onClose, onSent, replyTo }: ComposeModalProps) {
  const [toAddr, setToAddr] = useState(replyTo?.toAddr ?? '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachedFileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).map((f) => ({
      filename: f.name,
      sizeKb: Math.max(1, Math.ceil(f.size / 1024)),
      fileObj: f,
    }));
    setAttachments((prev) => [...prev, ...selected]);
    e.target.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    try {
      const email = await api.post<EmailMessage>('/emails', {
        toAddr,
        subject,
        body,
        parentEmailId: replyTo?.parentEmailId,
      });

      // Upload file SUNGGUHAN (multipart), bukan metadata. Kegagalan di sini TIDAK boleh
      // ditelan diam-diam — dulu error di-.catch(() => undefined) sehingga user melihat
      // "terkirim" padahal lampirannya tidak pernah ikut. Sekarang error dilempar ke atas
      // supaya user tahu dan bisa mengulang.
      for (const att of attachments) {
        await apiUploadFile(`/emails/${email.id}/attachments`, 'file', att.fileObj);
      }

      onSent(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim email.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-card compose-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h2>Tulis Email (Compose)</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Tutup">
            ✕
          </button>
        </div>

        <label>
          Kepada
          <input
            type="email"
            required
            value={toAddr}
            onChange={(e) => setToAddr(e.target.value)}
            placeholder="penerima@domain.com"
          />
        </label>

        <label>
          Subjek
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subjek email"
          />
        </label>

        <label>
          Isi Pesan
          <textarea
            rows={8}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis isi pesan email..."
          />
        </label>

        {/* Section Attachment File */}
        <div style={{ marginTop: '12px', marginBottom: '12px' }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: '13px', marginBottom: '6px' }}>
            📎 Lampiran / Attachment File
          </label>
          <input
            type="file"
            multiple
            id="compose-file-input"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className="btn-ghost"
            style={{
              border: '1px dashed var(--color-outline-variant)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
            onClick={() => document.getElementById('compose-file-input')?.click()}
          >
            + Tambah Lampiran File
          </button>

          {attachments.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--color-surface-variant)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                >
                  <span>
                    📎 <strong>{att.filename}</strong> ({att.sizeKb} KB)
                  </span>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '2px 6px', color: 'var(--color-error)' }}
                    onClick={() => removeAttachment(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={isSending}>
            {isSending ? 'Mengirim…' : 'Kirim Email'}
          </button>
        </div>
      </form>
    </div>
  );
}
