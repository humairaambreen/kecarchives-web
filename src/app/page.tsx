import type { Metadata } from "next";
import Link from "next/link";
import { HomeAuthRedirect } from "@/components/home-auth-redirect";
import { HomeFeedSection } from "@/components/home-feed-section";
import { FAQAccordion } from "@/components/faq-accordion";
import { ScrollReveal } from "@/components/scroll-reveal";

export const metadata: Metadata = {
  title: "KEC Archives — Official Academic Platform | Krishna Engineering College",
  description:
    "The official academic platform for Krishna Engineering College, Bhilai. Verified announcements, placement drives, batch-specific notices, and faculty messaging — all in one place.",
  keywords: ["KEC Archives", "Krishna Engineering College", "KEC Bhilai", "KEC student portal"],
  authors: [{ name: "Humaira Ambreen", url: "https://humairaambreen.github.io" }],
  creator: "Humaira Ambreen",
  metadataBase: new URL("https://www.kecarchives.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website", locale: "en_IN", url: "https://www.kecarchives.com", siteName: "KEC Archives",
    title: "KEC Archives — Official Academic Platform | Krishna Engineering College",
    description: "Verified announcements, placement drives, and batch-specific notices for all KEC students, faculty, and staff.",
    images: [{ url: "https://www.kecarchives.com/api/og/default", width: 1200, height: 630, alt: "KEC Archives" }],
  },
  twitter: { card: "summary_large_image", title: "KEC Archives", description: "KEC's official academic platform.", images: ["https://www.kecarchives.com/api/og/default"] },
  robots: { index: true, follow: true },
  manifest: "/site.webmanifest",
  category: "education",
};

