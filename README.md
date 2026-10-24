# ⚡ SnapAI (SnapBunny.ai)

> High-performance, watermark-free media downloader and AI enhancer platform for TikTok & Douyin with 2x/4x Super-Resolution image upscaling. Fully responsive — works on phones, tablets, desktops, and every window size in between.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Responsive](https://img.shields.io/badge/Responsive-Mobile%20First-FF6B6B)](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- 🎬 **Multi-Platform Link Extractor** — Parses TikTok, Douyin, and short URLs (`vt.tiktok.com`, `v.douyin.com`) for videos and slideshows.
- 🚫 **No-Watermark Video Streams** — Direct access to pristine original resolution without watermarks or user tags.
- 📐 **Quality Resolution Selection** — Choose between Standard Definition (SD) and Full High Definition (HD).
- 🖼️ **Super-Resolution Image Enhancer** — Fast local 2x / 4x upscaling via **Sharp** (Lanczos3 + Unsharp Masking) on CPU.
- 🎵 **Audio Extraction** — Download background music tracks directly as MP3 files.
- 🔒 **Stream Proxy** — Pipes media from upstream CDNs to the browser, bypassing CORS and 403 referrer checks.
- 🤖 **AI Upscaling Ready** — Pre-wired for Real-ESRGAN / GFPGAN via Replicate API.
- 📱 **Fully Responsive** — Adaptive layout for phones (320px+), tablets, laptops, desktops, and resized browser windows.

---

## 📱 Responsive Design

The UI adapts seamlessly across all screen sizes and orientations:

| Device | Screen Width | Layout |
|:-------|:-------------|:-------|
| 📱 Phone (portrait) | 320px — 639px | Single column, stacked buttons, touch-friendly 48px targets |
| 📱 Phone (landscape) | 640px — 767px | 2-column grid, side-by-side buttons |
| 📋 Tablet | 768px — 1023px | 3-column image grid, expanded info cards |
| 💻 Laptop / Desktop | 1024px+ | Full 4-column grid, all metadata visible |
| 🪟 Narrow window | Any width | Reflows just like the matching mobile breakpoint |

**Additional mobile optimizations:**
- Safe area insets for iPhone notch / Dynamic Island / Android gesture bar
- iOS zoom prevention on input focus (16px minimum font)
- Touch targets meet WCAG 2.2 minimum (44×44px)
- Overscroll behavior disabled to prevent accidental pull-to-refresh
- `viewport-fit=cover` for edge-to-edge rendering
- Mobile hamburger menu for header navigation

---

## 🏗️ System Architecture

```text
[ Client (React + Vite + Tailwind v4) ]
                   │
                   │ HTTP Requests
                   ▼
[ Backend Gateway (Node.js + Express) ]
   ├──► 1. Extractor: CDN URLs, metadata & formats
   ├──► 2. Stream Proxy: Bypasses CORS & 403 blocks
   ├──► 3. Image Enhancer: Lanczos3 + Unsharp (CPU)
   └──► 4. AI Worker: Real-ESRGAN via Replicate (Optional)
```

---

## 📁 Repository Structure

```
SnapAI/
├── SnapAI.exe             # Windows GUI launcher (auto-starts servers & opens browser)
├── run.bat                # One-click batch launcher
├── stop.bat               # One-click server stop
├── launcher.cs            # C# source for SnapAI.exe
├── backend/
│   ├── server.js          # API: Extract + Stream Proxy + Super-Resolution
│   ├── .env.example       # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main UI (responsive, component-based)
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Tailwind v4 + responsive utilities + animations
│   ├── index.html         # viewport-fit, theme-color, apple-mobile-web-app
│   ├── vite.config.js
│   └── package.json
├── .gitignore
├── LICENSE
└── README.md
```

---

## ⚡ Quick Start (Windows)

Double-click either:
- **`SnapAI.exe`** — Native control panel. Auto-starts backend & frontend, shows live status, opens browser.
- **`run.bat`** — Console launcher. Starts both servers + opens http://localhost:5173.
- **`stop.bat`** — Terminates all running servers on ports 5000 & 5173.

---

## 🚀 Manual Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+

### 1. Clone

```bash
git clone https://github.com/Tunaanhgamedev/SnapAI.git
cd SnapAI
```

### 2. Backend (port 5000)

```bash
cd backend
npm install
node server.js
```

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/extract` | Extract video/slideshow metadata, formats, covers, and audio |
| `GET` | `/api/download` | Stream proxy with `Content-Disposition` attachment headers |
| `GET` | `/api/upscale-image` | CPU 2x/4x super-resolution (Lanczos3 + unsharp) |
| `POST` | `/api/upscale-ai` | Cloud GPU AI super-resolution (Real-ESRGAN, requires token) |
| `GET` | `/api/health` | Service status, uptime, and feature flags |

---

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | React 18 + Vite 6 + Tailwind CSS v4 |
| Icons | Lucide React |
| Backend | Node.js + Express |
| Image Processing | Sharp (Lanczos3 + Unsharp Masking + MozJPEG) |
| HTTP / Proxy | Axios (stream piping) |
| AI Upscale | Replicate API (Real-ESRGAN + GFPGAN) — optional |
| Desktop Launcher | C# (.NET Framework) native Windows executable |

---

## 🗺️ Roadmap

- [x] Phase 1: TikTok / Douyin Link Extractor + Stream Proxy + Web UI
- [x] Phase 2: CPU-based 2x/4x Super-Resolution Image Enhancement
- [x] Phase 3: Fully responsive design (mobile / tablet / desktop / narrow window)
- [ ] Phase 4: Cloud GPU AI Super-Resolution (Real-ESRGAN / GFPGAN)
- [ ] Phase 5: Video Enhancement queue (BullMQ + Redis + FFmpeg)
- [ ] Phase 6: Multi-platform support (YouTube, Facebook, Instagram via `yt-dlp`)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
