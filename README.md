# KEC Archives — Frontend

Next.js 15 frontend for [KEC Archives](https://kecarchives.vercel.app), the official academic platform for Krishna Engineering College, Bhilai.

**Live:** https://kecarchives.vercel.app  
**Backend repo:** https://github.com/humairaambreen/kecarchives-api  
**Built by:** Humaira Ambreen

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 15.5 | App framework (App Router, Edge Runtime OG images, ISR sitemap) |
| React | 19.0 | UI library |
| TypeScript | 5.7 | Type safety (strict mode) |
| Tailwind CSS | 3.4 | Utility-first styling |
| Lucide React | 0.577 | Icons |
| Geist Font | 1.7 | Primary typeface |
| js-cookie | 3.0 | JWT token management via cookies |
| PeerJS | 1.5.5 | WebRTC for peer-to-peer audio/video calls |

---

## Project Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout, global metadata, fonts
│   │   ├── page.tsx                      # Landing page with JSON-LD schema
│   │   ├── globals.css                   # Global styles and theme CSS variables
│   │   ├── feed/page.tsx                 # Main feed with tab-based filtering
│   │   ├── create-post/page.tsx          # Post creation with AI assistant
│   │   ├── search/page.tsx               # Platform-wide search
│   │   ├── notifications/page.tsx        # Notification center
│   │   ├── messages/[[...slug]]/         # Direct messages
│   │   ├── groups/[id]/                  # Group chat and settings
│   │   ├── [username]/[slug]/            # Post detail
│   │   ├── dashboard/{student,faculty,admin}/
│   │   ├── auth/{sign-in,register,forgot-password}/
│   │   └── api/og/                       # Edge Runtime OG image generation
│   ├── components/
│   │   ├── app-shell.tsx                 # Layout shell, navbar, auth guard
│   │   ├── post-card.tsx                 # Post display with all actions
│   │   ├── ai-post-helper.tsx            # AI text and image generation panel
│   │   └── share-overlay.tsx             # Share to DM / copy-link overlay
│   └── lib/
│       ├── api.ts                        # All API calls and TypeScript types
│       ├── auth-context.tsx              # Auth state, login, logout, token refresh
│       ├── feed-store.ts                 # In-memory feed and reaction cache
│       └── site.ts                       # Site-wide config constants
├── public/
│   ├── icon-192.png                      # PWA icons
│   ├── icon-512.png
│   ├── logo.png
│   └── sw.js                             # Minimal service worker
├── next.config.mjs                       # API proxy rewrites to backend
├── tailwind.config.ts
└── package.json
```

---

## Features

- **Role-based feed** — tabs for Public, Students, Batch, Faculty, and per-subject posts
- **Messaging** — direct messages with file attachments, replies, reactions, edit/delete
- **Audio/video calls** — peer-to-peer via WebRTC (PeerJS)
- **Groups** — multi-person chat with invite links, member management, and join requests
- **Notifications** — real-time polling with unread badges
- **Search** — full-text search across posts and users
- **AI assistant** — Groq LLM text generation and HuggingFace FLUX image generation on the create post page
- **Dashboards** — role-specific views for students, faculty, and admins
- **Themes** — Default, Slate, and Sepia color themes stored in localStorage
- **PWA** — installable on Android and iOS with a minimal service worker

---

## How API Calls Work

All `/api/v1/*` requests from the browser are transparently proxied to the backend via a Next.js rewrite rule in `next.config.mjs`:

```
/api/v1/:path*  →  ${BACKEND_URL}/api/v1/:path*
```

This allows the browser to make same-origin API calls. No API URL is hardcoded in the frontend code.

---

## Environment Variables

Create `apps/web/.env.local`:

```env
# Required
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Optional: site metadata
NEXT_PUBLIC_SITE_NAME=KEC Archives
NEXT_PUBLIC_DEFAULT_TITLE=KEC Archives
NEXT_PUBLIC_DEFAULT_DESCRIPTION=The official academic platform for Krishna Engineering College
NEXT_PUBLIC_TWITTER_HANDLE=@kecarchives

# Optional: SEO verification (production only)
GOOGLE_SITE_VERIFICATION=
BING_SITE_VERIFICATION=
YANDEX_SITE_VERIFICATION=
```

The backend (Groq, Cloudinary, Resend, database) does not need any environment variables on the frontend.

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0

### Install and Run

```bash
npm install
npm run dev
```

App runs at `http://localhost:3000`. The backend must be running at `http://localhost:8000` (or set `BACKEND_URL` accordingly).

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

```bash
vercel --prod
```

Set `BACKEND_URL` to the deployed backend URL in the Vercel project dashboard.
