import { useEffect, useState } from 'react';

interface RecallBannerProps {
  toAddr: string;
  deadline: Date;
  totalSeconds: number;
  onCancel: () => void;
  onExpire: () => void;
}

// FR-11a.2: banner delayed-send untuk penerima eksternal — countdown visual + tombol batalkan
// selama masih dalam jendela waktu. Lihat docs/UIUX_Design_Spec_SendagoMail.md §5.1.
export default function RecallBanner({
  toAddr,
  deadline,
  totalSeconds,
  onCancel,
  onExpire,
}: RecallBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onExpire();
      }
    }, 250);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  const progressPct = Math.min(100, Math.max(0, (secondsLeft / totalSeconds) * 100));

  return (
    <div className="recall-banner" role="status">
      <div className="recall-banner-text">
        Email dikirim ke <strong>{toAddr}</strong>. Batalkan? ({secondsLeft}s)
      </div>
      <div className="recall-banner-progress">
        <div className="recall-banner-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <button className="btn-cancel-send" onClick={onCancel}>
        Batalkan Pengiriman
      </button>
    </div>
  );
}
