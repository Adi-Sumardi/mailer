import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const MARQUEE_ITEMS = [
  '✉️ Email domain sendiri, self-hosted, kontrol penuh',
  '🔁 Recall/Unsend email dalam hitungan detik',
  '📡 REST API kirim OTP & notifikasi transaksional',
  '🔐 SPF · DKIM · DMARC otomatis untuk domain baru',
  '🤖 Automation rules + AI Agent (OpenAI/Anthropic)',
  '🎨 Branding kustom per pengirim — logo & warna sendiri',
];

const CAROUSEL_SLIDES = [
  { icon: '📥', title: 'Mail yang terasa seperti Gmail', desc: 'Inbox 3-panel, HTML email aman, pencarian cepat — semua di domain Anda sendiri.' },
  { icon: '📡', title: 'Kirim OTP & notifikasi dalam 1 request', desc: 'Integrasi REST API cepat — contoh kode cURL, PHP, Python, Node.js, Java.' },
  { icon: '🤖', title: 'AI Agent untuk triase inbox', desc: 'Automation rules + dukungan AI agent (OpenAI & Anthropic) untuk email masuk.' },
  { icon: '🎨', title: 'Branding email sepenuhnya milik Anda', desc: 'Logo, warna, judul kustom per alamat pengirim — bukan branding generik.' },
];

const FEATURE_TAGS = [
  { icon: '📥', label: 'Webmail modern' },
  { icon: '📡', label: 'REST API transaksional' },
  { icon: '🔐', label: 'SPF · DKIM · DMARC otomatis' },
  { icon: '🤖', label: 'Automation + AI Agent' },
];

export default function LandingPage() {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const slide = CAROUSEL_SLIDES[slideIndex];

  return (
    <div className="landing-page">
      <div className="landing-marquee">
        <div className="landing-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="landing-marquee-item">
              {item}
            </span>
          ))}
        </div>
      </div>

      <header className="landing-nav">
        <div className="landing-nav-brand">
          <img src="/logo.png" alt="SendagoMail" />
          SendagoMail
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn-ghost">
            Login
          </Link>
          <Link to="/register" className="btn-primary">
            Daftar Gratis
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <h1>Platform Email Multi-Tenant, Self-Hosted, Milik Anda Sendiri</h1>
        <p>
          Kirim &amp; terima email dengan domain Anda sendiri, integrasikan OTP/notifikasi lewat API,
          dan otomatiskan inbox — tanpa biaya langganan bulanan pihak ketiga.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="btn-primary btn-lg">
            Mulai Gratis →
          </Link>
          <Link to="/login" className="btn-ghost btn-lg">
            Sudah punya akun? Login
          </Link>
        </div>
      </section>

      <section className="landing-text-carousel">
        <div className="landing-text-carousel-card">
          <span className="landing-text-carousel-icon">{slide.icon}</span>
          <h2>{slide.title}</h2>
          <p>{slide.desc}</p>
        </div>
        <div className="landing-carousel-dots">
          {CAROUSEL_SLIDES.map((s, i) => (
            <button
              key={s.title}
              className={`landing-carousel-dot${i === slideIndex ? ' active' : ''}`}
              onClick={() => setSlideIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <div className="landing-feature-tags">
        {FEATURE_TAGS.map((f) => (
          <span key={f.label} className="landing-feature-tag">
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      <footer className="landing-footer">
        <div className="landing-nav-brand">
          <img src="/logo.png" alt="SendagoMail" />
          SendagoMail
        </div>
        <span>Produk adilabs · Platform email multi-tenant self-hosted</span>
      </footer>
    </div>
  );
}
