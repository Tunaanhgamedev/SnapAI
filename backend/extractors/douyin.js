// ============================================================================
// Douyin / TikTok Extractor (抖音 & TikTok)
// Extracts watermark-free videos, slideshow images (图集), HD streams & MP3 audio
// ============================================================================
const axios = require('axios');

const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const TIKWM = 'https://www.tikwm.com';

const norm = (p) => (!p ? null : p.startsWith('http') ? p : `${TIKWM}${p}`);
const fmtSize = (b) => {
  if (!b) return null;
  const mb = b / 1048576;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
};

async function extractDouyin(url) {
  // 1. Primary Engine: TikWM API (High-performance Douyin & TikTok parser)
  try {
    const { data: resp } = await axios.post(
      `${TIKWM}/api/`,
      new URLSearchParams({ url: url.trim(), count: 12, cursor: 0, web: 1, hd: 1 }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'User-Agent': UA_PC },
        timeout: 15000
      }
    );

    if (resp.code === 0 && resp.data) {
      const d = resp.data;
      const isSlide = Array.isArray(d.images) && d.images.length > 0;

      return {
        success: true,
        platform: url.includes('douyin') ? 'douyin' : 'tiktok',
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
          hdSize: fmtSize(d.hd_size) || 'Full HD',
          wmSize: fmtSize(d.wm_size) || 'Bản gốc'
        },
        images: isSlide ? d.images.map(norm) : []
      };
    }
  } catch (err) {
    console.warn('[Douyin TikWM Fallback]', err.message);
  }

  // 2. Secondary Engine: Direct Douyin iteminfo resolution
  try {
    let target = url.trim();
    if (target.includes('v.douyin.com')) {
      const red = await axios.get(target, {
        headers: { 'User-Agent': UA_MOBILE },
        maxRedirects: 5,
        timeout: 10000
      });
      target = red.request?.res?.responseUrl || target;
    }

    const idMatch = target.match(/(?:video|note)\/(\d+)/);
    if (idMatch) {
      const awemeId = idMatch[1];
      const detailResp = await axios.get(
        `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${awemeId}`,
        {
          headers: { 'User-Agent': UA_MOBILE, 'Referer': 'https://www.douyin.com/' },
          timeout: 10000
        }
      );

      const item = detailResp.data?.item_list?.[0];
      if (item) {
        const isSlide = Array.isArray(item.images) && item.images.length > 0;
        let videoClean = item.video?.play_addr?.url_list?.[0] || '';
        videoClean = videoClean.replace('playwm', 'play').replace(/^http:\/\//, 'https://');

        const images = isSlide
          ? item.images.map(img => img.url_list?.[0]).filter(Boolean)
          : [];

        return {
          success: true,
          platform: 'douyin',
          id: awemeId,
          title: item.desc || 'Video 抖音 (Douyin)',
          cover: item.video?.cover?.url_list?.[0] || images[0] || null,
          duration: Math.round((item.duration || 0) / 1000),
          createTime: item.create_time,
          author: {
            nickname: item.author?.nickname || 'Người dùng Douyin',
            uniqueId: item.author?.unique_id || item.author?.short_id || '',
            avatar: item.author?.avatar_thumb?.url_list?.[0] || null
          },
          stats: {
            plays: null,
            likes: item.statistics?.digg_count || null,
            comments: item.statistics?.comment_count || null,
            shares: item.statistics?.share_count || null
          },
          type: isSlide ? 'slideshow' : 'video',
          downloads: {
            noWatermarkSD: videoClean,
            noWatermarkHD: videoClean,
            watermark: null,
            music: item.music?.play_url?.url_list?.[0] || null,
            musicTitle: item.music?.title || null
          },
          sizeInfo: {
            sdSize: 'Tiêu chuẩn',
            hdSize: 'Gốc không logo',
            wmSize: 'Bản gốc'
          },
          images: images
        };
      }
    }
  } catch (err) {
    console.warn('[Douyin Direct Fallback]', err.message);
  }

  throw new Error('Không thể phân tích liên kết Douyin / TikTok. Vui lòng kiểm tra lại đường dẫn hoặc trạng thái bài viết.');
}

module.exports = { extractDouyin };
