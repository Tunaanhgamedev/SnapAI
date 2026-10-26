// ============================================================================
// Xiaohongshu Extractor (小红书 - RED)
// Extracts original unwatermarked photos (2K/4K) and video notes
// ============================================================================
const axios = require('axios');

const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function cleanXhsImageUrl(url) {
  if (!url) return null;
  // Convert http to https
  let cleaned = url.replace(/^http:\/\//, 'https://');
  // Strip image crop / preview suffixes for pristine original HD quality
  cleaned = cleaned.replace(/!nd_dft_wl_prv_webp_\d+/g, '');
  cleaned = cleaned.replace(/!nd_dft_wl_\d+/g, '');
  cleaned = cleaned.replace(/!nd_dft_\d+/g, '');
  cleaned = cleaned.replace(/\?imageMogr2\/.+$/, '');
  return cleaned;
}

async function extractXiaohongshu(rawUrl) {
  let targetUrl = rawUrl.trim();

  // 1. Follow short link redirect (xhslink.com)
  if (targetUrl.includes('xhslink.com')) {
    try {
      const resp = await axios.get(targetUrl, {
        headers: {
          'User-Agent': UA_PC,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 5,
        timeout: 10000
      });
      targetUrl = resp.request?.res?.responseUrl || resp.config?.url || targetUrl;
    } catch (err) {
      if (err.response?.headers?.location) {
        targetUrl = err.response.headers.location;
      }
    }
  }

  // 2. Extract note ID
  const idMatch = targetUrl.match(/(?:explore|discovery\/item)\/([a-zA-Z0-9_-]+)/);
  const noteId = idMatch ? idMatch[1] : null;

  // 3. Fetch note detail page
  const pageResp = await axios.get(targetUrl, {
    headers: {
      'User-Agent': UA_PC,
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    timeout: 15000
  });

  const html = pageResp.data;

  // 4. Parse __INITIAL_STATE__ or __INITIAL_SSR_STATE__
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\})<\/script>/s) ||
                     html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\})<\/script>/s);

  if (!stateMatch) {
    throw new Error('Không thể phân tích dữ liệu ghi chú Tiểu Hồng Thư (Xiaohongshu).');
  }

  // Handle undefined in JSON if any
  const cleanJson = stateMatch[1].replace(/:\s*undefined\b/g, ': null');
  const state = JSON.parse(cleanJson);

  const noteMap = state.note?.noteDetailMap || {};
  const note = (noteId && noteMap[noteId]?.note) ||
               Object.values(noteMap)[0]?.note ||
               state.note?.note ||
               {};

  if (!note.title && !note.desc && !note.imageList && !note.video) {
    throw new Error('Bài viết Tiểu Hồng Thư không tồn tại hoặc đã bị khóa/xóa.');
  }

  const user = note.user || {};
  const isVideo = note.type === 'video' || !!note.video;

  // Extract images
  let images = [];
  if (Array.isArray(note.imageList)) {
    images = note.imageList
      .map(item => cleanXhsImageUrl(item.urlOriginal || item.urlDefault || (item.infoList && item.infoList[0]?.url)))
      .filter(Boolean);
  }

  // Extract video stream URL
  let videoUrl = null;
  if (isVideo) {
    const stream = note.video?.media?.stream;
    if (stream) {
      const h264 = stream.h264 || [];
      const h265 = stream.h265 || [];
      videoUrl = (h264[0] && h264[0].masterUrl) ||
                 (h265[0] && h265[0].masterUrl) ||
                 note.video?.consumer?.originVideoKey;
    }
  }

  const title = (note.title || (note.desc ? note.desc.split('\n')[0] : 'Bài viết Tiểu Hồng Thư')).trim();
  const cover = images[0] || (note.video && note.video.image && note.video.image.thumbnail) || null;

  return {
    success: true,
    platform: 'xiaohongshu',
    id: note.noteId || noteId || String(Date.now()),
    title: title,
    cover: cleanXhsImageUrl(cover),
    duration: (note.video && note.video.duration) || 0,
    createTime: note.time || Date.now(),
    author: {
      nickname: user.nickname || 'Người dùng Xiaohongshu',
      uniqueId: user.redId || user.userId || '',
      avatar: cleanXhsImageUrl(user.avatar)
    },
    stats: {
      plays: null,
      likes: note.interactInfo?.likedCount ? parseInt(note.interactInfo.likedCount, 10) : null,
      comments: note.interactInfo?.commentCount ? parseInt(note.interactInfo.commentCount, 10) : null,
      shares: note.interactInfo?.shareCount ? parseInt(note.interactInfo.shareCount, 10) : null
    },
    type: isVideo && videoUrl ? 'video' : 'slideshow',
    downloads: {
      noWatermarkSD: videoUrl,
      noWatermarkHD: videoUrl,
      watermark: null,
      music: null,
      musicTitle: null
    },
    sizeInfo: {
      sdSize: 'HD Gốc',
      hdSize: 'Full HD',
      wmSize: 'Bản gốc'
    },
    images: images
  };
}

module.exports = { extractXiaohongshu };
