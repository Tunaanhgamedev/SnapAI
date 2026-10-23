// ============================================================================
// SnapBunny.ai — Backend Server
// Bóc tách link đa nền tảng • Stream Proxy • Nâng cấp chất lượng ảnh (AI-Ready)
// ============================================================================
require('dotenv').config();

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const sharp   = require('sharp');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// User-Agent dùng chung cho mọi request tới CDN bên thứ ba
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Helper: chuẩn hoá đường dẫn tương đối về đường dẫn tuyệt đối
const TIKWM_HOST = 'https://www.tikwm.com';
const normalizeUrl = (path) => {
  if (!path) return null;
  return path.startsWith('http') ? path : `${TIKWM_HOST}${path}`;
};

// Helper: format kích thước file
const formatSize = (bytes) => {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

// ============================================================================
// 1. API BÓC TÁCH LINK — TikTok / Douyin (Video & Slideshow)
//    POST /api/extract   { url: string }
// ============================================================================
app.post('/api/extract', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Vui lòng nhập đường dẫn TikTok hoặc Douyin hợp lệ!'
    });
  }

  try {
    // Gọi engine phân tích — hỗ trợ cả link rút gọn (vt.tiktok.com, v.douyin.com)
    const response = await axios.post(
      `${TIKWM_HOST}/api/`,
      new URLSearchParams({
        url: url.trim(),
        count: 12,
        cursor: 0,
        web: 1,
        hd: 1
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': UA
        },
        timeout: 15000
      }
    );

    const resData = response.data;

    if (resData.code !== 0 || !resData.data) {
      return res.status(404).json({
        success: false,
        error: 'Không thể lấy dữ liệu. Link không hợp lệ hoặc bài đăng ở chế độ riêng tư.'
      });
    }

    const d = resData.data;
    const isSlideshow = Array.isArray(d.images) && d.images.length > 0;

    const result = {
      success: true,
      id: d.id,
      title: d.title || 'Không có tiêu đề',
      cover: normalizeUrl(d.cover) || normalizeUrl(d.origin_cover),
      duration: d.duration || 0,
      createTime: d.create_time,
      author: {
        nickname: d.author?.nickname || 'Unknown',
        uniqueId: d.author?.unique_id || '',
        avatar: normalizeUrl(d.author?.avatar)
      },
      stats: {
        plays: d.play_count,
        likes: d.digg_count,
        comments: d.comment_count,
        shares: d.share_count
      },
      type: isSlideshow ? 'slideshow' : 'video',
      downloads: {
        noWatermarkSD: normalizeUrl(d.play),
        noWatermarkHD: normalizeUrl(d.hdplay || d.play),
        watermark: normalizeUrl(d.wmplay),
        music: normalizeUrl(d.music),
        musicTitle: d.music_info?.title || null
      },
      sizeInfo: {
        sdSize: formatSize(d.size) || 'SD',
        hdSize: formatSize(d.hd_size) || 'HD',
        wmSize: formatSize(d.wm_size) || 'Gốc'
      },
      images: isSlideshow ? d.images.map(normalizeUrl) : []
    };

    return res.json(result);
  } catch (error) {
    console.error('[Extract Error]', error.message);
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      error: 'Lỗi kết nối tới máy chủ phân tích. Vui lòng thử lại sau ít phút.'
    });
  }
});

// ============================================================================
// 2. STREAM PROXY — Tải file trực tiếp & vượt CORS / 403 Forbidden
//    GET /api/download?fileUrl=...&filename=...&ext=mp4
// ============================================================================
app.get('/api/download', async (req, res) => {
  const { fileUrl, filename = 'snapbunny_media', ext = 'mp4' } = req.query;

  if (!fileUrl) {
    return res.status(400).json({ error: 'Thiếu tham số fileUrl' });
  }

  try {
    // Xác định Referer phù hợp theo nguồn CDN
    let referer = 'https://www.tiktok.com/';
    if (fileUrl.includes('douyin')) referer = 'https://www.douyin.com/';

    const upstream = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': UA,
        'Referer': referer,
        'Accept': '*/*'
      }
    });

    // Tên file an toàn — loại bỏ ký tự đặc biệt
    const safeName = filename.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 120);

    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${ext}"`);
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'application/octet-stream');

    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }

    // Pipe stream trực tiếp: CDN → Server → Trình duyệt (không lưu file tạm)
    upstream.data.pipe(res);

    // Dọn dẹp nếu client ngắt kết nối giữa chừng
    req.on('close', () => {
      upstream.data.destroy();
    });
  } catch (error) {
    console.error('[Download Proxy Error]', error.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Không thể tải file từ nguồn. Vui lòng thử lại.' });
    }
  }
});