const Chk = ({ s = 13, col = "var(--fg)" }: { s?: number; col?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const Cross = () => (
  <div aria-hidden="true" style={{ width: 13, height: 1, background: "var(--border)", margin: "0 auto" }} />
);
const ArrowR = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const BookSvg = ({ s = 14, col = "currentColor" }: { s?: number; col?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": "https://www.kecarchives.com/#website", url: "https://www.kecarchives.com", name: "KEC Archives" },
    { "@type": "EducationalOrganization", "@id": "https://www.kecarchives.com/#organization", name: "Krishna Engineering College", alternateName: "KEC Bhilai", url: "https://www.kecarchives.com", address: { "@type": "PostalAddress", streetAddress: "Khamariya", addressLocality: "Bhilai", addressRegion: "Chhattisgarh", addressCountry: "IN" } },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Who can join KEC Archives?", "acceptedAnswer": { "@type": "Answer", "text": "Anyone from Krishna Engineering College — students, faculty, and admin staff. Guests can browse public posts without an account. All registered users require faculty approval." } },
        { "@type": "Question", "name": "How does batch targeting work?", "acceptedAnswer": { "@type": "Answer", "text": "When KEC faculty create a post, they choose who sees it — a specific graduation year, all students, faculty only, or everyone. Your feed shows only content relevant to your batch and role." } },
        { "@type": "Question", "name": "Is messaging private?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Conversations require both parties to agree via a request system first. Messages are only accessible to the two participants. Faculty phone numbers are never shared." } },
        { "@type": "Question", "name": "Can I install it on my phone?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. KEC Archives is a Progressive Web App. Tap 'Add to Home Screen' in Safari or Chrome. No App Store required. It also works offline after the first load." } },
        { "@type": "Question", "name": "How is this different from LinkedIn or Instagram?", "acceptedAnswer": { "@type": "Answer", "text": "Social platforms are public, ad-driven, and unverified. KEC Archives is a closed, faculty-verified system with no ads, no follower counts, no public profiles, and strict batch-level targeting." } },
        { "@type": "Question", "name": "Who moderates content?", "acceptedAnswer": { "@type": "Answer", "text": "KEC faculty moderate all posts and comments in their departments. Admins have full platform oversight and access to audit logs." } },
        { "@type": "Question", "name": "Is my personal data safe?", "acceptedAnswer": { "@type": "Answer", "text": "Your data is never sold or shared with third parties. We use JWT authentication with short expiry, refresh token rotation, and optional 2FA for faculty accounts." } },
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeAuthRedirect />

      <style>{`

        /* ── Hard reset to prevent any overflow ── */
        html, body { max-width: 100%; overflow-x: hidden; }
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Hero animations ── */
        @keyframes heroUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:none; }
        }
        .h-nav  { animation: heroUp .6s ease .05s both; }
        .h-head { animation: heroUp .8s ease .15s both; }
        .h-foot { animation: heroUp .7s ease .32s both; }

        /* ── Image hover ── */
        .img-wrap { overflow:hidden; }
        .img-wrap img {
          width:100%; height:100%; object-fit:cover; display:block;
          filter:grayscale(20%) brightness(.74);
          transition:transform .85s cubic-bezier(.25,.46,.45,.94), filter .45s ease;
        }
        .img-wrap:hover img { transform:scale(1.05); filter:grayscale(0%) brightness(.88); }

        /* ── Nav ── */
        .h-nav-link { font-size:.7rem;color:rgba(255,255,255,.3);text-decoration:none;padding:6px 14px;transition:color .15s; }
        .h-nav-link:hover { color:rgba(255,255,255,.85); }
        .h-nav-join { font-size:.7rem;color:#fff;border:1px solid rgba(255,255,255,.22);padding:6px 16px;text-decoration:none;border-radius:6px;transition:border-color .15s,background .15s; }
        .h-nav-join:hover { background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.5); }

        /* ── Buttons ── */
        .btn-primary { border-radius:9999px;padding:12px 28px;font-size:.93rem;font-weight:600;background:var(--bg);color:var(--fg);text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:opacity .15s,transform .15s; }
        .btn-primary:hover { opacity:.84;transform:translateY(-1px); }
        .btn-outline { border-radius:9999px;padding:12px 28px;font-size:.93rem;font-weight:500;border:1.5px solid rgba(255,255,255,.2);color:var(--bg);background:transparent;text-decoration:none;display:inline-flex;align-items:center;gap:7px;transition:border-color .15s; }
        .btn-outline:hover { border-color:rgba(255,255,255,.55); }
        .btn-ink { border-radius:9999px;padding:10px 22px;font-size:.83rem;font-weight:600;background:var(--bg);color:var(--fg);text-decoration:none;transition:opacity .13s; }
        .btn-ink:hover { opacity:.8; }
        .btn-ghost { border-radius:9999px;padding:10px 22px;font-size:.83rem;font-weight:500;border:1.5px solid rgba(255,255,255,.2);color:var(--bg);background:transparent;text-decoration:none;transition:border-color .13s; }
        .btn-ghost:hover { border-color:rgba(255,255,255,.55); }

        /* ── Links ── */
        .ftl { font-size:.82rem;color:var(--fg-secondary);text-decoration:none;transition:color .13s; }
        .ftl:hover { color:var(--fg); }
        .ft-author { font-weight:700;color:var(--fg);text-decoration:none;transition:opacity .13s; }
        .ft-author:hover { opacity:.45; }
        .view-all { font-size:.82rem;color:var(--fg-muted);display:inline-flex;align-items:center;gap:5px;text-decoration:none;transition:color .13s; }
        .view-all:hover { color:var(--fg); }

        /* ── Steps ── */
        .step-row { transition:background .13s; }
        .step-row:hover { background:var(--bg); }
        .step-row:hover .sn { color:var(--fg)!important; }

        /* ── Tables ── */
        .tbl-scroll { overflow-x:auto; -webkit-overflow-scrolling:touch; width:100%; }
        .tbl-scroll::-webkit-scrollbar { height:4px; }
        .tbl-scroll::-webkit-scrollbar-track { background:var(--bg-secondary); }
        .tbl-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

        /* ── Utility ── */
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        .label-sm { font-size:.58rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--fg-muted); }

        /* ════════════════════════════
           DESKTOP  ≥ 901px
        ════════════════════════════ */
        @media(min-width:901px){
          .hero-mobile { display:none!important; }
          .hero-desktop { display:grid!important; }
          .feat-twocol { grid-template-columns:1fr 1fr!important; }
          .verified-twocol { grid-template-columns:1fr 1fr!important; }
          .stat-grid { grid-template-columns:1fr 1fr!important; }
          .ft-grid { grid-template-columns:2fr 1fr 1fr 1fr!important; }
          .faq-grid { grid-template-columns:1fr 2fr!important; }
          .testi-grid { grid-template-columns:repeat(3,1fr)!important; }
          .cta-row { flex-direction:row!important; }
          .nudge-row { flex-direction:row!important; align-items:center!important; }
        }

        /* ════════════════════════════
           MOBILE  ≤ 900px
        ════════════════════════════ */
        @media(max-width:900px){
          .hero-desktop { display:none!important; }
          .hero-mobile { display:flex!important; }
          .feat-twocol { grid-template-columns:1fr!important; }
          .verified-twocol { grid-template-columns:1fr!important; }
          .stat-grid { grid-template-columns:1fr 1fr!important; }
          .ft-grid { grid-template-columns:1fr 1fr!important; }
          .faq-grid { grid-template-columns:1fr!important; gap:0!important; }
          .faq-sticky { position:static!important; }
          .testi-main { font-size:1rem!important; }
          .testi-grid { grid-template-columns:1fr 1fr!important; }
          .feat-demo-col { border-left:none!important; border-top:1px solid var(--border); }
          .feat-demo-col-r { border-right:none!important; border-bottom:1px solid var(--border); }
          .msg-demo-col { border-right:none!important; border-bottom:1px solid var(--border); }
        }

        @media(max-width:600px){
          .testi-grid { grid-template-columns:1fr!important; }
          .ft-grid { grid-template-columns:1fr 1fr!important; }
          .ft-brand { grid-column:1/-1!important; }
          .cta-row { flex-direction:column!important; align-items:center!important; }
          .btn-primary,.btn-outline { width:100%;max-width:260px;justify-content:center; }
          .nudge-row { flex-direction:column!important; align-items:flex-start!important; }
          .nudge-btns { display:flex;gap:8px;width:100%; }
          .btn-ink,.btn-ghost { flex:1;justify-content:center;text-align:center; }
          .step-cols { flex-wrap:wrap; }
          .step-desc { width:100%; }
        }

      @media(max-width:480px){
        .ft-grid-4 .ftl { font-size:.72rem; }
        .ft-grid-4 > nav > div, .ft-grid-4 > div > div:first-child { font-size:.5rem; }
      }
      `}</style>

      {/* ══════════════════════════════════════
          HERO — Desktop (2-col mosaic)
      ══════════════════════════════════════ */}
      <section
        aria-label="KEC Archives hero"
        className="hero-desktop"
        style={{ display: "none", background: "#141210", minHeight: "100svh", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "clamp(1.6rem,3.5vw,2.6rem) clamp(1.6rem,4vw,3rem)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <nav className="h-nav" aria-label="Main navigation" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.1rem", letterSpacing: ".08em", color: "#fff" }}>KEC Archives</span>
            <div style={{ display: "flex", gap: 4 }}>
              <Link href="/auth/sign-in" className="h-nav-link">Sign in</Link>
              <Link href="/auth/register" className="h-nav-join">Join</Link>
            </div>
          </nav>
          <div className="h-head">
            <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(4rem,8vw,8.5rem)", lineHeight: .87, letterSpacing: ".01em", color: "#fff", textTransform: "uppercase", margin: 0 }}>
              PLATFORM<br />FOR<br />EVERYONE<br />
              <span style={{ color: "rgba(255,255,255,.22)" }}>BY KRISHNA<br />ENGINEERING<br />COLLEGE</span>
            </h1>
          </div>
          <div className="h-foot" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <p style={{ fontSize: ".6rem", color: "rgba(255,255,255,.2)", letterSpacing: ".12em", textTransform: "uppercase", margin: 0 }}>Academic Platform · Bhilai</p>
            <p style={{ fontSize: ".6rem", color: "rgba(255,255,255,.2)", letterSpacing: ".12em", textTransform: "uppercase", margin: 0 }}>Est. 2018 · 4
              Departments · 500+ Students</p>
          </div>
        </div>
        {/* Right — mosaic */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, padding: 3 }}>
          <div className="img-wrap" style={{ gridColumn: "1/3" }}>
            <img src="https://raw.githubusercontent.com/humairaambreen/kec/refs/heads/main/WhatsApp%20Image%202026-04-05%20at%2000.55.04.jpeg" alt="Krishna Engineering College campus" width={1200} height={600} loading="eager" fetchPriority="high" style={{ height: "100%" }} />
          </div>
          <div className="img-wrap">
            <div style={{ aspectRatio: '1/1', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <img src="https://raw.githubusercontent.com/humairaambreen/kec/refs/heads/main/WhatsApp%20Image%202026-04-05%20at%2001.25.21.jpeg" alt="Engineering college building" width={600} height={400} loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            </div>
          </div>
          <div className="img-wrap">
            <div style={{ aspectRatio: '1/1', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <img src="https://humairaambreen.github.io/assets/kec.png" alt="Students on campus" width={600} height={400} loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HERO — Mobile (full-bleed image + stacked images)
      ══════════════════════════════════════ */}
      <section
        aria-label="KEC Archives hero"
        className="hero-mobile"
        style={{ display: "none", flexDirection: "column", background: "#141210", minHeight: "100svh", borderBottom: "1px solid rgba(255,255,255,.06)" }}
      >
        {/* Top image with overlay */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "16/10", overflow: "hidden" }}>
          <img src="https://raw.githubusercontent.com/humairaambreen/kec/refs/heads/main/WhatsApp%20Image%202026-04-05%20at%2000.55.04.jpeg" alt="Krishna Engineering College campus" width={1200} height={750} loading="eager" fetchPriority="high" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.6)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(20,18,16,.45) 0%, transparent 40%, rgba(20,18,16,.9) 100%)" }} />
          {/* Nav inside image */}
          <nav style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem" }} aria-label="Main navigation">
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "1rem", letterSpacing: ".09em", color: "#fff" }}>KEC Archives</span>
            <div style={{ display: "flex", gap: 6 }}>
              <Link href="/auth/sign-in" style={{ fontSize: ".72rem", color: "rgba(255,255,255,.7)", textDecoration: "none", padding: "5px 10px" }}>Sign in</Link>
              <Link href="/auth/register" style={{ fontSize: ".72rem", color: "#fff", border: "1px solid rgba(255,255,255,.28)", padding: "5px 13px", borderRadius: 6, textDecoration: "none" }}>Join</Link>
            </div>
          </nav>
        </div>

        {/* Two side-by-side smaller images */}
        <div style={{ display: 'flex', gap: 3, padding: '3px 3px 0' }}>
          <div style={{ flex: 1, aspectRatio: '1/1', overflow: 'hidden', minWidth: 0 }}>
            <img src="https://raw.githubusercontent.com/humairaambreen/kec/refs/heads/main/WhatsApp%20Image%202026-04-05%20at%2001.25.21.jpeg" alt="Engineering college building" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.7)', display: 'block' }} />
          </div>
          <div style={{ flex: 1, aspectRatio: '1/1', overflow: 'hidden', minWidth: 0 }}>
            <img src="https://humairaambreen.github.io/assets/kec.png" alt="Students on campus" loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.7)', display: 'block' }} />
          </div>
        </div>

        {/* Text + CTAs below images */}
        <div style={{ padding: "2rem 1.25rem 2.5rem", flex: 1 }}>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(3.4rem,13vw,5.5rem)", lineHeight: .87, letterSpacing: ".01em", color: "#fff", textTransform: "uppercase", margin: "0 0 1.5rem" }}>
            PLATFORM<br />FOR<br />EVERYONE<br />
            <span style={{ color: "rgba(255,255,255,.22)" }}>BY KEC</span>
          </h1>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/auth/register" style={{ borderRadius: 9999, padding: "11px 26px", fontSize: ".88rem", fontWeight: 700, background: "#fff", color: "#141210", textDecoration: "none" }}>Create account</Link>
            <Link href="/auth/sign-in" style={{ borderRadius: 9999, padding: "11px 22px", fontSize: ".88rem", fontWeight: 500, border: "1.5px solid rgba(255,255,255,.28)", color: "#fff", background: "transparent", textDecoration: "none" }}>Sign in</Link>
          </div>
          <p style={{ marginTop: "1.5rem", fontSize: ".62rem", color: "rgba(255,255,255,.22)", letterSpacing: ".12em", textTransform: "uppercase" }}>Bhilai · 4 Departments · 500+ Students</p>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATEMENT
      ══════════════════════════════════════ */}
      <section style={{ borderBottom: "1px solid var(--border)", padding: "clamp(3rem,8vw,7rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <ScrollReveal>
            <p style={{ fontSize: "clamp(1.2rem,3.2vw,2.7rem)", fontWeight: 500, lineHeight: 1.28, letterSpacing: "-.02em", color: "var(--fg)", margin: 0 }}>
              No more WhatsApp groups where KEC notices disappear in the noise. No more missing a placement drive.{" "}
              <span style={{ color: "var(--fg-muted)", fontWeight: 400 }}>
                KEC Archives is one verified platform — built specifically for how Krishna Engineering College works.
              </span>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURE 01 — BATCH TARGETING
      ══════════════════════════════════════ */}
      <section aria-labelledby="feat-batch" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="feat-twocol" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(2.5rem,6vw,5rem) clamp(1.25rem,5vw,3.5rem)" }}>
            <ScrollReveal>
              <p className="label-sm" style={{ marginBottom: "1rem" }}>01 — Batch Targeting</p>
              <h2 id="feat-batch" style={{ fontSize: "clamp(1.5rem,3.2vw,2.6rem)", fontWeight: 700, letterSpacing: "-.026em", lineHeight: 1.1, color: "var(--fg)", marginBottom: "1rem" }}>
                The right post reaches the right people.
              </h2>
              <p style={{ fontSize: ".91rem", color: "var(--fg-secondary)", lineHeight: 1.8, maxWidth: 420, margin: "0 0 1.5rem" }}>
                Faculty choose visibility per post — Public, Students Only, a specific batch year, or Faculty Only. Your feed filters automatically.
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 9, listStyle: "none", padding: 0, margin: 0 }}>
                {["Batch 2025 notices never reach Batch 2028", "Faculty-only memos stay strictly internal", "Public posts visible to guests and KEC alumni"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Chk s={12} /><span style={{ fontSize: ".83rem", color: "var(--fg-secondary)" }}>{t}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
          <div className="feat-demo-col" style={{ background: "var(--bg-secondary)", borderLeft: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(2rem,5vw,4rem) clamp(1.25rem,4vw,3rem)" }}>
            <ScrollReveal delay={0.1} style={{ width: "100%", maxWidth: 320 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { tag: "BATCH 2027", title: "Mini Project submission deadline — Friday", dim: false },
                  { tag: "BATCH 2026", title: "Placement drive — TCS iON, Apr 22", dim: true },
                  { tag: "PUBLIC", title: "Holiday notice — Ugadi (Apr 18)", dim: false },
                  { tag: "BATCH 2026", title: "Lab exam rescheduled to Monday", dim: true },
                  { tag: "BATCH 2027", title: "IEEE format templates now available", dim: false },
                ].map((it, i) => (
                  <article key={i} style={{ borderRadius: 12, border: "1px solid var(--border)", padding: "11px 14px", background: "var(--bg)", opacity: it.dim ? 0.13 : 1, boxShadow: it.dim ? "none" : "0 2px 8px rgba(0,0,0,.05)" }}>
                    <div style={{ fontSize: ".53rem", fontWeight: 800, letterSpacing: ".1em", color: "var(--fg-muted)", marginBottom: 5 }}>{it.tag}</div>
                    <p style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.35, margin: 0 }}>{it.title}</p>
                  </article>
                ))}
                <p style={{ fontSize: ".6rem", color: "var(--fg-muted)", textAlign: "center", marginTop: 4 }}>Faded = not visible to Batch 2027</p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURE 02 — VERIFIED
      ══════════════════════════════════════ */}
      <section aria-labelledby="feat-verified" style={{ background: "var(--fg)", borderBottom: "1px solid transparent", padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="verified-twocol" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "clamp(2rem,5vw,5rem)", alignItems: "center" }}>
            <ScrollReveal>
              <p style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.26)", marginBottom: "1rem" }}>02 — Verified Community</p>
              <h2 id="feat-verified" style={{ fontSize: "clamp(1.5rem,3.2vw,2.6rem)", fontWeight: 700, letterSpacing: "-.026em", lineHeight: 1.1, color: "var(--bg)", marginBottom: "1rem" }}>
                You always know exactly who you&apos;re talking to.
              </h2>
              <p style={{ fontSize: ".91rem", lineHeight: 1.8, color: "rgba(255,255,255,.45)", marginBottom: "1.6rem" }}>
                Every account requires faculty approval before access. No anonymous strangers, no fake notices. Only your real, verified KEC community.
              </p>
              <dl className="stat-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["100%", "Verification rate"], ["0", "Anonymous accounts"], ["Faculty", "Review process"], ["< 24 hrs", "Approval time"]].map(([v, l]) => (
                  <div key={l} style={{ padding: "1rem 1.1rem", borderRadius: 12, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                    <dt style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-.025em", color: "var(--bg)", lineHeight: 1 }}>{v}</dt>
                    <dd style={{ fontSize: ".64rem", color: "rgba(255,255,255,.34)", marginTop: 4, fontWeight: 500 }}>{l}</dd>
                  </div>
                ))}
              </dl>
            </ScrollReveal>
            <ScrollReveal delay={0.1}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {[
                  { av: "PS", name: "Dr. Priya Sharma", role: "Faculty · CSE", on: true },
                  { av: "RK", name: "Prof. Ramesh Kumar", role: "Faculty · ECE", on: true },
                  { av: "AR", name: "Arjun Reddy", role: "Student · Batch 2026", on: false },
                  { av: "SP", name: "Sneha Patel", role: "Student · Batch 2027", on: true },
                  { av: "KR", name: "Dr. Kavitha Rao", role: "Faculty · Mechanical", on: true },
                ].map((u, i, arr) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,.07)" : "none" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".62rem", fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>{u.av}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: ".83rem", fontWeight: 600, color: "var(--bg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                      <div style={{ fontSize: ".66rem", color: "rgba(255,255,255,.32)", marginTop: 1 }}>{u.role}</div>
                    </div>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: u.on ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.16)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 6, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", flexShrink: 0 }}>
                      <Chk s={9} col="rgba(255,255,255,.5)" />
                      <span style={{ fontSize: ".57rem", fontWeight: 700, color: "rgba(255,255,255,.42)", letterSpacing: ".04em" }}>VERIFIED</span>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURE 03 — MESSAGING
      ══════════════════════════════════════ */}
      <section aria-labelledby="feat-msg" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="feat-twocol" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <div className="msg-demo-col" style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(2rem,5vw,4rem) clamp(1.25rem,4vw,3rem)" }}>
            <ScrollReveal delay={0.08} style={{ width: "100%", maxWidth: 300 }}>
              <div style={{ borderRadius: 20, border: "1px solid var(--border)", padding: "1.4rem", marginBottom: 10, background: "var(--bg)", boxShadow: "0 8px 32px rgba(0,0,0,.08)" }}>
                <div style={{ fontSize: ".55rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: "1rem" }}>Message Request</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: ".9rem" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".62rem", fontWeight: 700, color: "var(--fg)", flexShrink: 0 }}>AR</div>
                  <div>
                    <div style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--fg)" }}>Dr. Anitha Reddy</div>
                    <div style={{ fontSize: ".63rem", color: "var(--fg-muted)" }}>Placements Cell · Verified ✓</div>
                  </div>
                </div>
                <p style={{ fontSize: ".79rem", color: "var(--fg-secondary)", lineHeight: 1.56, marginBottom: "1rem" }}>Hi, I&apos;d like to discuss your placement preparation timeline.</p>
                <div style={{ display: "flex", gap: 7 }}>
                  <div style={{ flex: 1, background: "var(--fg)", color: "var(--bg)", borderRadius: 8, padding: "8px 0", textAlign: "center", fontSize: ".77rem", fontWeight: 600 }}>Accept</div>
                  <div style={{ flex: 1, background: "var(--bg-secondary)", color: "var(--fg-muted)", borderRadius: 8, padding: "8px 0", textAlign: "center", fontSize: ".77rem", fontWeight: 500 }}>Decline</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <div style={{ background: "var(--fg)", color: "var(--bg)", borderRadius: "14px 14px 3px 14px", padding: ".6rem 1rem", fontSize: ".79rem", maxWidth: "78%" }}>Sure, happy to connect!</div>
              </div>
              <div>
                <div style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)", borderRadius: "14px 14px 14px 3px", padding: ".6rem 1rem", fontSize: ".79rem", maxWidth: "78%" }}>Great, I&apos;ll share my schedule.</div>
              </div>
            </ScrollReveal>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "clamp(2.5rem,6vw,5rem) clamp(1.25rem,5vw,3.5rem)" }}>
            <ScrollReveal>
              <p className="label-sm" style={{ marginBottom: "1rem" }}>03 — Private Messaging</p>
              <h2 id="feat-msg" style={{ fontSize: "clamp(1.5rem,3.2vw,2.6rem)", fontWeight: 700, letterSpacing: "-.026em", lineHeight: 1.1, color: "var(--fg)", marginBottom: "1rem" }}>
                Both sides agree before the chat begins.
              </h2>
              <p style={{ fontSize: ".91rem", color: "var(--fg-secondary)", lineHeight: 1.8, maxWidth: 420, marginBottom: "1.5rem" }}>
                Message requests first. The recipient accepts or declines. Faculty phone numbers stay private forever.
              </p>
              <ul style={{ display: "flex", flexDirection: "column", gap: 9, listStyle: "none", padding: 0, margin: 0 }}>
                {["Request-first — no cold or unsolicited DMs", "Faculty phone numbers are never shared", "Both parties control their own inbox"].map(t => (
                  <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                    <Chk s={12} /><span style={{ fontSize: ".83rem", color: "var(--fg-secondary)" }}>{t}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          COMPARISON — mobile-friendly card layout
      ══════════════════════════════════════ */}
      <section aria-labelledby="compare-heading" style={{ borderBottom: "1px solid var(--border)", padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <ScrollReveal>
            <p className="label-sm" style={{ marginBottom: ".6rem" }}>Platform Comparison</p>
            <h2 id="compare-heading" style={{ fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)", marginBottom: ".4rem" }}>KEC Archives vs every alternative</h2>
            <p style={{ fontSize: ".87rem", color: "var(--fg-muted)", marginBottom: "2rem" }}>A direct comparison with tools KEC students and faculty typically use.</p>
          </ScrollReveal>

          {/* Scrollable table — contained, no page overflow */}
          <ScrollReveal delay={0.06}>
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div className="tbl-scroll">
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <caption style={{ display: "none" }}>Feature comparison</caption>
                  <thead>
                    <tr>
                      <th scope="col" style={{ padding: "12px 14px", background: "var(--bg-secondary)", textAlign: "left", fontSize: ".6rem", fontWeight: 700, color: "var(--fg-muted)", letterSpacing: ".07em", textTransform: "uppercase", borderBottom: "1px solid var(--border)", minWidth: 140 }}>Feature</th>
                      {[{ n: "KEC Archives", hi: true }, { n: "WhatsApp", hi: false }, { n: "Email", hi: false }, { n: "LinkedIn", hi: false }, { n: "Instagram", hi: false }, { n: "Notice Board", hi: false }].map(c => (
                        <th key={c.n} scope="col" style={{ padding: "12px 8px", textAlign: "center", borderLeft: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: c.hi ? "var(--fg)" : "var(--bg-secondary)", color: c.hi ? "var(--bg)" : "var(--fg-muted)", minWidth: 80 }}>
                          <div style={{ fontSize: ".7rem", fontWeight: 700 }}>{c.n}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["Batch targeting", [true, false, false, false, false, false]],
                      ["Faculty verification", [true, false, false, false, false, false]],
                      ["Searchable archive", [true, false, false, true, false, false]],
                      ["Phone privacy", [true, false, false, true, true, true]],
                      ["Push notifications", [true, true, false, true, true, false]],
                      ["Comments & reactions", [true, true, false, true, true, false]],
                      ["Direct messaging", [true, true, true, true, true, false]],
                      ["PWA / offline", [true, true, true, true, true, false]],
                      ["Role-based access", [true, false, false, false, false, false]],
                      ["No ads", [true, true, true, false, false, true]],
                      ["No follower counts", [true, true, false, false, false, true]],
                    ] as [string, boolean[]][]).map(([feat, vals], ri) => (
                      <tr key={ri} style={{ borderTop: "1px solid var(--border)", background: ri % 2 === 0 ? "var(--bg)" : "var(--bg-secondary)" }}>
                        <td style={{ padding: "10px 14px", fontSize: ".82rem", fontWeight: 500, color: "var(--fg-secondary)" }}>{feat}</td>
                        {vals.map((has, ci) => (
                          <td key={ci} style={{ padding: "10px 8px", textAlign: "center", borderLeft: "1px solid var(--border)", background: ci === 0 ? "rgba(0,0,0,.02)" : undefined }}>
                            {has ? <><Chk s={13} col={ci === 0 ? "var(--fg)" : "var(--fg-muted)"} /><span className="sr-only">Yes</span></> : <><Cross /><span className="sr-only">No</span></>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          GETTING STARTED
      ══════════════════════════════════════ */}
      <section aria-labelledby="steps-heading" style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <ScrollReveal>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", padding: "clamp(2.5rem,5vw,4rem) clamp(1.25rem,3vw,1.5rem) 1.5rem" }}>
              <div>
                <p className="label-sm" style={{ marginBottom: ".5rem" }}>Process</p>
                <h2 id="steps-heading" style={{ fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)" }}>Getting started in 4 steps</h2>
              </div>
              <span style={{ fontSize: ".64rem", fontWeight: 700, color: "var(--fg-muted)", letterSpacing: ".07em", textTransform: "uppercase" }}>≈ 2 minutes</span>
            </div>
          </ScrollReveal>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              { n: "01", title: "Sign up with your KEC email", desc: "Takes under 60 seconds. No app download — runs in any browser." },
              { n: "02", title: "Get verified by your faculty", desc: "Faculty reviews and approves your account, assigning your batch year and role." },
              { n: "03", title: "Access your personalised feed", desc: "See only posts meant for your graduation year. Zero noise." },
              { n: "04", title: "Stay permanently connected", desc: "Comment, react, message, and never miss a placement drive again." },
            ].map((s, i) => (
              <ScrollReveal key={s.n} delay={i * .055}>
                <li className="step-row" style={{ borderTop: "1px solid var(--border)", padding: "1.4rem clamp(1.25rem,3vw,1.5rem)" }}>
                  <div className="step-cols" style={{ display: "flex", alignItems: "flex-start", gap: "clamp(.8rem,3vw,2rem)" }}>
                    <span className="sn" style={{ fontSize: ".63rem", fontWeight: 700, color: "var(--fg-muted)", letterSpacing: ".07em", flexShrink: 0, marginTop: 3, minWidth: 20, transition: "color .13s" }}>{s.n}</span>
                    <h3 style={{ fontSize: ".96rem", fontWeight: 600, color: "var(--fg)", letterSpacing: "-.012em", flexShrink: 0, minWidth: "clamp(130px,22vw,210px)", lineHeight: 1.4, margin: 0 }}>{s.title}</h3>
                    <p className="step-desc" style={{ fontSize: ".86rem", color: "var(--fg-secondary)", lineHeight: 1.74, margin: 0 }}>{s.desc}</p>
                  </div>
                </li>
              </ScrollReveal>
            ))}
          </ol>
          <div style={{ height: "1.5rem" }} />
        </div>
      </section>

      {/* ══════════════════════════════════════
          ROLES TABLE
      ══════════════════════════════════════ */}
      <section aria-labelledby="roles-heading" style={{ borderBottom: "1px solid var(--border)", padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <ScrollReveal>
            <p className="label-sm" style={{ marginBottom: ".6rem" }}>Access Control</p>
            <h2 id="roles-heading" style={{ fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)", marginBottom: "2rem" }}>Roles & permissions</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.04}>
            <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
              <div className="tbl-scroll">
                <table style={{ width: "100%", minWidth: 400, borderCollapse: "collapse" }}>
                  <caption style={{ display: "none" }}>KEC Archives role permissions</caption>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}>
                      <th scope="col" style={{ padding: "12px 16px", textAlign: "left", fontSize: ".6rem", fontWeight: 700, color: "var(--fg-muted)", letterSpacing: ".09em", textTransform: "uppercase" }}>Capability</th>
                      {["Student", "Faculty", "Admin"].map(h => (
                        <th key={h} scope="col" style={{ padding: "12px 0", textAlign: "center", fontSize: ".6rem", fontWeight: 700, color: "var(--fg-muted)", letterSpacing: ".09em", textTransform: "uppercase", borderLeft: "1px solid var(--border)", width: 80 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["View public & batch posts", true, true, true],
                      ["Publish announcements", false, true, true],
                      ["Target a specific batch year", false, true, true],
                      ["Verify & approve accounts", false, true, true],
                      ["Send message requests", true, true, true],
                      ["Moderate posts & comments", false, true, true],
                      ["Assign & change user roles", false, false, true],
                      ["View full audit logs", false, false, true],
                      ["Export platform data", false, false, true],
                    ] as [string, boolean, boolean, boolean][]).map(([label, s, f, a], i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "var(--bg)" : "var(--bg-secondary)" }}>
                        <td style={{ padding: "10px 16px", fontSize: ".83rem", fontWeight: 500, color: "var(--fg-secondary)" }}>{label}</td>
                        {[s, f, a].map((has, j) => (
                          <td key={j} style={{ textAlign: "center", borderLeft: "1px solid var(--border)", padding: "10px 0" }}>
                            {has ? <><Chk s={14} /><span className="sr-only">Yes</span></> : <><Cross /><span className="sr-only">No</span></>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ══════════════════════════════════════
          LIVE FEED
      ══════════════════════════════════════ */}
      <HomeFeedSection />

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section aria-labelledby="testi-heading" style={{ borderBottom: "1px solid var(--border)", padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <ScrollReveal>
            <p className="label-sm" style={{ marginBottom: ".5rem" }}>Community</p>
            <h2 id="testi-heading" style={{ fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)", marginBottom: "2rem" }}>From the KEC community</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.05}>
            <figure style={{ borderRadius: 18, border: "1px solid var(--border)", padding: "clamp(1.4rem,4vw,2.8rem)", marginBottom: 10, background: "var(--bg-secondary)" }}>
              <blockquote>
                <p className="testi-main" style={{ fontSize: "clamp(.95rem,2.2vw,1.55rem)", fontWeight: 400, lineHeight: 1.5, letterSpacing: "-.013em", color: "var(--fg)", marginBottom: "1.5rem" }}>
                  &ldquo;I used to miss placement notices all the time because they&apos;d get buried in WhatsApp chatter. Now every KEC announcement for my batch comes straight to me, properly organised.&rdquo;
                </p>
              </blockquote>
              <figcaption style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".64rem", fontWeight: 700, color: "var(--fg)", flexShrink: 0 }}>AR</div>
                <div>
                  <div style={{ fontSize: ".86rem", fontWeight: 600, color: "var(--fg)" }}>Arjun Reddy</div>
                  <div style={{ fontSize: ".72rem", color: "var(--fg-muted)" }}>Student, CSE Batch 2026 · KEC</div>
                </div>
              </figcaption>
            </figure>
          </ScrollReveal>
          <div className="testi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { av: "KR", q: "Posting to a specific batch is so much easier. I no longer rely on WhatsApp groups.", name: "Dr. Kavitha Rao", role: "Faculty, ECE · KEC" },
              { av: "SP", q: "The message request system is thoughtful. I can reach faculty without it feeling intrusive.", name: "Sneha Patel", role: "Student, IT Batch 2027 · KEC" },
              { av: "MK", q: "The audit logs and role controls are exactly what a college platform needs.", name: "Mohammed Khan", role: "System Admin · KEC" },
            ].map((t, i) => (
              <ScrollReveal key={t.av} delay={i * .07}>
                <figure style={{ borderRadius: 18, border: "1px solid var(--border)", padding: "1.4rem", background: "var(--bg-secondary)", height: "100%", display: "flex", flexDirection: "column", margin: 0 }}>
                  <blockquote style={{ flex: 1, margin: 0 }}>
                    <p style={{ fontSize: ".87rem", color: "var(--fg-secondary)", lineHeight: 1.72, marginBottom: "1.4rem", fontStyle: "italic" }}>&ldquo;{t.q}&rdquo;</p>
                  </blockquote>
                  <figcaption style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".6rem", fontWeight: 700, color: "var(--fg)", flexShrink: 0 }}>{t.av}</div>
                    <div>
                      <div style={{ fontSize: ".8rem", fontWeight: 600, color: "var(--fg)" }}>{t.name}</div>
                      <div style={{ fontSize: ".68rem", color: "var(--fg-muted)" }}>{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FAQ
      ══════════════════════════════════════ */}
      <section aria-labelledby="faq-heading" style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "clamp(3rem,8vw,6.5rem) clamp(1.25rem,5vw,2.5rem)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div className="faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "clamp(2rem,6vw,5rem)", alignItems: "start" }}>
            <ScrollReveal>
              <p className="label-sm" style={{ marginBottom: ".6rem" }}>FAQ</p>
              <h2 id="faq-heading" className="faq-sticky" style={{ position: "sticky", top: "4.5rem", fontSize: "clamp(1.3rem,2.8vw,2rem)", fontWeight: 700, letterSpacing: "-.022em", color: "var(--fg)" }}>Frequently asked.</h2>
            </ScrollReveal>
            <ScrollReveal delay={0.06}>
              <FAQAccordion items={[
                { q: "Who can join KEC Archives?", a: "Anyone from Krishna Engineering College — students, faculty, and admin staff. Guests can browse public posts without an account. All registered users require faculty approval." },
                { q: "How does batch targeting work?", a: "When KEC faculty create a post, they choose who sees it — a specific graduation year, all students, faculty only, or everyone. Your feed shows only content relevant to your batch and role." },
                { q: "Is messaging private?", a: "Yes. Conversations require both parties to agree via a request system first. Messages are only accessible to the two participants. Faculty phone numbers are never shared." },
                { q: "Can I install it on my phone?", a: "Yes. KEC Archives is a Progressive Web App. Tap 'Add to Home Screen' in Safari or Chrome. No App Store required. It also works offline after the first load." },
                { q: "How is this different from LinkedIn or Instagram?", a: "Social platforms are public, ad-driven, and unverified. KEC Archives is a closed, faculty-verified system with no ads, no follower counts, no public profiles, and strict batch-level targeting." },
                { q: "What if I change batch year?", a: "Contact your department faculty rep or a KEC admin. They can update your profile, reassign your batch year, and adjust your role at any time." },
                { q: "Who moderates content?", a: "KEC faculty moderate all posts and comments in their departments. Admins have full platform oversight and access to audit logs." },
                { q: "Is my personal data safe?", a: "Your data is never sold or shared with third parties. We use JWT authentication with short expiry, refresh token rotation, and optional 2FA for faculty accounts." },
              ]} />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA
      ══════════════════════════════════════ */}
      <section aria-label="Call to action" style={{ background: "var(--fg)", position: "relative", overflow: "hidden", padding: "clamp(4rem,10vw,9rem) clamp(1.25rem,5vw,2.5rem)", textAlign: "center" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)`, backgroundSize: "48px 48px" }} />
        <ScrollReveal style={{ position: "relative", zIndex: 1 }}>
          <p className="label-sm" style={{ color: "rgba(255,255,255,.22)", marginBottom: ".9rem" }}>Krishna Engineering College</p>
          <h2 style={{ fontSize: "clamp(1.9rem,5.5vw,4.2rem)", fontWeight: 700, letterSpacing: "-.036em", lineHeight: 1.06, color: "var(--bg)", maxWidth: 520, margin: "0 auto 1rem" }}>
            Join your college community today.
          </h2>
          <p style={{ fontSize: "clamp(.88rem,2vw,.96rem)", color: "rgba(255,255,255,.36)", maxWidth: 340, margin: "0 auto 2.8rem", lineHeight: 1.74 }}>
            Create an account, get verified by faculty, and access everything KEC has to offer.
          </p>
          <div className="cta-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <Link href="/auth/register" className="btn-primary">Create account</Link>
            <Link href="/auth/sign-in" className="btn-outline">Log in <ArrowR /></Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <footer style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(2.5rem,6vw,5rem) clamp(1.25rem,3vw,1.5rem) clamp(1.8rem,4vw,3rem)" }}>
          {/* Brand row always full width on its own line */}
          <div style={{ marginBottom: "clamp(1.5rem,4vw,2.5rem)", paddingBottom: "clamp(1.5rem,4vw,2.5rem)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookSvg s={14} col="var(--bg)" />
              </div>
              <div>
                <div style={{ fontSize: ".9rem", fontWeight: 700, color: "var(--fg)", lineHeight: 1.1, letterSpacing: "-.018em" }}>KEC Archives</div>
                <div style={{ fontSize: ".53rem", color: "var(--fg-muted)", letterSpacing: ".05em", fontWeight: 700, textTransform: "uppercase" }}>Krishna Engineering College</div>
              </div>
            </div>
            <p style={{ fontSize: ".82rem", color: "var(--fg-secondary)", lineHeight: 1.74, maxWidth: 340, marginBottom: "1rem" }}>
              The official academic platform for Krishna Engineering College, Bhilai. Verified, secure, built for KEC.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Faculty-verified", "PWA-ready", "All 8 depts"].map(tag => (
                <span key={tag} style={{ fontSize: ".56rem", fontWeight: 700, color: "var(--fg-muted)", border: "1px solid var(--border)", borderRadius: 9999, padding: "3px 9px", letterSpacing: ".05em", textTransform: "uppercase" }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Nav columns — 2-col on mobile, 3-col on desktop */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "clamp(.8rem,3vw,2rem)" }}>
            <nav aria-label="Platform links">
              <div style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--fg-muted)", letterSpacing: ".13em", textTransform: "uppercase", marginBottom: "1rem" }}>Platform</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {[["/feed", "Feed"], ["/create-post", "Create Post"], ["/notifications", "Notifications"], ["/messages", "Messages"], ["/public-posts", "Public Posts"], ["/search", "Search"], ["/settings", "Settings"]].map(([href, label]) => (
                  <li key={href}><Link href={href} className="ftl">{label}</Link></li>
                ))}
              </ul>
            </nav>

            <div>
              <div style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--fg-muted)", letterSpacing: ".13em", textTransform: "uppercase", marginBottom: "1rem" }}>Departments</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {["CSE", "Electrical", "Mechanical", "Civil"].map(d => (
                  <li key={d} style={{ fontSize: ".82rem", color: "var(--fg-secondary)" }}>{d}</li>
                ))}
              </ul>
            </div>

          <nav aria-label="Account links">
            <div style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--fg-muted)", letterSpacing: ".13em", textTransform: "uppercase", marginBottom: "1rem" }}>Account</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {[["/auth/register","Sign Up"],["/auth/sign-in","Log In"],["/auth/forgot-password","Forgot Password"],["/profile/edit","Edit Profile"]].map(([href,label]) => (
                <li key={href}><Link href={href} className="ftl">{label}</Link></li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Dashboard links">
            <div style={{ fontSize: ".56rem", fontWeight: 800, color: "var(--fg-muted)", letterSpacing: ".13em", textTransform: "uppercase", marginBottom: "1rem" }}>Dashboards</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {[["/dashboard/student","Student"],["/dashboard/faculty","Faculty"],["/dashboard/admin","Admin"]].map(([href,label]) => (
                <li key={href}><Link href={href} className="ftl">{label}</Link></li>
              ))}
            </ul>
          </nav>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ maxWidth: 980, margin: "0 auto", padding: "1rem clamp(1.25rem,3vw,1.5rem)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".6rem" }}>
            <p style={{ fontSize: ".7rem", color: "var(--fg-muted)" }}>© {new Date().getFullYear()} KEC Archives · Krishna Engineering College, Bhilai</p>
            <p style={{ fontSize: ".7rem", color: "var(--fg-muted)" }}>
              Designed &amp; developed by{" "}
              <a href="https://humairaambreen.github.io" target="_blank" rel="noopener noreferrer" className="ft-author">Humaira Ambreen ↗</a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}