// ============================================================================
// Bilibili Extractor (哔哩哔哩 / B站)
// Extracts watermark-free video streams, HD cover, author info, and stats
// ============================================================================
const axios = require('axios');

const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

const fmtSize = (bytes) => {
  if (!bytes) return null;
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
};

async function extractBilibili(rawUrl) {
  let targetUrl = rawUrl.trim();

  // 1. Resolve short link (b23.tv)
  if (targetUrl.includes('b23.tv')) {
    try {
      const resp = await axios.get(targetUrl, {
        headers: { 'User-Agent': UA_MOBILE },
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

  // 2. Extract BV ID
  const bvMatch = targetUrl.match(/(BV[a-zA-Z0-9]{10})/i);
  if (!bvMatch) {
    throw new Error('Không tìm thấy mã video Bilibili (BV) hợp lệ.');
  }
  const bvid = bvMatch[1];

  // 3. Fetch Mobile SSR Page to bypass Wbi anti-bot restrictions
  const mobileUrl = `https://m.bilibili.com/video/${bvid}`;
  const pageResp = await axios.get(mobileUrl, {
    headers: {
      'User-Agent': UA_MOBILE,
      'Referer': 'https://m.bilibili.com/'
    },
    timeout: 15000
  });

  const html = pageResp.data;
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});/);
  if (!stateMatch) {
    throw new Error('Không thể phân tích dữ liệu trang Bilibili.');
  }

  const state = JSON.parse(stateMatch[1]);
  const video = state.video || {};
  const viewInfo = video.viewInfo || state.videoData || {};
  const owner = viewInfo.owner || {};
  const playInfo = (video.playUrlInfo && video.playUrlInfo[0]) || {};

  const streamUrl = playInfo.url || (playInfo.backup_url && playInfo.backup_url[0]);
  if (!streamUrl && !viewInfo.title) {
    throw new Error('Video Bilibili không tồn tại hoặc đã bị xóa/đặt quyền riêng tư.');
  }

  // Ensure cover URL starts with https:
  let coverUrl = viewInfo.pic || '';
  if (coverUrl.startsWith('//')) coverUrl = 'https:' + coverUrl;
  else if (coverUrl.startsWith('http:')) coverUrl = coverUrl.replace('http:', 'https:');

  let avatarUrl = owner.face || '';
  if (avatarUrl.startsWith('//')) avatarUrl = 'https:' + avatarUrl;

  const fileSize = playInfo.size ? fmtSize(playInfo.size) : null;

  return {
    success: true,
    platform: 'bilibili',
    id: bvid,
    title: viewInfo.title || 'Video Bilibili',
    cover: coverUrl,
    duration: viewInfo.duration || 0,
    createTime: viewInfo.pubdate || Date.now(),
    author: {
      nickname: owner.name || 'Người dùng Bilibili',
      uniqueId: String(owner.mid || ''),
      avatar: avatarUrl
    },
    stats: {
      plays: viewInfo.stat?.view || null,
      likes: viewInfo.stat?.like || null,
      comments: viewInfo.stat?.reply || null,
      shares: viewInfo.stat?.share || null
    },
    type: 'video',
    downloads: {
      noWatermarkSD: streamUrl,
      noWatermarkHD: streamUrl,
      watermark: null,
      music: null,
      musicTitle: null
    },
    sizeInfo: {
      sdSize: fileSize || 'Tiêu chuẩn',
      hdSize: fileSize || 'Gốc',
      wmSize: 'Bản gốc'
    },
    images: []
  };
}

module.exports = { extractBilibili };
