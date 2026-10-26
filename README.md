# ⚡ SnapAI (SnapBunny.ai)

> High-performance, watermark-free media downloader and AI enhancer platform for Chinese & Global social networks — **Douyin (抖音)**, **Xiaohongshu (小红书 - RED)**, **Bilibili (哔哩哔哩 / B站)**, **Kuaishou (快手)**, **Weibo (微博)**, and **TikTok**. Features 2x/4x Super-Resolution image upscaling and full responsiveness on mobile, tablet, and desktop.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Responsive](https://img.shields.io/badge/Responsive-Mobile%20First-FF6B6B)](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- 🇨🇳 **Dedicated Chinese Social Media Extractors**:
  - **Douyin (抖音)** — Watermark-free HD video (`play_addr`), image notes/slideshows (图集), and original MP3 audio.
  - **Xiaohongshu (小红书 - RED)** — Pristine uncompressed HD photos (2K/4K) stripped of watermark crop filters, plus unwatermarked video notes.
  - **Bilibili (哔哩哔哩 / B站)** — High-resolution video streams (`BV...` & `b23.tv`), cover art, duration, and owner metadata.
  - **Kuaishou (快手 / Kwai)** — Clean video downloads and photo atlas (`atlas`) albums.
  - **Weibo (微博)** — Full 1080p video clips and large photo collections (`pics`).
  - **TikTok** — International TikTok short links (`vt.tiktok.com`, `vm.tiktok.com`) with watermark/no-watermark selections.
- 🧹 **Automatic Share Text Sanitizer** — Automatically isolates valid URLs from noisy app share texts (e.g., `0.12 复制打开抖音... https://v.douyin.com/...`).
- 🚫 **No-Watermark Video Streams** — Direct access to pristine original resolution without watermarks or user tags.
- 📐 **Quality Resolution Selection** — Standard Definition (SD) vs. Full High Definition (HD).
- 🖼️ **Super-Resolution Image Enhancer** — Fast local 2x / 4x upscaling via **Sharp** (Lanczos3 + Unsharp Masking) running on CPU.
- 🎵 **Audio Extraction** — Download background music tracks directly as MP3 files.
- 🔒 **Adaptive Stream Proxy** — Pipes media from upstream CDNs to the browser with dynamic Referer headers, bypassing CORS and 403 Forbidden checks.
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

---

## 🏗️ System Architecture

```text
[ Client (React + Vite + Tailwind v4) ]
                   │
                   │ HTTP Requests
                   ▼
[ Backend Gateway (Node.js + Express) ]
   ├──► Extractor Router (Auto-detects platform)
   │       ├── Douyin Extractor (TikWM + Direct iteminfo fallback)
   │       ├── Xiaohongshu Extractor (Unwatermarked HD photos & video)
   │       ├── Bilibili Extractor (Mobile SSR playUrl & metadata)
   │       ├── Kuaishou Extractor (Watermark-free video & atlas)
   │       ├── Weibo Extractor (HD stream & large pics)
   │       └── TikTok Extractor
   ├──► Stream Proxy: Dynamic CDN Referer (bypasses 403 blocks)
   ├──► Image Enhancer: Lanczos3 + Unsharp Masking (CPU)
   └──► AI Worker: Real-ESRGAN via Replicate (Optional Cloud GPU)
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
│   ├── extractors/        # Modular multi-platform extractors
│   │   ├── bilibili.js    # Bilibili (B站) video & metadata
│   │   ├── douyin.js      # Douyin (抖音) video, slideshow & music
│   │   ├── kuaishou.js    # Kuaishou (快手) video & atlas
│   │   ├── weibo.js       # Weibo (微博) video & photos
│   │   ├── xiaohongshu.js # Xiaohongshu (小红书) unwatermarked photos & video
│   │   └── index.js       # Auto-detector & dispatcher
│   ├── server.js          # API: Extract + Adaptive Stream Proxy + Super-Resolution
│   ├── .env.example       # Environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Responsive UI with multi-platform tags & controls
│   │   ├── main.jsx       # React entry point
│   │   └── index.css      # Tailwind v4 + responsive utilities + animations
│   ├── index.html         # viewport-fit, theme-color, mobile meta
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
| `POST` | `/api/extract` | Extract media from Douyin, Xiaohongshu, Bilibili, Kuaishou, Weibo, or TikTok |
| `GET` | `/api/download` | Adaptive stream proxy with tailored CDN Referer headers |
| `GET` | `/api/upscale-image` | CPU 2x/4x super-resolution (Lanczos3 + unsharp filtering) |
| `POST` | `/api/upscale-ai` | Cloud GPU AI super-resolution (Real-ESRGAN, requires token) |
| `GET` | `/api/health` | Service status, uptime, and supported platforms list |

---

## 🛠️ Supported Platforms

| Platform | Short Links | Videos | Slideshows / Photos | Audio MP3 | Watermark Stripped |
|:---------|:------------|:------:|:-------------------:|:---------:|:------------------:|
| **抖音 Douyin** | `v.douyin.com` | ✅ | ✅ | ✅ | ✅ |
| **小红书 Xiaohongshu** | `xhslink.com` | ✅ | ✅ (HD 2K/4K) | ❌ | ✅ |
| **哔哩哔哩 Bilibili** | `b23.tv` | ✅ | ❌ | ✅ | ✅ |
| **快手 Kuaishou** | `v.kuaishou.com` | ✅ | ✅ | ✅ | ✅ |
| **微博 Weibo** | `weibo.cn` | ✅ | ✅ | ❌ | ✅ |
| **TikTok** | `vt.tiktok.com` | ✅ | ✅ | ✅ | ✅ |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
