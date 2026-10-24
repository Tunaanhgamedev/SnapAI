// ============================================================================
// SnapBunny.ai — Backend Server (Optimized)
// Link extraction • Stream proxy • Image super-resolution (AI-ready)
// ============================================================================
require('dotenv').config();

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const sharp   = require('sharp');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Constants ────────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const TIKWM = 'https://www.tikwm.com';
const MAX_UPSCALE_DIM = 8192;

// ── Helpers ──────────────────────────────────────────────────────────────────
const norm = (p) => (!p ? null : p.startsWith('http') ? p : `${TIKWM}${p}`);
const fmtSize = (b) => {
  if (!b) return null;
  const mb = b / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
};
const safeName = (s, max = 120) => s.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, max);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ============================================================================
// 1. EXTRACT — TikTok / Douyin link parsing
//    POST /api/extract  { url: string }
// ============================================================================
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, error: 'Please provide a valid TikTok or Douyin URL.' });
  }

  try {
    const { data: resp } = await axios.post(
      `${TIKWM}/api/`,
      new URLSearchParams({ url: url.trim(), count: 12, cursor: 0, web: 1, hd: 1 }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': UA },
        timeout: 15000
      }
    );

    if (resp.code !== 0 || !resp.data) {
      return res.status(404).json({ success: false, error: 'Content not found or is set to private.' });
    }

    const d = resp.data;
    const isSlide = Array.isArray(d.images) && d.images.length > 0;

    return res.json({
      success: true,
      id: d.id,
      title: d.title || 'Untitled',
      cover: norm(d.cover) || norm(d.origin_cover),
      duration: d.duration || 0,
      createTime: d.create_time,
      author: {
        nickname: d.author?.nickname || 'Unknown',
        uniqueId: d.author?.unique_id || '',
        avatar: norm(d.author?.avatar)
      },
      stats: {
        plays: d.play_count,
        likes: d.digg_count,
        comments: d.comment_count,
        shares: d.share_count
      },
      type: isSlide ? 'slideshow' : 'video',
      downloads: {
        noWatermarkSD: norm(d.play),
        noWatermarkHD: norm(d.hdplay || d.play),
        watermark: norm(d.wmplay),
        music: norm(d.music),
        musicTitle: d.music_info?.title || null
      },
      sizeInfo: {
        sdSize: fmtSize(d.size) || 'SD',
        hdSize: fmtSize(d.hd_size) || 'HD',
        wmSize: fmtSize(d.wm_size) || 'Original'
      },
      images: isSlide ? d.images.map(norm) : []
    });
  } catch (err) {
    console.error('[Extract]', err.message);
    return res.status(err.response?.status || 500).json({
      success: false,
      error: 'Failed to connect to analysis engine. Please try again later.'
    });
  }
});

// ============================================================================
// 2. STREAM PROXY — direct CDN-to-browser pipe (bypasses CORS / 403)
//    GET /api/download?fileUrl=...&filename=...&ext=mp4
// ============================================================================
app.get('/api/download', async (req, res) => {
  const { fileUrl, filename = 'snap_media', ext = 'mp4' } = req.query;
  if (!fileUrl) return res.status(400).json({ error: 'Missing fileUrl parameter.' });

  try {
    const referer = fileUrl.includes('douyin') ? 'https://www.douyin.com/' : 'https://www.tiktok.com/';

    const upstream = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: { 'User-Agent': UA, 'Referer': referer, 'Accept': '*/*' }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.${ext}"`);
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }

    upstream.data.pipe(res);
    req.on('close', () => upstream.data.destroy());
  } catch (err) {
    console.error('[Download]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Unable to fetch file from upstream CDN.' });
    }
  }
});

// ============================================================================
// 3. IMAGE UPSCALE — Lanczos3 + median denoise + unsharp masking (CPU)
//    GET /api/upscale-image?imageUrl=...&scale=2&filename=upscaled
// ============================================================================
app.get('/api/upscale-image', async (req, res) => {
  const { imageUrl, scale = '2', filename = 'snap_upscaled' } = req.query;
  if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl parameter.' });

  try {
    const { data } = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: { 'User-Agent': UA }
    });

    const buf  = Buffer.from(data);
    const meta = await sharp(buf).metadata();
    const w    = meta.width || 1080;
    const h    = meta.height || 1920;
    const mult = parseInt(scale, 10) === 4 ? 4 : 2;
    const tw   = Math.min(w * mult, MAX_UPSCALE_DIM);

    const out = await sharp(buf)
      .resize({ width: tw, kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
      .median(mult === 4 ? 3 : 1)
      .sharpen({ sigma: mult === 4 ? 1.5 : 1.2, m1: 1.0, m2: 2.0 })
      .jpeg({ quality: 98, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toBuffer();

    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}_${mult}x_HD.jpg"`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', out.length);
    res.setHeader('X-Original-Size', `${w}x${h}`);
    res.setHeader('X-Upscaled-Size', `${tw}x${Math.round(h * (tw / w))}`);
    return res.send(out);
  } catch (err) {
    console.error('[Upscale]', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Image upscale failed. File may be too large or invalid.' });
    }
  }
});

// ============================================================================
// 4. AI UPSCALE (Real-ESRGAN) — requires REPLICATE_API_TOKEN
//    POST /api/upscale-ai  { imageUrl, scale, faceEnhance }
// ============================================================================
app.post('/api/upscale-ai', async (req, res) => {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return res.status(501).json({ error: 'AI Upscale not activated. Add REPLICATE_API_TOKEN to .env' });
  }

  const { imageUrl, scale = 2, faceEnhance = true } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Missing imageUrl parameter.' });

  try {
    const { data: pred } = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
        input: { image: imageUrl, scale: Math.min(scale, 4), face_enhance: faceEnhance }
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    let result = pred;
    for (let i = 0; i < 60 && result.status !== 'succeeded' && result.status !== 'failed'; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const { data } = await axios.get(
        `https://api.replicate.com/v1/predictions/${pred.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      result = data;
    }

    if (result.status === 'succeeded') {
      return res.json({ success: true, upscaledUrl: result.output, metrics: result.metrics });
    }
    return res.status(500).json({ error: 'AI Upscale timed out or failed.', status: result.status });
  } catch (err) {
    console.error('[AI Upscale]', err.message);
    return res.status(500).json({ error: 'AI Upscale service error.' });
  }
});

// ============================================================================
// 5. HEALTH CHECK
// ============================================================================
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'SnapBunny.ai',
    version: '1.1.0',
    features: {
      extract: true,
      streamProxy: true,
      upscaleLanczos: true,
      upscaleAI: !!process.env.REPLICATE_API_TOKEN
    },
    uptime: Math.floor(process.uptime())
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║  🚀 SnapBunny.ai Backend — port ${PORT}                ║`);
  console.log('  ║                                                      ║');
  console.log(`  ║  Health:    http://localhost:${PORT}/api/health          ║`);
  console.log('  ║  Extract:   POST /api/extract                        ║');
  console.log('  ║  Download:  GET  /api/download                       ║');
  console.log('  ║  Upscale:   GET  /api/upscale-image                  ║');
  console.log('  ║  AI (GPU):  POST /api/upscale-ai                     ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
