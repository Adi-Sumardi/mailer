import { useCallback, useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { api, apiDownloadFile, ApiError } from '../lib/apiClient';
import type { EmailAttachment, EmailMessage, Folder } from '../lib/types';
import ComposeModal from '../components/ComposeModal';
import RecallBanner from '../components/RecallBanner';

const DEFAULT_RECALL_WINDOW_SECONDS = 20; // fallback tampilan sebelum dapat recallDeadlineAt sungguhan

const FOLDER_ICON: Record<Folder['folderType'], string> = {
  inbox: '📥',
  sent: '📤',
  draft: '📝',
  trash: '🗑️',
  custom: '📁',
};

const AVATAR_PALETTE = ['#e11d48', '#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0891b2', '#65a30d', '#be185d'];

function avatarColorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsFor(addr: string): string {
  const local = addr.split('@')[0] ?? addr;
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function snippetFor(email: EmailMessage): string {
  const plain = email.isHtml ? email.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : email.body;
  const trimmed = plain.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 100)}…` : trimmed;
}

function formatListDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABEL: Record<EmailMessage['sendStatus'], { text: string; className: string } | null> = {
  draft: null,
  sent: null,
  queued: { text: 'Mengirim…', className: 'badge-pending' },
  cancelled: { text: 'Dibatalkan', className: 'badge-recalled' },
  failed: { text: 'Gagal terkirim', className: 'badge-error' },
};

interface PendingRecall {
  emailId: string;
  toAddr: string;
  deadline: Date;
  totalSeconds: number;
}

export default function InboxPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<EmailAttachment[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeReplyTarget, setComposeReplyTarget] = useState<EmailMessage | null>(null);
  const [pendingRecall, setPendingRecall] = useState<PendingRecall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadEmails = useCallback(async (folderId: string) => {
    const list = await api.get<EmailMessage[]>(`/emails/folder/${folderId}`);
    setEmails(list);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const folderList = await api.get<Folder[]>('/folders');
        setFolders(folderList);
        const inbox = folderList.find((f) => f.folderType === 'inbox') ?? folderList[0];
        if (inbox) {
          setActiveFolderId(inbox.id);
          await loadEmails(inbox.id);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat folder.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadEmails]);

  async function handleSelectFolder(folderId: string) {
    setActiveFolderId(folderId);
    setSelectedEmail(null);
    setSearchTerm('');
    setIsLoading(true);
    await loadEmails(folderId).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Gagal memuat email.'),
    );
    setIsLoading(false);
  }

  async function handleSelectEmail(email: EmailMessage) {
    setSelectedEmail(email);
    api
      .get<EmailAttachment[]>(`/emails/${email.id}/attachments`)
      .then((atts) => setSelectedAttachments(atts))
      .catch(() => setSelectedAttachments([]));

    if (!email.isRead) {
      const updated = await api.patch<EmailMessage>(`/emails/${email.id}/flags`, { isRead: true });
      setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedEmail(updated);
    }
  }

  async function handleToggleImportant(email: EmailMessage, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = await api.patch<EmailMessage>(`/emails/${email.id}/flags`, {
      isImportant: !email.isImportant,
    });
    setEmails((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (selectedEmail?.id === updated.id) setSelectedEmail(updated);
  }

  function handleSent(email: EmailMessage) {
    setShowCompose(false);
    setComposeReplyTarget(null);
    if (activeFolderId) {
      loadEmails(activeFolderId).catch(() => undefined);
    }

    if (email.sendStatus === 'queued' && email.recallDeadlineAt) {
      const deadline = new Date(email.recallDeadlineAt);
      const totalSeconds = Math.max(
        1,
        Math.round((deadline.getTime() - new Date(email.createdAt).getTime()) / 1000),
      );
      setPendingRecall({ emailId: email.id, toAddr: email.toAddr, deadline, totalSeconds });
    }
  }

  async function handleCancelSend() {
    if (!pendingRecall) return;
    try {
      await api.post(`/emails/${pendingRecall.emailId}/cancel`);
    } catch {
      // sudah lewat window di server-side / race condition — banner tetap ditutup, biarkan
      // user cek status email langsung kalau perlu.
    }
    setPendingRecall(null);
    if (activeFolderId) loadEmails(activeFolderId).catch(() => undefined);
  }

  async function handleDelete(email: EmailMessage) {
    await api.delete(`/emails/${email.id}`);
    setSelectedEmail(null);
    if (activeFolderId) loadEmails(activeFolderId).catch(() => undefined);
  }

  const visibleEmails = useMemo(() => {
    if (!searchTerm.trim()) return emails;
    const q = searchTerm.trim().toLowerCase();
    return emails.filter(
      (e) =>
        e.subject.toLowerCase().includes(q) ||
        e.fromAddr.toLowerCase().includes(q) ||
        e.toAddr.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q),
    );
  }, [emails, searchTerm]);

  const sanitizedBody = useMemo(() => {
    if (!selectedEmail) return '';
    if (!selectedEmail.isHtml) return '';
    return DOMPurify.sanitize(selectedEmail.body, { USE_PROFILES: { html: true } });
  }, [selectedEmail]);

  return (
    <div className="mail-page">
      {pendingRecall && (
        <RecallBanner
          toAddr={pendingRecall.toAddr}
          deadline={pendingRecall.deadline}
          totalSeconds={pendingRecall.totalSeconds || DEFAULT_RECALL_WINDOW_SECONDS}
          onCancel={handleCancelSend}
          onExpire={() => setPendingRecall(null)}
        />
      )}

      <div className={`mail-body${selectedEmail ? ' mail-body--detail-open' : ''}`}>
        <aside className="mail-rail">
          <button className="btn-compose" onClick={() => setShowCompose(true)}>
            <span className="btn-compose-icon">✎</span> Tulis
          </button>
          <nav className="mail-folder-nav">
            {folders.map((folder) => {
              const unreadCount =
                folder.folderType === 'inbox'
                  ? emails.filter((e) => e.folderId === folder.id && !e.isRead).length
                  : 0;
              return (
                <button
                  key={folder.id}
                  className={`mail-folder-item${folder.id === activeFolderId ? ' active' : ''}`}
                  onClick={() => handleSelectFolder(folder.id)}
                >
                  <span className="mail-folder-icon">{FOLDER_ICON[folder.folderType]}</span>
                  <span className="mail-folder-name">{folder.folderName}</span>
                  {folder.id === activeFolderId && unreadCount > 0 && (
                    <span className="mail-folder-count">{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="mail-list-pane">
          <div className="mail-search">
            <span className="mail-search-icon">🔍</span>
            <input
              type="search"
              placeholder="Cari email…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <ul className="email-list">
            {isLoading && <li className="email-list-empty">Memuat…</li>}
            {!isLoading && visibleEmails.length === 0 && (
              <li className="email-list-empty">
                {searchTerm ? 'Tidak ada hasil.' : 'Tidak ada email di folder ini.'}
              </li>
            )}
            {visibleEmails.map((email) => {
              const counterpart =
                activeFolderId && folders.find((f) => f.id === activeFolderId)?.folderType === 'sent'
                  ? email.toAddr
                  : email.fromAddr;
              const status = STATUS_LABEL[email.sendStatus];
              return (
                <li
                  key={email.id}
                  className={`email-list-item${email.isRead ? '' : ' unread'}${
                    selectedEmail?.id === email.id ? ' selected' : ''
                  }`}
                  onClick={() => handleSelectEmail(email)}
                >
                  <div
                    className="email-avatar"
                    style={{ background: avatarColorFor(counterpart) }}
                    aria-hidden="true"
                  >
                    {initialsFor(counterpart)}
                  </div>
                  <div className="email-list-item-main">
                    <div className="email-list-item-row">
                      <span className="email-list-item-from">{counterpart}</span>
                      <span className="email-list-item-date">{formatListDate(email.createdAt)}</span>
                    </div>
                    <div className="email-list-item-row">
                      <span className="email-list-item-subject">{email.subject || '(tanpa subjek)'}</span>
                    </div>
                    <div className="email-list-item-snippet">{snippetFor(email)}</div>
                    {(status || email.recalled) && (
                      <div>
                        {status && <span className={`badge ${status.className}`}>{status.text}</span>}
                        {email.recalled && <span className="badge badge-recalled">Ditarik</span>}
                      </div>
                    )}
                  </div>
                  <button
                    className={`email-star${email.isImportant ? ' active' : ''}`}
                    onClick={(e) => handleToggleImportant(email, e)}
                    aria-label="Tandai penting"
                    title="Tandai penting"
                  >
                    {email.isImportant ? '★' : '☆'}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="email-detail">
          {selectedEmail ? (
            <>
              <div className="email-detail-header">
                <button
                  type="button"
                  className="email-detail-back"
                  onClick={() => setSelectedEmail(null)}
                >
                  ← Kembali ke daftar
                </button>
                <h2>{selectedEmail.subject || '(tanpa subjek)'}</h2>
                <div className="email-detail-from-row">
                  <div
                    className="email-avatar email-avatar-lg"
                    style={{ background: avatarColorFor(selectedEmail.fromAddr) }}
                    aria-hidden="true"
                  >
                    {initialsFor(selectedEmail.fromAddr)}
                  </div>
                  <div className="email-detail-from-meta">
                    <div>
                      <strong>{selectedEmail.fromAddr}</strong>
                    </div>
                    <div className="email-detail-meta">
                      kepada {selectedEmail.toAddr} · {formatFullDate(selectedEmail.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="email-detail-body">
                {selectedEmail.isHtml ? (
                  <div className="email-html-body" dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
                ) : (
                  <p className="email-plain-body">{selectedEmail.body}</p>
                )}
              </div>

              {selectedAttachments.length > 0 && (
                <div className="email-attachments">
                  <strong>📎 Lampiran ({selectedAttachments.length}):</strong>
                  <div className="email-attachments-list">
                    {selectedAttachments.map((att) => (
                      <button
                        key={att.id}
                        type="button"
                        className="email-attachment-chip"
                        title={`Unduh ${att.filename}`}
                        onClick={() =>
                          apiDownloadFile(
                            `/emails/${selectedEmail.id}/attachments/${att.id}/download`,
                            att.filename,
                          ).catch((err) =>
                            setError(
                              err instanceof ApiError ? err.message : 'Gagal mengunduh lampiran.',
                            ),
                          )
                        }
                      >
                        📄 <strong>{att.filename}</strong> ({att.sizeKb} KB) ⬇
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="email-detail-actions">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setComposeReplyTarget(selectedEmail);
                    setShowCompose(true);
                  }}
                >
                  ↩ Balas
                </button>
                <button className="btn-danger" onClick={() => handleDelete(selectedEmail)}>
                  🗑 Hapus
                </button>
              </div>
            </>
          ) : (
            <div className="email-detail-empty">Pilih email untuk membaca</div>
          )}
        </section>
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => {
            setShowCompose(false);
            setComposeReplyTarget(null);
          }}
          onSent={handleSent}
          replyTo={
            composeReplyTarget
              ? {
                  toAddr: composeReplyTarget.fromAddr,
                  subject: composeReplyTarget.subject,
                  parentEmailId: composeReplyTarget.id,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
