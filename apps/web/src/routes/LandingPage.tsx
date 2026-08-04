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
  { src: '/landing/landing01.jpg', alt: 'Integrasi Aplikasi Mudah dengan SendagoMail' },
  { src: '/landing/landing02.jpg', alt: 'Setiap Notifikasi Penting, Terkirim Aman dengan SendagoMail' },
  { src: '/landing/landing03.jpg', alt: 'Kirim Email, Bangun Relasi, Tumbuhkan Bisnis dengan SendagoMail' },
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

      <section className="landing-carousel landing-carousel-image">
        <Link to="/register" className="landing-carousel-track" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
          {CAROUSEL_SLIDES.map((slide) => (
            <img key={slide.src} src={slide.src} alt={slide.alt} className="landing-carousel-slide-img" />
          ))}
        </Link>
        <div className="landing-carousel-dots">
          {CAROUSEL_SLIDES.map((slide, i) => (
            <button
              key={slide.src}
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
