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

interface CarouselSlide {
  eyebrow: string;
  title: string;
  description: string;
  gradient: string;
  to: string;
  cta: string;
}

const CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    eyebrow: 'WEBMAIL',
    title: 'Mail yang terasa seperti Gmail',
    description: 'Inbox 3-panel, HTML email aman, pencarian cepat — semua di domain Anda sendiri.',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #7c1d3f 100%)',
    to: '/register',
    cta: 'Coba Gratis',
  },
  {
    eyebrow: 'API',
    title: 'Kirim OTP & reset password dalam 1 request',
    description: 'Integrasi cepat lewat REST API — contoh kode cURL, PHP, Python, Node.js, Java.',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)',
    to: '/register',
    cta: 'Lihat Dokumentasi',
  },
  {
    eyebrow: 'AUTOMATION',
    title: 'Biarkan AI Agent yang triase inbox Anda',
    description: 'Aturan otomatis + dukungan AI agent (OpenAI & Anthropic) untuk penanganan email masuk.',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
    to: '/register',
    cta: 'Mulai Sekarang',
  },
];

const FEATURES = [
  { icon: '📥', title: 'Mail', desc: 'Webmail modern, folder, recall/unsend, lampiran file.' },
  { icon: '📅', title: 'Kalender', desc: 'Jadwalkan acara & undang peserta internal.' },
  { icon: '✅', title: 'Tugas', desc: 'To-do list dengan prioritas dan tenggat waktu.' },
  { icon: '🤖', title: 'Automation', desc: 'Filter otomatis + opsi AI Agent untuk triase email.' },
  { icon: '📡', title: 'Integrasi API', desc: 'Kirim email transaksional lewat REST API sederhana.' },
  { icon: '🎨', title: 'Template Branding', desc: 'Logo, warna, judul kustom per alamat pengirim.' },
];

export default function LandingPage() {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % CAROUSEL_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-page">
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
            Daftar
          </Link>
        </div>
      </header>

      <div className="landing-marquee">
        <div className="landing-marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="landing-marquee-item">
              {item}
            </span>
          ))}
        </div>
      </div>

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

      <section className="landing-carousel">
        <div
          className="landing-carousel-track"
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {CAROUSEL_SLIDES.map((slide) => (
            <div key={slide.title} className="landing-carousel-slide" style={{ background: slide.gradient }}>
              <span className="landing-carousel-eyebrow">{slide.eyebrow}</span>
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <Link to={slide.to} className="landing-carousel-cta">
                {slide.cta} →
              </Link>
            </div>
          ))}
        </div>
        <div className="landing-carousel-dots">
          {CAROUSEL_SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              className={`landing-carousel-dot${i === slideIndex ? ' active' : ''}`}
              onClick={() => setSlideIndex(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="landing-features">
        <h2 className="landing-section-title">Semua yang Anda butuhkan, satu platform</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <span className="landing-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-band">
        <h2>Siap kelola email dengan domain Anda sendiri?</h2>
        <Link to="/register" className="btn-primary btn-lg">
          Daftar Sekarang →
        </Link>
      </section>

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
