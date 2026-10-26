// ============================================================================
// Weibo Extractor (微博)
// Extracts original HD photos and HD video streams
// ============================================================================
const axios = require('axios');

const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, '').trim();
}

async function extractWeibo(rawUrl) {
  let targetUrl = rawUrl.trim();

  // Extract ID or mid from URL
  let statusId = null;
  const mMatch = targetUrl.match(/(?:status|detail|weibo\.com\/\d+)\/([a-zA-Z0-9]+)/);
  if (mMatch) {
    statusId = mMatch[1];
  }

  // If video.weibo.com/show?fid=...
  const fidMatch = targetUrl.match(/fid=([0-9:]+)/);

  // 1. Try mobile API if ID is available
  if (statusId) {
    try {
      const resp = await axios.get(`https://m.weibo.cn/statuses/show?id=${statusId}`, {
        headers: {
          'User-Agent': UA_MOBILE,
          'Referer': 'https://m.weibo.cn/'
        },
        timeout: 10000
      });

      const data = resp.data?.data;
      if (data) {
        const text = stripHtml(data.text);
        const user = data.user || {};
        const pics = (data.pics || []).map(p => p.large?.url || p.url).filter(Boolean);

        const pageInfo = data.page_info || {};
        const mediaInfo = pageInfo.media_info || {};
        const videoUrl = mediaInfo.stream_url_hd || mediaInfo.stream_url || pageInfo.stream_url;

        const isSlide = pics.length > 0 && !videoUrl;

        return {
          success: true,
          platform: 'weibo',
          id: String(data.id || statusId),
          title: text || 'Bài đăng 微博 (Weibo)',
          cover: data.page_info?.page_pic?.url || pics[0] || null,
          duration: mediaInfo.duration || 0,
          createTime: data.created_at || Date.now(),
          author: {
            nickname: user.screen_name || 'Người dùng Weibo',
            uniqueId: String(user.id || ''),
            avatar: user.profile_image_url || null
          },
          stats: {
            plays: pageInfo.play_count || null,
            likes: data.attitudes_count || null,
            comments: data.comments_count || null,
            shares: data.reposts_count || null
          },
          type: isSlide ? 'slideshow' : 'video',
          downloads: {
            noWatermarkSD: videoUrl,
            noWatermarkHD: videoUrl,
            watermark: null,
            music: null,
            musicTitle: null
          },
          sizeInfo: {
            sdSize: 'Tiêu chuẩn',
            hdSize: 'Full HD',
            wmSize: 'Bản gốc'
          },
          images: pics
        };
      }
    } catch { }
  }

  // 2. Fallback to direct page request
  const pageResp = await axios.get(targetUrl, {
    headers: { 'User-Agent': UA_MOBILE, 'Referer': 'https://weibo.com/' },
    timeout: 15000
  });

  const html = pageResp.data;
  const videoMatch = html.match(/"stream_url_hd"\s*:\s*"([^"]+)"/) ||
                     html.match(/"stream_url"\s*:\s*"([^"]+)"/);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);

  const videoUrl = videoMatch ? videoMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '') : null;

  if (!videoUrl) {
    throw new Error('Không thể phân tích nội dung từ liên kết 微博 (Weibo).');
  }

  return {
    success: true,
    platform: 'weibo',
    id: statusId || String(Date.now()),
    title: titleMatch ? stripHtml(titleMatch[1]).replace(/ - 微博$/, '') : 'Video Weibo',
    cover: null,
    duration: 0,
    createTime: Date.now(),
    author: {
      nickname: 'Người dùng Weibo',
      uniqueId: '',
      avatar: null
    },
    stats: { plays: null, likes: null, comments: null, shares: null },
    type: 'video',
    downloads: {
      noWatermarkSD: videoUrl,
      noWatermarkHD: videoUrl,
      watermark: null,
      music: null,
      musicTitle: null
    },
    sizeInfo: { sdSize: 'Tiêu chuẩn', hdSize: 'HD Gốc', wmSize: 'Bản gốc' },
    images: []
  };
}

module.exports = { extractWeibo };
