import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/apiClient';
import type { EmailMessage, Folder } from '../lib/types';
import ComposeModal from '../components/ComposeModal';
import RecallBanner from '../components/RecallBanner';

const DEFAULT_RECALL_WINDOW_SECONDS = 20; // fallback tampilan sebelum dapat recallDeadlineAt sungguhan

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
  const [showCompose, setShowCompose] = useState(false);
  const [composeReplyTarget, setComposeReplyTarget] = useState<EmailMessage | null>(null);
  const [pendingRecall, setPendingRecall] = useState<PendingRecall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setIsLoading(true);
    await loadEmails(folderId).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Gagal memuat email.'),
    );
    setIsLoading(false);
  }

  async function handleSelectEmail(email: EmailMessage) {
    setSelectedEmail(email);
    if (!email.isRead) {
      const updated = await api.patch<EmailMessage>(`/emails/${email.id}/flags`, { isRead: true });
      setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedEmail(updated);
    }
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

  return (
    <div className="inbox-page">
      {pendingRecall && (
        <RecallBanner
          toAddr={pendingRecall.toAddr}
          deadline={pendingRecall.deadline}
          totalSeconds={pendingRecall.totalSeconds || DEFAULT_RECALL_WINDOW_SECONDS}
          onCancel={handleCancelSend}
          onExpire={() => setPendingRecall(null)}
        />
      )}

      <div className="inbox-toolbar">
        <button className="btn-primary" onClick={() => setShowCompose(true)}>
          Compose
        </button>
        <div className="folder-tabs">
          {folders.map((folder) => (
            <button
              key={folder.id}
              className={`folder-tab${folder.id === activeFolderId ? ' active' : ''}`}
              onClick={() => handleSelectFolder(folder.id)}
            >
              {folder.folderName}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="inbox-body">
        <ul className="email-list">
          {isLoading && <li className="email-list-empty">Memuat…</li>}
          {!isLoading && emails.length === 0 && <li className="email-list-empty">Tidak ada email.</li>}
          {emails.map((email) => (
            <li
              key={email.id}
              className={`email-list-item${email.isRead ? '' : ' unread'}${
                selectedEmail?.id === email.id ? ' selected' : ''
              }`}
              onClick={() => handleSelectEmail(email)}
            >
              <div className="email-list-item-from">{email.fromAddr}</div>
              <div className="email-list-item-subject">{email.subject}</div>
              {email.sendStatus === 'queued' && <span className="badge badge-pending">Mengirim…</span>}
              {email.recalled && <span className="badge badge-recalled">Ditarik</span>}
            </li>
          ))}
        </ul>

        <div className="email-detail">
          {selectedEmail ? (
            <>
              <h2>{selectedEmail.subject}</h2>
              <p className="email-detail-meta">
                Dari <strong>{selectedEmail.fromAddr}</strong> ke {selectedEmail.toAddr}
              </p>
              <p className="email-detail-body">{selectedEmail.body}</p>
              <div className="email-detail-actions">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setComposeReplyTarget(selectedEmail);
                    setShowCompose(true);
                  }}
                >
                  Balas
                </button>
                <button className="btn-danger" onClick={() => handleDelete(selectedEmail)}>
                  Hapus
                </button>
              </div>
            </>
          ) : (
            <div className="email-detail-empty">Pilih email untuk membaca</div>
          )}
        </div>
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
