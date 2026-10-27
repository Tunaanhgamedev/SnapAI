// ============================================================================
// SnapBunny.ai — High-Concurrency Production Backend Server
// Optimized for massive traffic, CDN connection pooling, LRU caching,
// DoS rate limiting, Gzip compression & bounded CPU image upscaling.
// ============================================================================
require('dotenv').config();

const os              = require('os');
const express         = require('express');
const cors            = require('cors');
const compression     = require('compression');
const rateLimit       = require('express-rate-limit');
const sharp           = require('sharp');

const { extractMedia } = require('./extractors');
const { extractCache, upscaleCache } = require('./cache');
const { upscaleLimiter } = require('./limiter');
const { pooledAxios }    = require('./httpPool');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Optimize Sharp Engine Settings ──────────────────────────────────────────
// Limit libuv background threads to prevent 100% CPU starvation under concurrent load
sharp.concurrency(Math.max(1, Math.min(4, os.cpus().length)));
sharp.cache({ memory: 64, items: 100, files: 0 });

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

// ── Production Middlewares ───────────────────────────────────────────────────

// Trust reverse proxy (Nginx, Cloudflare, AWS ALB) for accurate client IP
app.set('trust proxy', 1);

// HTTP Compression (Gzip / Deflate / Brotli) - reduces JSON bandwidth by 70-80%
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    // Don't compress already compressed media streams
    if (req.path === '/api/download' || req.path === '/api/upscale-image') return false;
    return compression.filter(req, res);
  }
}));

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ── Rate Limiting (Abuse & DoS Prevention) ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều yêu cầu từ địa chỉ IP của bạn. Vui lòng chờ 1 phút!' }
});

const extractLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,             // 60 extracts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Tần suất bóc tách quá nhanh. Vui lòng thử lại sau giây lát!' }
});

const upscaleLimiterMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 25,             // 25 upscale operations per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Giới hạn nâng cấp ảnh: tối đa 25 lần/phút.' }
});

app.use(globalLimiter);

// ============================================================================
// 1. EXTRACT — Multi-Platform Link Parsing with Single-Flight & LRU Cache
//    POST /api/extract  { url: string }
// ============================================================================
app.post('/api/extract', extractLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng nhập đường dẫn hợp lệ (hỗ trợ Douyin, TikTok, Bilibili, Xiaohongshu, Kuaishou, Weibo).'
    });
  }

  const rawInput = url.trim();

  try {
    // Single-Flight Request Deduplication + 10-minute LRU Cache:
    // If 100 concurrent users request the same trending video, only 1 upstream request is made.
    const result = await extractCache.dedupe(rawInput, async () => {
      return await extractMedia(rawInput);
    });

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

    // Fetch upstream stream using pooled connection
    const upstream = await pooledAxios({
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

    // Pipe stream directly
    upstream.data.pipe(res);

    // Prevent socket leaks when user aborts or disconnects early
    req.on('close', () => {
      if (upstream.data && !upstream.data.destroyed) {
        upstream.data.destroy();
      }
    });

    upstream.data.on('error', (streamErr) => {
      console.warn('[Stream Pipe Error]', streamErr.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Lỗi truyền tải luồng dữ liệu.' });
      }
    });
  } catch (err) {
    console.error('[Download Error]', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Không thể tải file từ CDN nguồn. Vui lòng thử lại.' });
    }
  }
});

// ============================================================================
// 3. IMAGE UPSCALE — Bounded Concurrency Queue + In-Memory LRU Cache
//    GET /api/upscale-image?imageUrl=...&scale=2&filename=upscaled
// ============================================================================
app.get('/api/upscale-image', upscaleLimiterMiddleware, async (req, res) => {
  const { imageUrl, scale = '2', filename = 'snap_upscaled' } = req.query;
  if (!imageUrl) return res.status(400).json({ error: 'Thiếu tham số imageUrl.' });

  const mult = parseInt(scale, 10) === 4 ? 4 : 2;
  const cacheKey = `${imageUrl}_${mult}`;

  // 1. Check in-memory buffer cache (Serves instant 0-1ms without CPU work!)
  const cached = upscaleCache.get(cacheKey);
  if (cached) {
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}_${mult}x_HD.jpg"`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', cached.buffer.length);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Original-Size', cached.srcSize);
    res.setHeader('X-Upscaled-Size', cached.targetSize);
    return res.send(cached.buffer);
  }

  try {
    // 2. Run inside concurrency limiter to prevent CPU starvation
    const result = await upscaleLimiter.run(async () => {
      const referer = getUpstreamReferer(imageUrl);

      const { data } = await pooledAxios.get(imageUrl, {
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
      const tw   = Math.min(w * mult, MAX_UPSCALE_DIM);
      const th   = Math.round(h * (tw / w));

      const out = await sharp(buf)
        .resize({ width: tw, kernel: sharp.kernel.lanczos3, withoutEnlargement: false })
        .median(mult === 4 ? 3 : 1)
        .sharpen({ sigma: mult === 4 ? 1.5 : 1.2, m1: 1.0, m2: 2.0 })
        .jpeg({ quality: 98, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();

      const item = {
        buffer: out,
        srcSize: `${w}x${h}`,
        targetSize: `${tw}x${th}`
      };

      upscaleCache.set(cacheKey, item);
      return item;
    });

    res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}_${mult}x_HD.jpg"`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Original-Size', result.srcSize);
    res.setHeader('X-Upscaled-Size', result.targetSize);
    return res.send(result.buffer);
  } catch (err) {
    console.error('[Upscale Error]', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Nâng cấp ảnh thất bại.' });
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
    const { data: pred } = await pooledAxios.post(
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
      const { data } = await pooledAxios.get(
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
// 5. EXTENDED HEALTH CHECK & METRICS
// ============================================================================
app.get('/api/health', (_, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    service: 'SnapBunny.ai',
    version: '1.3.0',
    workerId: process.pid,
    uptime: Math.floor(process.uptime()),
    system: {
      loadAverage: os.loadavg(),
      totalMemMB: Math.round(os.totalmem() / 1048576),
      freeMemMB: Math.round(os.freemem() / 1048576),
      processRssMB: Math.round(mem.rss / 1048576),
      heapUsedMB: Math.round(mem.heapUsed / 1048576)
    },
    caches: {
      extract: extractCache.getStats(),
      upscale: upscaleCache.getStats()
    },
    concurrency: upscaleLimiter.getStats(),
    platforms: [
      'TikTok',
      'Douyin (抖音)',
      'Xiaohongshu (小红书 - RED)',
      'Bilibili (哔哩哔哩 / B站)',
      'Kuaishou (快手)',
      'Weibo (微博)'
    ]
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║  🚀 SnapBunny.ai Production Server (PID: ${process.pid})      ║`);
  console.log(`  ║  Cổng: ${PORT} • Compression & Rate Limiter Active      ║`);
  console.log('  ║  Connection Pooling & In-Memory Cache: ON            ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
