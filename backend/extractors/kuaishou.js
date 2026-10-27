// ============================================================================
// Kuaishou Extractor (快手 / Kwai)
// Extracts watermark-free videos and photo albums
// ============================================================================
const { pooledAxios: axios } = require('../httpPool');

const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

async function extractKuaishou(rawUrl) {
  let targetUrl = rawUrl.trim();

  // 1. Follow short link redirect (v.kuaishou.com, kwai.com)
  try {
    const resp = await axios.get(targetUrl, {
      headers: {
        'User-Agent': UA_MOBILE,
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

  // 2. Extract photo ID
  const idMatch = targetUrl.match(/photo\/(?:[a-zA-Z0-9_-]+\/)?([a-zA-Z0-9_-]+)/) ||
                  targetUrl.match(/short-video\/([a-zA-Z0-9_-]+)/);
  const photoId = idMatch ? idMatch[1] : null;

  // 3. Request mobile view page
  const shareUrl = photoId ? `https://v.m.chenzhongtech.com/fw/photo/${photoId}` : targetUrl;
  const pageResp = await axios.get(shareUrl, {
    headers: {
      'User-Agent': UA_MOBILE,
      'Referer': 'https://v.kuaishou.com/'
    },
    timeout: 15000
  });

  const html = pageResp.data;

  // 4. Parse JSON state or regex for video/images
  let photo = null;
  const stateMatch = html.match(/window\.(?:INIT_STATE|PAGE_MODEL)\s*=\s*(\{.+?\});/s);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      photo = state.photo || state.currentWork || state.photoData || null;
    } catch { }
  }

  // Fallback to regex patterns if JSON parsing fails
  let videoUrl = null;
  let title = 'Video 快手 (Kuaishou)';
  let cover = null;
  let nickname = 'Người dùng Kuaishou';
  let avatar = null;
  let images = [];

  if (photo) {
    title = photo.caption || photo.title || title;
    cover = photo.coverUrls?.[0]?.url || photo.coverUrl || null;
    nickname = photo.userName || photo.author?.name || nickname;
    avatar = photo.headUrl || photo.author?.avatar || null;

    // Check if slideshow
    if (photo.ext_params?.atlas?.list) {
      const cdn = photo.ext_params.atlas.cdn?.[0] || 'https://p1.a.yximgs.com';
      images = photo.ext_params.atlas.list.map(p => (p.startsWith('http') ? p : `${cdn}${p}`));
    }

    // Video streams
    if (photo.mainMvUrls && photo.mainMvUrls.length > 0) {
      videoUrl = photo.mainMvUrls[0].url;
    } else if (photo.videoUrl) {
      videoUrl = photo.videoUrl;
    }
  }

  // Regex fallback for video tag or URLs
  if (!videoUrl && images.length === 0) {
    const videoMatch = html.match(/"url"\s*:\s*"(https?:\/\/[^"]+?\.mp4[^"]*)"/) ||
                       html.match(/src="(https?:\/\/[^"]+?\.mp4[^"]*)"/);
    if (videoMatch) {
      videoUrl = videoMatch[1].replace(/\\u002F/g, '/');
    }
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
    if (titleMatch) title = titleMatch[1].replace(/_快手_.*$/, '').trim();
  }

  if (!videoUrl && images.length === 0) {
    throw new Error('Không thể phân tích video hoặc ảnh từ liên kết 快手 (Kuaishou).');
  }

  const isSlide = images.length > 0;

  return {
    success: true,
    platform: 'kuaishou',
    id: photoId || String(Date.now()),
    title: title,
    cover: cover || (images[0] || null),
    duration: photo?.duration ? Math.round(photo.duration / 1000) : 0,
    createTime: photo?.timestamp || Date.now(),
    author: {
      nickname: nickname,
      uniqueId: photo?.userId ? String(photo.userId) : '',
      avatar: avatar
    },
    stats: {
      plays: photo?.viewCount || null,
      likes: photo?.likeCount || null,
      comments: photo?.commentCount || null,
      shares: null
    },
    type: isSlide ? 'slideshow' : 'video',
    downloads: {
      noWatermarkSD: videoUrl,
      noWatermarkHD: videoUrl,
      watermark: null,
      music: photo?.music?.audioUrls?.[0]?.url || null,
      musicTitle: photo?.music?.name || null
    },
    sizeInfo: {
      sdSize: 'Tiêu chuẩn',
      hdSize: 'Gốc không logo',
      wmSize: 'Bản gốc'
    },
    images: images
  };
}

module.exports = { extractKuaishou };
