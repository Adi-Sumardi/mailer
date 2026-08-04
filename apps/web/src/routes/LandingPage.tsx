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

const CONTACT_EMAIL = 'sendagomail@adilabs.id';

interface PricingPlan {
  icon: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  price: string;
  priceNote: string;
  accent: 'green' | 'teal';
}

const PRICING_PLANS: PricingPlan[] = [
  {
    icon: '🪙',
    name: 'Paket Coba',
    tagline: 'Cara termurah untuk mencoba semua fitur',
    description:
      '1 domain custom terverifikasi otomatis, kuota API sandbox harian, dan akses penuh ke Mail, Kalender, Tugas, dan Automation — cara termurah untuk mencoba semua fitur SendagoMail.',
    features: [
      '1 domain custom (SPF/DKIM/DMARC otomatis)',
      'Kuota API sandbox 50 email/hari',
      '1 mailbox pengirim + Template branding',
      'Akses penuh Webmail, Kalender, Tugas, Automation',
    ],
    price: 'Rp 149.000',
    priceNote: 'Sekali bayar',
    accent: 'green',
  },
  {
    icon: '🖥️',
    name: 'Paket Pasangin',
    tagline: 'Kami setup semuanya untuk Anda',
    description: 'Deployment SendagoMail khusus (self-hosted) yang kami siapkan end-to-end untuk bisnis Anda.',
    features: [
      'Gratis server & instalasi SendagoMail khusus (self-hosted)',
      'Setup domain + DKIM/SPF/DMARC tanpa batas',
      'Kuota API production disesuaikan kebutuhan',
      'Template branding kustom disiapkan tim kami',
      'Pendampingan integrasi API pertama + support prioritas',
    ],
    price: 'Rp 7.999.000',
    priceNote: 'Sekali bayar',
    accent: 'teal',
  },
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
        <span className="landing-hero-icon">{slide.icon}</span>
        <h1>{slide.title}</h1>
        <p>{slide.desc}</p>
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
        <div className="landing-hero-actions">
          <Link to="/register" className="btn-primary btn-lg">
            Mulai Gratis →
          </Link>
          <Link to="/login" className="btn-ghost btn-lg">
            Sudah punya akun? Login
          </Link>
        </div>
      </section>

      <div className="landing-feature-tags">
        {FEATURE_TAGS.map((f) => (
          <span key={f.label} className="landing-feature-tag">
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      <section className="landing-pricing">
        <h2 className="landing-section-title">Pilih Paket SendagoMail</h2>
        <div className="landing-pricing-grid">
          {PRICING_PLANS.map((plan) => (
            <div key={plan.name} className={`landing-pricing-card accent-${plan.accent}`}>
              <div className="landing-pricing-card-header">
                <span className="landing-pricing-icon">{plan.icon}</span>
                <div>
                  <h3>{plan.name}</h3>
                  <span className="landing-pricing-tagline">{plan.tagline}</span>
                </div>
              </div>
              <p className="landing-pricing-desc">{plan.description}</p>
              <ul className="landing-pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <span className="landing-pricing-check">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="landing-pricing-price">
                {plan.price}
                <span className="landing-pricing-price-note">{plan.priceNote}</span>
              </div>
              <a
                className="landing-pricing-cta"
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Tanya ${plan.name} SendagoMail`)}`}
              >
                Hubungi Kami
              </a>
            </div>
          ))}
        </div>
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
