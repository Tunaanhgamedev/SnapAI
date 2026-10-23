# ⚡ SnapAI (SnapBunny.ai)

> High-performance, watermark-free media downloader and AI enhancer web platform supporting TikTok, Douyin, and social media platforms with 2x/4x Super-Resolution image upscaling.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- 🎬 **Multi-Platform Link Extractor**: Parses TikTok, Douyin, and short URLs (`vt.tiktok.com`, `v.douyin.com`) for videos and slideshows.
- 🚫 **No-Watermark Video Streams**: Direct access to pristine original resolution without watermarks or user tags.
- 📐 **Quality Resolution Selection**: Choose between Standard Definition (SD) and Full High Definition (HD).
- 🖼️ **Super-Resolution Image Enhancer**: Fast local 2x / 4x image upscaling via **Sharp** (Lanczos3 kernel + Unsharp Masking) running on CPU.
- 🎵 **Audio Extraction**: Download background music tracks directly as MP3 files.
- 🔒 **Stream Proxy**: Pipes media chunks directly from upstream CDNs to the browser, bypassing CORS restrictions and 403 Forbidden referrer checks.
- 🤖 **AI Upscaling Ready**: Pre-wired integration hook for cloud GPU inference (Real-ESRGAN / GFPGAN via Replicate API).

---

## 🏗️ System Architecture

```text
[ Client (Web UI - React + Vite + Tailwind v4) ]
                   │
                   │ (HTTP Requests: Extract / Download Proxy / Upscale)
                   ▼
[ Backend Gateway (Node.js + Express) ]
   ├──► 1. Extractor Service: Fetches clean CDN URLs, metadata & formats
   ├──► 2. Stream Proxy: Direct pipe bypasses CDN CORS & 403 blocks
   ├──► 3. Image Enhancer: Lanczos3 + Unsharp Masking (Fast Local CPU)
   └──► 4. Cloud AI Worker (Optional): Real-ESRGAN / GFPGAN via Replicate
```

---

## 📁 Repository Structure

```
SnapAI/
├── SnapAI.exe             # Native Windows GUI launcher (Auto-starts servers & opens browser)
├── run.bat                # One-click batch launcher script
├── stop.bat               # One-click server stop script
├── launcher.cs            # C# source code for SnapAI.exe
├── backend/
│   ├── server.js          # API Gateway: Extract + Stream Proxy + Super-Resolution
│   ├── .env.example       # Environment template
│   └── package.json       # Backend dependencies (Express, Sharp, Axios, Cors)
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main UI application with responsive download controls
│   │   ├── main.jsx       # React application entry point
│   │   └── index.css      # Tailwind CSS v4 & custom keyframe animations
│   ├── index.html         # Web entry point & metadata
│   ├── vite.config.js     # Vite configuration with Tailwind plugin
│   └── package.json       # Frontend dependencies (React, Lucide icons, Axios)
├── .gitignore
├── LICENSE
└── README.md
```

---

## ⚡ Quick Start (Windows)

Double-click either:
- **`SnapAI.exe`**: Native control panel app. Automatically starts both backend & frontend, tracks service status, and pops up your browser!
- **`run.bat`**: Console one-click launcher that boots up both servers and opens [http://localhost:5173](http://localhost:5173).
- **`stop.bat`**: Safely terminates all running background servers on ports 5000 & 5173.

---

## 🚀 Manual Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or newer)
- npm or yarn

### 1. Clone the repository

```bash
git clone https://github.com/Tunaanhgamedev/SnapAI.git
cd SnapAI
```

### 2. Run Backend Service

```bash
cd backend
npm install
node server.js
```

Backend will start at: `http://localhost:5000`

### 3. Run Frontend Development Server

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will start at: `http://localhost:5173`

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/extract` | Extracts video/slideshow media metadata, formats, covers, and audio tracks. |
| `GET` | `/api/download` | Stream proxy downloading files with proper `Content-Disposition` attachment headers. |
| `GET` | `/api/upscale-image` | Local CPU 2x/4x image super-resolution via Lanczos3 + unsharp filtering. |
| `POST` | `/api/upscale-ai` | Cloud GPU AI super-resolution using Real-ESRGAN (Requires Replicate API token). |
| `GET` | `/api/health` | Service health status, uptime, and active feature flags. |

---

## 🗺️ Roadmap

- [x] Phase 1: TikTok / Douyin Link Extractor + Stream Proxy + Modern Web UI
- [x] Phase 2: Instant CPU-based 2x/4x Super-Resolution Image Enhancement
- [ ] Phase 3: Cloud GPU AI Super-Resolution (Real-ESRGAN / GFPGAN)
- [ ] Phase 4: Video Super-Resolution via BullMQ + Redis + FFmpeg queue
- [ ] Phase 5: Multi-platform integration (YouTube, Facebook, Instagram via `yt-dlp`)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
