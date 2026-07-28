import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { EmailMessage } from '../lib/types';

interface ComposeModalProps {
  onClose: () => void;
  onSent: (email: EmailMessage) => void;
  replyTo?: { toAddr: string; subject: string; parentEmailId: string };
}

export default function ComposeModal({ onClose, onSent, replyTo }: ComposeModalProps) {
  const [toAddr, setToAddr] = useState(replyTo?.toAddr ?? '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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
          <h2>Compose</h2>
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
          <input type="text" required value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>

        <label>
          Isi
          <textarea rows={10} required value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn-primary" disabled={isSending}>
            {isSending ? 'Mengirim…' : 'Kirim'}
          </button>
        </div>
      </form>
    </div>
  );
}
