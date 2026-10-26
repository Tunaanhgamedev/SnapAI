import { useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Download, Sparkles, Music, Video, Image as ImageIcon,
  Clipboard, Trash2, Loader2, CheckCircle2, ShieldCheck,
  Zap, Layers, AlertCircle, Clock, Eye, Heart,
  MessageCircle, Share2, Menu, X, Globe2
} from 'lucide-react';

const API = 'http://localhost:5000';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtCount = (n) => {
  if (n == null) return null;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
};

const fmtDuration = (s) => {
  if (!s) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const PLATFORM_CONFIG = {
  douyin:      { name: 'Douyin (抖音)',      color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  tiktok:      { name: 'TikTok',             color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  xiaohongshu: { name: 'Tiểu Hồng Thư (小红书)', color: 'bg-red-500/15 text-red-300 border-red-500/30' },
  bilibili:    { name: 'Bilibili (哔哩哔哩)', color: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  kuaishou:    { name: 'Kuaishou (快手)',    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  weibo:       { name: 'Weibo (微博)',       color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  generic:     { name: 'Media Downloader',   color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' }
};

// ══════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

/** Download button — touch-friendly, responsive sizing */
function DlButton({ href, icon: Icon, label, badge, variant = 'default', className = '' }) {
  const base = 'flex items-center justify-between gap-2 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.97] touch-target';
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    success: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/30',
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60',
  };
  return (
    <a href={href} className={`${base} ${variants[variant]} ${className}`}>
      <span className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span className="text-xs px-2 py-0.5 rounded-lg bg-black/20 shrink-0 whitespace-nowrap">
          {badge}
        </span>
      )}
    </a>
  );
}

/** Stat pill */
function Stat({ icon: Icon, value, color }) {
  const v = fmtCount(value);
  if (!v) return null;
  return (
    <span className="flex items-center gap-1 sm:gap-1.5">
      <Icon className={`w-3.5 h-3.5 ${color || ''}`} />
      <span>{v}</span>
    </span>
  );
}

/** Image card with download + upscale buttons */
function ImageCard({ imgUrl, idx, proxyUrl, upscaleUrl, factor }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition">
      <div className="aspect-[3/4] overflow-hidden bg-slate-900 relative">
        <img
          src={imgUrl}
          alt={`Slide ${idx + 1}`}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          loading="lazy"
          decoding="async"
        />
        <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] sm:text-[11px] font-bold text-white/80">
          #{idx + 1}
        </span>
      </div>
      <div className="p-2 sm:p-2.5 flex flex-col gap-1.5 sm:gap-2">
        <a
          href={proxyUrl}
          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] sm:text-xs font-medium text-center flex items-center justify-center gap-1.5 transition active:scale-[0.97] touch-target"
        >
          <Download className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> Ảnh gốc
        </a>
        <a
          href={upscaleUrl}
          className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-[11px] sm:text-xs font-bold text-white text-center flex items-center justify-center gap-1.5 transition shadow-md shadow-indigo-600/20 active:scale-[0.97] touch-target"
        >
          <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> Làm nét {factor}x
        </a>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [url, setUrl]                     = useState('');
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [mediaData, setMediaData]         = useState(null);
  const [upscaleFactor, setUpscaleFactor] = useState('2');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ── Clipboard paste ────────────────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setUrl(text.trim()); setError(''); }
    } catch {
      setError('Trình duyệt chưa cấp quyền đọc clipboard. Hãy dùng Ctrl+V / ⌘V.');
    }
  }, []);

  const handleClear = useCallback(() => {
    setUrl(''); setMediaData(null); setError('');
  }, []);

  // ── Extract API ────────────────────────────────────────────────────────────
  const handleExtract = useCallback(async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Vui lòng dán liên kết (Douyin, TikTok, Tiểu Hồng Thư, Bilibili, Kuaishou, Weibo) vào ô trống!');
      return;
    }
    setLoading(true); setError(''); setMediaData(null);
    try {
      const res = await axios.post(`${API}/api/extract`, { url: trimmed });
      if (res.data?.success) setMediaData(res.data);
      else setError(res.data?.error || 'Không thể phân tích đường dẫn.');
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kết nối tới máy chủ (cổng 5000).');
    } finally {
      setLoading(false);
    }
  }, [url]);

  // ── URL builders (memoized) ────────────────────────────────────────────────
  const proxy = useCallback((fileUrl, suffix, ext = 'mp4') => {
    if (!fileUrl) return '#';
    return `${API}/api/download?fileUrl=${encodeURIComponent(fileUrl)}&filename=snap_${mediaData?.id || Date.now()}_${suffix}&ext=${ext}`;
  }, [mediaData]);

  const upscale = useCallback((imageUrl, idx) => {
    return `${API}/api/upscale-image?imageUrl=${encodeURIComponent(imageUrl)}&scale=${upscaleFactor}&filename=snap_photo_${mediaData?.id || Date.now()}_${idx + 1}`;
  }, [mediaData, upscaleFactor]);

  // ── Feature cards data ─────────────────────────────────────────────────────
  const features = useMemo(() => [
    {
      icon: <Globe2 className="w-5 sm:w-6 h-5 sm:h-6 text-cyan-400" />,
      title: 'Hỗ trợ Toàn diện MXH Trung Quốc',
      desc: 'Tải sạch logo từ Douyin (抖音), Tiểu Hồng Thư (小红书), Bilibili (B站), Kuaishou (快手), Weibo (微博).',
      grad: 'from-cyan-500/10'
    },
    {
      icon: <Sparkles className="w-5 sm:w-6 h-5 sm:h-6 text-purple-400" />,
      title: 'Nâng cấp 2K / 4K Super-Resolution',
      desc: 'Bộ lọc nội suy Lanczos3 kết hợp Unsharp Masking tăng độ nét và khử mờ cho ảnh nén.',
      grad: 'from-purple-500/10'
    },
    {
      icon: <ShieldCheck className="w-5 sm:w-6 h-5 sm:h-6 text-emerald-400" />,
      title: 'Stream Proxy Vượt Chặn 403',
      desc: 'Truyền tải trực tiếp từ CDN nguồn về trình duyệt, tự động giả lập Referer vượt tường lửa.',
      grad: 'from-emerald-500/10'
    }
  ], []);

  const platformInfo = mediaData ? (PLATFORM_CONFIG[mediaData.platform] || PLATFORM_CONFIG.generic) : null;

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen min-h-dvh bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/40 selection:text-white">

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50 safe-top">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between safe-x">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 animate-pulse-ring">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Snap</span>
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Bunny</span>
              <span className="text-indigo-400 text-xs sm:text-sm font-semibold">.ai</span>
            </span>
          </div>

          {/* Desktop badges */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60">TikTok</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-rose-300">Douyin</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-red-300">Tiểu Hồng Thư</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-sky-300">Bilibili</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-amber-300">Kuaishou</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-orange-300">Weibo</span>
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700/30 text-indigo-300">
              ✦ HD Enhancer
            </span>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer touch-target"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown badges */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800/60 px-3 py-3 flex flex-wrap gap-1.5 animate-slideDown safe-x">
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">TikTok</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-rose-300">Douyin</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-red-300">Tiểu Hồng Thư</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-sky-300">Bilibili</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-amber-300">Kuaishou</span>
            <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-orange-300">Weibo</span>
            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700/30 text-xs text-indigo-300">
              ✦ HD Enhancer
            </span>
          </div>
        )}
      </header>

      {/* ═══ MAIN ═════════════════════════════════════════════════════════════ */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 lg:py-16 safe-x">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="text-center mb-6 sm:mb-10 animate-fadeInUp">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] sm:text-xs font-medium mb-4 sm:mb-5">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            Đa nền tảng Trung Quốc & Quốc Tế • Miễn phí 100%
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 leading-tight">
            <span className="bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent">
              Tải Video & Ảnh Không Logo
            </span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm lg:text-base max-w-2xl mx-auto leading-relaxed px-2">
            Hỗ trợ <strong>Douyin (抖音)</strong>, <strong>Tiểu Hồng Thư (小红书)</strong>, <strong>Bilibili (B站)</strong>, <strong>Kuaishou (快手)</strong>, <strong>Weibo (微博)</strong> và <strong>TikTok</strong>. Tải sạch watermark, tải ảnh cuộn gốc và nâng cấp 4K bằng AI.
          </p>

          {/* Platform chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">抖音 Douyin</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">小红书 RED</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">哔哩哔哩 Bilibili</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">快手 Kuaishou</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">微博 Weibo</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">TikTok</span>
          </div>
        </div>

        {/* ── URL Input ─────────────────────────────────────────────────────── */}
        <form
          onSubmit={handleExtract}
          className="bg-slate-900/90 p-2 sm:p-2.5 rounded-2xl border border-slate-800 shadow-2xl shadow-indigo-950/30 mb-6 sm:mb-8 animate-fadeInUp"
          style={{ animationDelay: '80ms' }}
        >
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
            {/* Input */}
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); }}
                placeholder="Dán link hoặc chữ chia sẻ từ Douyin, Xiaohongshu, Bilibili, Kuaishou, Weibo, TikTok..."
                className="w-full bg-slate-950 text-slate-100 placeholder-slate-500 pl-3 sm:pl-4 pr-20 sm:pr-24 py-3.5 sm:py-4 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition text-sm"
              />
              {url ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2 sm:right-2.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition cursor-pointer touch-target"
                >
                  <Trash2 className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Xóa</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 sm:right-2.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition cursor-pointer touch-target"
                >
                  <Clipboard className="w-3.5 h-3.5" /> Dán
                </button>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.97] touch-target"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Đang phân tích...</>
              ) : (
                <><Download className="w-4 h-4" /> Lấy Link Tải</>
              )}
            </button>
          </div>
        </form>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-start sm:items-center gap-2.5 sm:gap-3 animate-fadeInUp">
            <AlertCircle className="w-4 sm:w-5 h-4 sm:h-5 shrink-0 mt-0.5 sm:mt-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading skeleton (responsive) ─────────────────────────────────── */}
        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 animate-fadeInUp">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              <div className="w-full sm:w-36 md:w-44 h-48 sm:h-56 rounded-xl bg-slate-800 animate-shimmer shrink-0" />
              <div className="flex-1 space-y-3 sm:space-y-4 py-1 sm:py-2">
                <div className="h-4 bg-slate-800 rounded-lg w-3/4 animate-shimmer" />
                <div className="h-3 bg-slate-800 rounded-lg w-1/2 animate-shimmer" />
                <div className="h-3 bg-slate-800 rounded-lg w-2/3 animate-shimmer" />
                <div className="grid grid-cols-2 gap-3 pt-3 sm:pt-4">
                  <div className="h-11 sm:h-12 bg-slate-800 rounded-xl animate-shimmer" />
                  <div className="h-11 sm:h-12 bg-slate-800 rounded-xl animate-shimmer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* RESULT CARD                                                          */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {mediaData && !loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-fadeInUp">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pb-4 sm:pb-6 border-b border-slate-800/80">

                {/* Cover thumbnail */}
                <div className="w-full sm:w-36 md:w-44 h-52 sm:h-56 rounded-xl overflow-hidden bg-slate-950 shrink-0 relative border border-slate-800 group mx-auto sm:mx-0 max-w-[280px] sm:max-w-none">
                  {mediaData.cover ? (
                    <img
                      src={mediaData.cover}
                      alt="Cover"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                      <Video className="w-8 h-8" />
                    </div>
                  )}

                  {/* Type badge */}
                  <span className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] sm:text-xs font-semibold flex items-center gap-1 sm:gap-1.5">
                    {mediaData.type === 'slideshow' ? (
                      <><ImageIcon className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-400" /> Slide ({mediaData.images.length})</>
                    ) : (
                      <><Video className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-indigo-400" /> Video</>
                    )}
                  </span>

                  {/* Platform badge */}
                  {platformInfo && (
                    <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold border backdrop-blur-md ${platformInfo.color}`}>
                      {platformInfo.name}
                    </span>
                  )}

                  {/* Duration */}
                  {mediaData.duration > 0 && (
                    <span className="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] sm:text-[11px] font-mono font-semibold flex items-center gap-1">
                      <Clock className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                      {fmtDuration(mediaData.duration)}
                    </span>
                  )}
                </div>

                {/* Info + Buttons */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    {/* Author */}
                    <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-3">
                      {mediaData.author.avatar && (
                        <img
                          src={mediaData.author.avatar}
                          alt={mediaData.author.nickname}
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-indigo-500/40 object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-100 text-sm sm:text-base truncate">{mediaData.author.nickname}</h3>
                        {mediaData.author.uniqueId && (
                          <p className="text-[11px] sm:text-xs text-slate-400 truncate">@{mediaData.author.uniqueId}</p>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-3 leading-relaxed mb-3 sm:mb-4">
                      {mediaData.title}
                    </p>

                    {/* Stats */}
                    {mediaData.stats && (
                      <div className="flex flex-wrap gap-3 sm:gap-4 text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4">
                        <Stat icon={Eye}            value={mediaData.stats.plays} />
                        <Stat icon={Heart}          value={mediaData.stats.likes}    color="text-rose-400" />
                        <Stat icon={MessageCircle}  value={mediaData.stats.comments} />
                        <Stat icon={Share2}         value={mediaData.stats.shares} />
                      </div>
                    )}
                  </div>

                  {/* ── VIDEO DOWNLOAD BUTTONS ───────────────────────────────── */}
                  {mediaData.type === 'video' && (
                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 stagger-children">
                      {mediaData.downloads.noWatermarkSD && (
                        <DlButton
                          href={proxy(mediaData.downloads.noWatermarkSD, 'NoWM_SD')}
                          icon={Download}
                          label="Không Logo (SD)"
                          badge={mediaData.sizeInfo.sdSize}
                          variant="primary"
                        />
                      )}
                      {mediaData.downloads.noWatermarkHD && (
                        <DlButton
                          href={proxy(mediaData.downloads.noWatermarkHD, 'NoWM_HD')}
                          icon={Sparkles}
                          label="Không Logo (Full HD)"
                          badge={mediaData.sizeInfo.hdSize}
                          variant="success"
                        />
                      )}
                      {mediaData.downloads.watermark && (
                        <DlButton
                          href={proxy(mediaData.downloads.watermark, 'Watermark')}
                          icon={Video}
                          label="Có Watermark"
                          badge={mediaData.sizeInfo.wmSize}
                        />
                      )}
                      {mediaData.downloads.music && (
                        <DlButton
                          href={proxy(mediaData.downloads.music, 'Music', 'mp3')}
                          icon={Music}
                          label={mediaData.downloads.musicTitle ? `♫ ${mediaData.downloads.musicTitle}` : 'Nhạc Nền (MP3)'}
                          badge="MP3"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── SLIDESHOW IMAGE GALLERY ────────────────────────────────────── */}
            {mediaData.type === 'slideshow' && mediaData.images.length > 0 && (
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                {/* Header + upscale toggle */}
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5 sm:gap-2">
                      <Layers className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-indigo-400" />
                      Ảnh gốc ({mediaData.images.length} ảnh)
                    </h4>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">
                      Tải ảnh gốc sạch hoặc nâng cấp độ nét bằng Super-Resolution 2K/4K.
                    </p>
                  </div>

                  {/* 2x / 4x toggle */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-950 p-1 sm:p-1.5 rounded-xl border border-slate-800 self-start xs:self-auto">
                    <span className="text-[11px] sm:text-xs text-slate-400 pl-2 hidden sm:inline">Nâng cấp:</span>
                    {['2', '4'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setUpscaleFactor(f)}
                        className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer touch-target ${
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

                {/* Responsive image grid */}
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 stagger-children">
                  {mediaData.images.map((imgUrl, idx) => (
                    <ImageCard
                      key={idx}
                      imgUrl={imgUrl}
                      idx={idx}
                      proxyUrl={proxy(imgUrl, `Slide_${idx + 1}`, 'jpeg')}
                      upscaleUrl={upscale(imgUrl, idx)}
                      factor={upscaleFactor}
                    />
                  ))}
                </div>

                {/* Slideshow music button */}
                {mediaData.downloads.music && (
                  <div className="mt-4 sm:mt-5">
                    <a
                      href={proxy(mediaData.downloads.music, 'Slideshow_Music', 'mp3')}
                      className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-xs sm:text-sm font-medium transition active:scale-[0.97] touch-target"
                    >
                      <Music className="w-4 h-4 text-purple-400" />
                      <span className="truncate">
                        {mediaData.downloads.musicTitle
                          ? `Nhạc nền: ${mediaData.downloads.musicTitle}`
                          : 'Tải nhạc nền Slideshow (MP3)'}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ FEATURE CARDS ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 mt-10 sm:mt-14 stagger-children">
          {features.map((f, i) => (
            <div
              key={i}
              className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-b ${f.grad} to-transparent bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition group`}
            >
              <div className="mb-2 sm:mb-3 group-hover:scale-110 transition">{f.icon}</div>
              <h3 className="font-semibold text-xs sm:text-sm text-white mb-1 sm:mb-1.5">{f.title}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ═══ FOOTER ═════════════════════════════════════════════════════════ */}
        <footer className="mt-10 sm:mt-14 text-center pb-4 safe-bottom">
          <p className="text-[11px] sm:text-xs text-slate-500">
            Douyin (抖音) • Xiaohongshu (小红书) • Bilibili (哔哩哔哩) • Kuaishou (快手) • Weibo (微博) • TikTok
          </p>
          <p className="text-[10px] sm:text-xs text-slate-600 mt-1">
            © {new Date().getFullYear()} SnapBunny.ai — Tải đa phương tiện không logo & Làm nét AI
          </p>
        </footer>
      </main>
    </div>
  );
}
