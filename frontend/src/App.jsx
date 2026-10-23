import React, { useState, useCallback } from 'react';
import axios from 'axios';
import {
  Download,
  Sparkles,
  Music,
  Video,
  Image as ImageIcon,
  Clipboard,
  Trash2,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Layers,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Play,
  ArrowUpRight,
  AlertCircle,
  Clock,
  Eye
} from 'lucide-react';

const API = 'http://localhost:5000';

// ── Số liệu hiển thị dạng ngắn: 1.2K, 3.4M ─────────────────────────────────
function formatCount(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

// ── Thời lượng: 75 → "1:15" ──────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT CHÍNH
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaData, setMediaData] = useState(null);
  const [upscaleFactor, setUpscaleFactor] = useState('2');

  // ── Clipboard: Dán nhanh ───────────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError('');
      }
    } catch {
      setError('Trình duyệt chưa cấp quyền đọc clipboard. Hãy dùng Ctrl+V.');
    }
  }, []);

  // ── Clear toàn bộ ──────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setUrl('');
    setMediaData(null);
    setError('');
  }, []);

  // ── Gửi link lên Backend phân tích ─────────────────────────────────────────
  const handleExtract = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError('Vui lòng dán đường dẫn TikTok hoặc Douyin vào ô phía trên!');
      return;
    }

    setLoading(true);
    setError('');
    setMediaData(null);

    try {
      const res = await axios.post(`${API}/api/extract`, { url: trimmed });
      if (res.data?.success) {
        setMediaData(res.data);
      } else {
        setError(res.data?.error || 'Không thể phân tích đường dẫn.');
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Không thể kết nối tới máy chủ. Hãy đảm bảo Backend đang chạy ở cổng 5000.'
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  // ── Tạo URL Stream Proxy (tải về máy) ─────────────────────────────────────
  const proxyUrl = useCallback((fileUrl, suffix, ext = 'mp4') => {
    if (!fileUrl) return '#';
    const name = `snapbunny_${mediaData?.id || Date.now()}_${suffix}`;
    return `${API}/api/download?fileUrl=${encodeURIComponent(fileUrl)}&filename=${name}&ext=${ext}`;
  }, [mediaData]);

  // ── Tạo URL Upscale ảnh (2x / 4x) ─────────────────────────────────────────
  const upscaleUrl = useCallback((imageUrl, index) => {
    const name = `snapbunny_photo_${mediaData?.id || Date.now()}_${index + 1}`;
    return `${API}/api/upscale-image?imageUrl=${encodeURIComponent(imageUrl)}&scale=${upscaleFactor}&filename=${name}`;
  }, [mediaData, upscaleFactor]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/40 selection:text-white">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-pulse-ring">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Snap</span>
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Bunny</span>
              <span className="text-indigo-400 text-sm font-semibold">.ai</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-medium text-slate-400">
            <span className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60">
              TikTok
            </span>
            <span className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60">
              Douyin
            </span>
            <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700/30 text-indigo-300">
              ✦ HD Enhancer
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-10 animate-fadeInUp">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Miễn phí 100% • Không cần đăng nhập
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent">
              Tải Video & Ảnh Không Logo
            </span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Hỗ trợ tải video TikTok & Douyin chất lượng gốc Full HD, tùy chọn giữ / xóa Watermark,
            tải nhạc nền MP3, ảnh cuộn Slideshow và nâng cấp độ nét ảnh lên 2K / 4K.
          </p>
        </div>

        {/* ── Search Box ────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleExtract}
          className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 shadow-2xl shadow-indigo-950/30 mb-8 animate-fadeInUp"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Input field */}
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
                placeholder="Dán link TikTok / Douyin vào đây (VD: https://vt.tiktok.com/...)"
                className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 pl-4 pr-24 py-4 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition text-sm"
              />
              {url ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" /> Dán
                </button>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="px-7 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.97]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Lấy Link Tải
                </>
              )}
            </button>
          </div>
        </form>

        {/* ── Thông báo lỗi ──────────────────────────────────────────────── */}
        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3 animate-fadeInUp">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 animate-fadeInUp">
            <div className="flex gap-6">
              <div className="w-44 h-56 rounded-xl bg-slate-800 animate-shimmer shrink-0" />
              <div className="flex-1 space-y-4 py-2">
                <div className="h-4 bg-slate-800 rounded-lg w-3/4 animate-shimmer" />
                <div className="h-3 bg-slate-800 rounded-lg w-1/2 animate-shimmer" />
                <div className="h-3 bg-slate-800 rounded-lg w-2/3 animate-shimmer" />
                <div className="grid grid-cols-2 gap-3 pt-4">
                  <div className="h-12 bg-slate-800 rounded-xl animate-shimmer" />
                  <div className="h-12 bg-slate-800 rounded-xl animate-shimmer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* KẾT QUẢ BÓC TÁCH                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {mediaData && !loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeInUp">

            {/* ── Thông tin bài đăng + Nút tải video ─────────────────────── */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row gap-6 pb-6 border-b border-slate-800/80">
                {/* Cover image */}
                <div className="w-full md:w-44 h-56 rounded-xl overflow-hidden bg-slate-950 shrink-0 relative border border-slate-800 group">
                  <img
                    src={mediaData.cover}
                    alt="Cover"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    loading="lazy"
                  />
                  {/* Badge loại bài đăng */}
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-xs font-semibold flex items-center gap-1.5">
                    {mediaData.type === 'slideshow' ? (
                      <>
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Slide ({mediaData.images.length})</span>
                      </>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Video</span>
                      </>
                    )}
                  </span>
                  {/* Duration badge */}
                  {mediaData.duration > 0 && (
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(mediaData.duration)}
                    </span>
                  )}
                </div>

                {/* Thông tin chi tiết */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Tác giả */}
                    <div className="flex items-center gap-3 mb-3">
                      {mediaData.author.avatar && (
                        <img
                          src={mediaData.author.avatar}
                          alt={mediaData.author.nickname}
                          className="w-10 h-10 rounded-full border-2 border-indigo-500/40"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-100 text-base truncate">
                          {mediaData.author.nickname}
                        </h3>
                        {mediaData.author.uniqueId && (
                          <p className="text-xs text-slate-400 truncate">@{mediaData.author.uniqueId}</p>
                        )}
                      </div>
                    </div>

                    {/* Tiêu đề bài đăng */}
                    <p className="text-sm text-slate-300 line-clamp-3 leading-relaxed mb-4">
                      {mediaData.title}
                    </p>

                    {/* Số liệu tương tác */}
                    {mediaData.stats && (
                      <div className="flex flex-wrap gap-4 text-xs text-slate-400 mb-4">
                        {mediaData.stats.plays != null && (
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" /> {formatCount(mediaData.stats.plays)}
                          </span>
                        )}
                        {mediaData.stats.likes != null && (
                          <span className="flex items-center gap-1.5">
                            <Heart className="w-3.5 h-3.5 text-rose-400" /> {formatCount(mediaData.stats.likes)}
                          </span>
                        )}
                        {mediaData.stats.comments != null && (
                          <span className="flex items-center gap-1.5">
                            <MessageCircle className="w-3.5 h-3.5" /> {formatCount(mediaData.stats.comments)}
                          </span>
                        )}
                        {mediaData.stats.shares != null && (
                          <span className="flex items-center gap-1.5">
                            <Share2 className="w-3.5 h-3.5" /> {formatCount(mediaData.stats.shares)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── CÁC NÚT TẢI VIDEO ────────────────────────────────── */}
                  {mediaData.type === 'video' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
                      {/* Không Logo — SD */}
                      {mediaData.downloads.noWatermarkSD && (
                        <a
                          href={proxyUrl(mediaData.downloads.noWatermarkSD, 'NoWM_SD')}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all active:scale-[0.97] group"
                        >
                          <span className="flex items-center gap-2">
                            <Download className="w-4 h-4" /> Không Logo (SD)
                          </span>
                          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-indigo-800/80 group-hover:bg-indigo-700">
                            {mediaData.sizeInfo.sdSize}
                          </span>
                        </a>
                      )}

                      {/* Không Logo — Full HD */}
                      {mediaData.downloads.noWatermarkHD && (
                        <a
                          href={proxyUrl(mediaData.downloads.noWatermarkHD, 'NoWM_HD')}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.97] group"
                        >
                          <span className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Không Logo (Full HD)
                          </span>
                          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-black/25 group-hover:bg-black/30">
                            {mediaData.sizeInfo.hdSize}
                          </span>
                        </a>
                      )}

                      {/* Có Watermark */}
                      {mediaData.downloads.watermark && (
                        <a
                          href={proxyUrl(mediaData.downloads.watermark, 'Watermark')}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all border border-slate-700/60 active:scale-[0.97]"
                        >
                          <span className="flex items-center gap-2">
                            <Video className="w-4 h-4 text-slate-400" /> Có Watermark
                          </span>
                          <span className="text-xs text-slate-400">{mediaData.sizeInfo.wmSize}</span>
                        </a>
                      )}

                      {/* Nhạc nền MP3 */}
                      {mediaData.downloads.music && (
                        <a
                          href={proxyUrl(mediaData.downloads.music, 'Music', 'mp3')}
                          className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all border border-slate-700/60 active:scale-[0.97]"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <Music className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="truncate">
                              {mediaData.downloads.musicTitle
                                ? `♫ ${mediaData.downloads.musicTitle}`
                                : 'Tải Nhạc Nền (MP3)'}
                            </span>
                          </span>
                          <span className="text-xs text-slate-400 shrink-0 ml-2">MP3</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── DANH SÁCH ẢNH SLIDESHOW + NÂNG CẤP ĐỘ NÉT ──────────── */}
            {mediaData.type === 'slideshow' && mediaData.images.length > 0 && (
              <div className="px-6 pb-6">
                {/* Tiêu đề + Bộ chọn hệ số upscale */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h4 className="font-bold text-base text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      Ảnh gốc không logo ({mediaData.images.length} ảnh)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Tải ảnh gốc hoặc nâng cấp chất lượng bằng bộ lọc Super-Resolution.
                    </p>
                  </div>

                  {/* Toggle 2x / 4x */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                    <span className="text-xs text-slate-400 pl-2.5 hidden sm:inline">Nâng cấp:</span>
                    {['2', '4'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setUpscaleFactor(f)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          upscaleFactor === f
                            ? f === '2'
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                              : 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {f === '2' ? '2x (2K)' : '4x (4K)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid ảnh */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 stagger-children">
                  {mediaData.images.map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition"
                    >
                      {/* Preview ảnh */}
                      <div className="aspect-[3/4] overflow-hidden bg-slate-900 relative">
                        <img
                          src={imgUrl}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                          loading="lazy"
                        />
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[11px] font-bold text-white/80">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* Nút tải */}
                      <div className="p-2.5 flex flex-col gap-2">
                        <a
                          href={proxyUrl(imgUrl, `Slide_${idx + 1}`, 'jpeg')}
                          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-center flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                        >
                          <Download className="w-3.5 h-3.5" /> Ảnh gốc
                        </a>
                        <a
                          href={upscaleUrl(imgUrl, idx)}
                          className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white text-center flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 active:scale-[0.97]"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Làm nét {upscaleFactor}x
                        </a>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nút tải nhạc nền nếu có */}
                {mediaData.downloads.music && (
                  <div className="mt-5">
                    <a
                      href={proxyUrl(mediaData.downloads.music, 'Slideshow_Music', 'mp3')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-sm font-medium transition active:scale-[0.97]"
                    >
                      <Music className="w-4 h-4 text-purple-400" />
                      {mediaData.downloads.musicTitle
                        ? `Nhạc nền: ${mediaData.downloads.musicTitle}`
                        : 'Tải nhạc nền Slideshow (MP3)'}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FEATURE HIGHLIGHTS                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14 stagger-children"
          style={{ animationDelay: '160ms' }}
        >
          {[
            {
              icon: <CheckCircle2 className="w-6 h-6 text-indigo-400" />,
              title: 'Tùy chọn Watermark linh hoạt',
              desc: 'Lấy luồng phát gốc sạch 100% không dính ID hoặc giữ lại logo nguyên bản tùy nhu cầu sử dụng.',
              gradient: 'from-indigo-500/10 to-transparent'
            },
            {
              icon: <Sparkles className="w-6 h-6 text-purple-400" />,
              title: 'Nâng cấp chất lượng 2K / 4K',
              desc: 'Tích hợp bộ lọc nội suy Lanczos3 kết hợp Unsharp Masking giúp tăng độ chi tiết cho ảnh bị nén mờ.',
              gradient: 'from-purple-500/10 to-transparent'
            },
            {
              icon: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
              title: 'Stream Proxy tốc độ cao',
              desc: 'Truyền tải trực tiếp từ CDN gốc về trình duyệt qua luồng (stream pipe) — không lưu file tạm trên server.',
              gradient: 'from-emerald-500/10 to-transparent'
            }
          ].map((feat, i) => (
            <div
              key={i}
              className={`p-5 rounded-2xl bg-gradient-to-b ${feat.gradient} bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition group`}
            >
              <div className="mb-3 group-hover:scale-110 transition">{feat.icon}</div>
              <h3 className="font-semibold text-sm text-white mb-1.5">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* ── FAQ nhỏ ──────────────────────────────────────────────────────── */}
        <div className="mt-14 text-center">
          <p className="text-xs text-slate-500">
            Hỗ trợ TikTok, Douyin, v.douyin.com, vt.tiktok.com, vm.tiktok.com — Video & Slide ảnh
          </p>
          <p className="text-xs text-slate-600 mt-1">
            © {new Date().getFullYear()} SnapBunny.ai — Công cụ tải đa phương tiện miễn phí.
          </p>
        </div>
      </main>
    </div>
  );
}
