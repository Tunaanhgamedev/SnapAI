// ============================================================================
// SnapBunny.ai — Backend Server (Multi-Platform China & Global)
// Link extraction • Stream proxy • Image super-resolution (AI-ready)
// Supported: Douyin, TikTok, Xiaohongshu (RED), Bilibili, Kuaishou, Weibo
// ============================================================================
require('dotenv').config();

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const sharp   = require('sharp');
const { extractMedia } = require('./extractors');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Constants ────────────────────────────────────────────────────────────────
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MAX_UPSCALE_DIM = 8192;

const safeName = (s, max = 120) => s.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, max);

/**
 * Determine the optimal HTTP Referer header based on the target CDN URL
 */
function getUpstreamReferer(fileUrl) {
  const lower = fileUrl.toLowerCase();
  if (lower.includes('bilibili') || lower.includes('hdslb') || lower.includes('bilivideo') || lower.includes('akamaized.net')) {
    return 'https://www.bilibili.com/';
  }
  if (lower.includes('xiaohongshu') || lower.includes('xhscdn') || lower.includes('xhslink')) {
    return 'https://www.xiaohongshu.com/';
  }
  if (lower.includes('kuaishou') || lower.includes('yximgs') || lower.includes('kwaicdn') || lower.includes('chenzhongtech')) {
    return 'https://www.kuaishou.com/';
  }
  if (lower.includes('weibo') || lower.includes('sinaimg') || lower.includes('weibocdn')) {
    return 'https://weibo.com/';
  }
  if (lower.includes('douyin') || lower.includes('snssdk') || lower.includes('amemv') || lower.includes('byteimg')) {
    return 'https://www.douyin.com/';
  }
  return 'https://www.tiktok.com/';
}

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
// 1. EXTRACT — Multi-Platform Link Parsing
//    POST /api/extract  { url: string }
// ============================================================================
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng nhập đường dẫn hợp lệ (hỗ trợ Douyin, TikTok, Bilibili, Xiaohongshu, Kuaishou, Weibo).'
    });
  }

  try {
    const result = await extractMedia(url.trim());
    return res.json(result);
  } catch (err) {
    console.error('[Extract Error]', err.message);
    return res.status(err.response?.status || 500).json({
      success: false,
      error: err.message || 'Không thể phân tích liên kết. Vui lòng thử lại sau.'
    });
  }
});

// ============================================================================
// 2. STREAM PROXY — direct CDN-to-browser pipe (bypasses CORS / 403)
//    GET /api/download?fileUrl=...&filename=...&ext=mp4
// ============================================================================
app.get('/api/download', async (req, res) => {
  const { fileUrl, filename = 'snap_media', ext = 'mp4' } = req.query;
  if (!fileUrl) return res.status(400).json({ error: 'Thiếu tham số fileUrl.' });

  try {
    const referer = getUpstreamReferer(fileUrl);

    const upstream = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': UA,
        'Referer': referer,
        'Accept': '*/*'
      }
    });

    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.${ext}"`);
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }

    upstream.data.pipe(res);
    req.on('close', () => upstream.data.destroy());
  } catch (err) {
    console.error('[Download Error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Không thể tải file từ CDN nguồn. Vui lòng thử lại.' });
    }
  }
});

// ============================================================================
// 3. IMAGE UPSCALE — Lanczos3 + median denoise + unsharp masking (CPU)
//    GET /api/upscale-image?imageUrl=...&scale=2&filename=upscaled
// ============================================================================
app.get('/api/upscale-image', async (req, res) => {
  const { imageUrl, scale = '2', filename = 'snap_upscaled' } = req.query;
  if (!imageUrl) return res.status(400).json({ error: 'Thiếu tham số imageUrl.' });

  try {
    const referer = getUpstreamReferer(imageUrl);
    const { data } = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': UA,
        'Referer': referer
      }
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
    console.error('[Upscale Error]', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Nâng cấp ảnh thất bại. Định dạng file có thể không hợp lệ.' });
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
    return res.status(501).json({ error: 'AI Upscale chưa được kích hoạt. Hãy thêm REPLICATE_API_TOKEN vào .env' });
  }

  const { imageUrl, scale = 2, faceEnhance = true } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Thiếu tham số imageUrl.' });

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
    return res.status(500).json({ error: 'Quá trình AI Upscale thất bại hoặc hết thời gian chờ.', status: result.status });
  } catch (err) {
    console.error('[AI Upscale Error]', err.message);
    return res.status(500).json({ error: 'Lỗi khi gọi dịch vụ AI Upscale.' });
  }
});

// ============================================================================
// 5. HEALTH CHECK
// ============================================================================
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'SnapBunny.ai',
    version: '1.2.0',
    platforms: [
      'TikTok',
      'Douyin (抖音)',
      'Xiaohongshu (小红书 - RED)',
      'Bilibili (哔哩哔哩 / B站)',
      'Kuaishou (快手)',
      'Weibo (微博)'
    ],
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
  console.log('  ║  Đa nền tảng: Douyin, Xiaohongshu, Bilibili,        ║');
  console.log('  ║               Kuaishou, Weibo & TikTok               ║');
  console.log('  ║                                                      ║');
  console.log(`  ║  Health:    http://localhost:${PORT}/api/health          ║`);
  console.log('  ║  Extract:   POST /api/extract                        ║');
  console.log('  ║  Download:  GET  /api/download                       ║');
  console.log('  ║  Upscale:   GET  /api/upscale-image                  ║');
  console.log('  ║  AI (GPU):  POST /api/upscale-ai                     ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