// ============================================================================
// 3. NÂNG CẤP CHẤT LƯỢNG ẢNH — Lanczos3 + Unsharp Masking (CPU, miễn phí)
//    GET /api/upscale-image?imageUrl=...&scale=2&filename=upscaled
// ============================================================================
app.get('/api/upscale-image', async (req, res) => {
  const {
    imageUrl,
    scale = '2',
    filename = 'snapbunny_upscaled'
  } = req.query;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Thiếu tham số imageUrl' });
  }

  try {
    // 1. Tải buffer ảnh gốc về RAM
    const imgResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: { 'User-Agent': UA }
    });

    const inputBuffer = Buffer.from(imgResponse.data);
    const metadata    = await sharp(inputBuffer).metadata();
    const srcWidth    = metadata.width || 1080;
    const srcHeight   = metadata.height || 1920;

    // 2. Xác định hệ số phóng đại
    const multiplier  = parseInt(scale, 10) === 4 ? 4 : 2;
    const targetWidth = srcWidth * multiplier;

    // Giới hạn an toàn: không vượt 8192px để tránh tràn RAM
    const maxDim      = 8192;
    const finalWidth  = Math.min(targetWidth, maxDim);

    // 3. Pipeline xử lý ảnh:
    //    Lanczos3 (nội suy cấp cao) → Denoise nhẹ → Unsharp Masking (tăng nét viền)
    const upscaledBuffer = await sharp(inputBuffer)
      .resize({
        width: finalWidth,
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false
      })
      // Khử nhiễu nhẹ trước khi làm nét (giảm artifact do nén JPEG)
      .median(multiplier === 4 ? 3 : 1)
      .sharpen({
        sigma: multiplier === 4 ? 1.5 : 1.2,   // Bán kính gaussian
        m1: 1.0,                                 // Flat areas sharpening
        m2: 2.0                                  // Jagged areas sharpening
      })
      .jpeg({
        quality: 98,
        chromaSubsampling: '4:4:4',              // Giữ nguyên thông tin màu
        mozjpeg: true                            // Tối ưu kích thước bằng MozJPEG encoder
      })
      .toBuffer();

    const safeName = filename.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100);

    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${multiplier}x_HD.jpg"`);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', upscaledBuffer.length);
    res.setHeader('X-Original-Size', `${srcWidth}x${srcHeight}`);
    res.setHeader('X-Upscaled-Size', `${finalWidth}x${Math.round(srcHeight * (finalWidth / srcWidth))}`);

    return res.send(upscaledBuffer);
  } catch (error) {
    console.error('[Upscale Error]', error.message);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Lỗi khi nâng cấp chất lượng hình ảnh. File có thể quá lớn hoặc không phải ảnh hợp lệ.'
      });
    }
  }
});

// ============================================================================
// 4. (PLACEHOLDER) AI UPSCALE VỚI REPLICATE — Real-ESRGAN + GFPGAN
//    POST /api/upscale-ai   { imageUrl, scale, faceEnhance }
//    → Kích hoạt khi có REPLICATE_API_TOKEN trong .env
// ============================================================================
app.post('/api/upscale-ai', async (req, res) => {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    return res.status(501).json({
      error: 'Tính năng AI Upscale chưa được kích hoạt. Vui lòng thêm REPLICATE_API_TOKEN vào file .env'
    });
  }

  const { imageUrl, scale = 2, faceEnhance = true } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Thiếu tham số imageUrl' });
  }

  try {
    // Gọi Replicate API — model Real-ESRGAN
    const prediction = await axios.post(
      'https://api.replicate.com/v1/predictions',
      {
        version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
        input: {
          image: imageUrl,
          scale: Math.min(scale, 4),
          face_enhance: faceEnhance
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    // Replicate trả về prediction ID — cần polling để lấy kết quả
    // Trong production nên dùng webhook thay vì polling
    const predictionId = prediction.data.id;
    let result = prediction.data;
    let attempts = 0;
    const maxAttempts = 60; // Tối đa 60 giây

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      result = poll.data;
      attempts++;
    }

    if (result.status === 'succeeded') {
      return res.json({
        success: true,
        upscaledUrl: result.output,
        metrics: result.metrics
      });
    } else {
      return res.status(500).json({
        error: 'AI Upscale thất bại hoặc hết thời gian chờ.',
        status: result.status
      });
    }
  } catch (error) {
    console.error('[AI Upscale Error]', error.message);
    return res.status(500).json({ error: 'Lỗi khi gọi dịch vụ AI Upscale.' });
  }
});

// ============================================================================
// 5. HEALTH CHECK
// ============================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SnapBunny.ai Backend',
    version: '1.0.0',
    features: {
      extract: true,
      streamProxy: true,
      upscaleLanczos: true,
      upscaleAI: !!process.env.REPLICATE_API_TOKEN
    },
    uptime: Math.floor(process.uptime())
  });
});

// ── Khởi động server ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log(`  ║  🚀 SnapBunny.ai Backend đang chạy tại cổng ${PORT}     ║`);
  console.log('  ║                                                      ║');
  console.log(`  ║  → http://localhost:${PORT}/api/health                  ║`);
  console.log('  ║  → Bóc tách:  POST /api/extract                     ║');
  console.log('  ║  → Tải file:  GET  /api/download                    ║');
  console.log('  ║  → Làm nét:   GET  /api/upscale-image               ║');
  console.log('  ║  → AI (GPU):  POST /api/upscale-ai                  ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
});
