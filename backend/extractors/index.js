// ============================================================================
// Multi-Platform Social Media Extractor Dispatcher
// Automatically identifies platform, strips text noise, and routes to extractor
// ============================================================================
const { extractDouyin } = require('./douyin');
const { extractBilibili } = require('./bilibili');
const { extractXiaohongshu } = require('./xiaohongshu');
const { extractKuaishou } = require('./kuaishou');
const { extractWeibo } = require('./weibo');

/**
 * Clean user text input and extract the first valid URL
 * Handles Chinese app share text (e.g. "0.12 复制打开抖音... https://v.douyin.com/...")
 */
function extractUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(/https?:\/\/[a-zA-Z0-9\.\-\_\/\?\=\&\%\#\@\:\+\~]+/);
  return match ? match[0] : null;
}

/**
 * Identify platform from URL
 */
function identifyPlatform(url) {
  const lower = url.toLowerCase();

  if (lower.includes('douyin.com') || lower.includes('iesdouyin.com')) {
    return 'douyin';
  }
  if (lower.includes('bilibili.com') || lower.includes('b23.tv')) {
    return 'bilibili';
  }
  if (lower.includes('xiaohongshu.com') || lower.includes('xhslink.com')) {
    return 'xiaohongshu';
  }
  if (lower.includes('kuaishou.com') || lower.includes('gifshow.com') || lower.includes('kwai.com')) {
    return 'kuaishou';
  }
  if (lower.includes('weibo.com') || lower.includes('weibo.cn')) {
    return 'weibo';
  }
  if (lower.includes('tiktok.com')) {
    return 'tiktok';
  }

  return 'generic';
}

/**
 * Master Extract Function
 */
async function extractMedia(userInput) {
  const cleanUrl = extractUrl(userInput);
  if (!cleanUrl) {
    throw new Error('Không tìm thấy liên kết hợp lệ trong nội dung đã nhập. Vui lòng kiểm tra lại!');
  }

  const platform = identifyPlatform(cleanUrl);

  switch (platform) {
    case 'bilibili':
      return await extractBilibili(cleanUrl);

    case 'xiaohongshu':
      return await extractXiaohongshu(cleanUrl);

    case 'kuaishou':
      return await extractKuaishou(cleanUrl);

    case 'weibo':
      return await extractWeibo(cleanUrl);

    case 'douyin':
    case 'tiktok':
    case 'generic':
    default:
      return await extractDouyin(cleanUrl);
  }
}

module.exports = {
  extractUrl,
  identifyPlatform,
  extractMedia
};
