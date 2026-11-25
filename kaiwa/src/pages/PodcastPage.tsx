import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useReducer } from 'react';
import {
  Loader2, AlertTriangle, RefreshCw, PlayCircle, ListVideo, Heart, Check, Type, Languages, Crosshair, Play, Pause, Volume2, VolumeX, Headphones, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';
import SiteNav from '../components/SiteNav';
import PodcastTopBar from '../components/podcast/PodcastTopBar';
import { DATA_BASE } from '../utils/dataBase';
import { navigate, HREF } from '../utils/route';
import {
  PodcastProgressMap, PodcastDisplayPrefs, loadPodcastProgress, savePodcastProgress, getPodcastEntry,
  withToggleSaved, withProgress, withClearedHistory, withClearedSaved, loadDisplayPrefs, saveDisplayPrefs,
} from '../components/podcast/podcastProgress';

// =====================================================================================
// TRANG VIDEO SHADOWING (#/podcast) của Dora Kaiwa - CHÉP NGUYÊN trang /kaiwa/video/ của web Phá Đảo Tiếng Nhật (src/podcast/PodcastPage.tsx),
// đổi KanjiNav -> SiteNav, bỏ phần khoá cho khách / đồng bộ đám mây VPS (web ta ai vào cũng đã đăng nhập; đã xem / đã lưu chỉ lưu localStorage):
//   - #/podcast               : phần giới thiệu (hình minh hoạ SVG + tiêu đề), rồi Tiếp tục xem / Đã lưu (khi có) và các DANH SÁCH PHÁT
//                               (mỗi danh sách 1 thẻ bìa ghép 3 ảnh video).
//   - #/podcast/ds/<mã>       : trang xem TRỌN một danh sách phát (lọc cấp độ N5..N1, chia trang 20 video).
//   - #/podcast/<youtubeId>   : xem 1 video - trình phát YouTube khoá hẳn UI gốc (thanh điều khiển tự làm: tua, tốc độ, âm lượng)
//                               + phụ đề chạy theo câu (tiếng Nhật có furigana / dịch Việt), bấm câu để tua, lặp câu, tự cuộn.
//     Đổi màn bằng #hash nên nút quay lại của trình duyệt / điện thoại về đúng màn trước (xem utils/route.ts).
// Dữ liệu tĩnh công khai (cùng domain, xem utils/dataBase.ts): public/data/podcast/danh-sach.json ({ playlists: [...] }) +
// public/data/podcast/<youtubeId>.json (các câu { start, end, text (có furigana [漢字](かな)), vi }).
// Đã lưu / Đã xem: localStorage (components/podcast/podcastProgress.ts).
// =====================================================================================

interface Segment {
  start: number;
  end: number;
  text: string; // câu tiếng Nhật; chữ Hán có furigana dạng [漢字](かな)
  vi?: string;
}

interface PodcastVideo {
  youtube: string; // mã video YouTube 11 ký tự
  title: string; // tiêu đề tiếng Việt
  tieuDeGoc?: string; // tiêu đề gốc trên YouTube
  kenh?: string;
  capDo?: string; // N5..N1
  duration?: string; // dạng hiển thị "7:29"
  soCau?: number;
  created_at?: string | null;
  gia?: boolean; // VIDEO GIẢ làm mẫu giao diện (chưa có video thật)
  chu?: string; // chữ Nhật lớn trên ảnh bìa tự vẽ của video giả
}

interface Playlist {
  id: string;
  ten: string;
  moTa?: string;
  capDo?: string;
  mau?: string; // màu nhấn của danh sách phát
  videos: PodcastVideo[];
}

// Chữ Nhật có furigana: "今日は[天気](てんき)" dạng [漢字](かな). Cụm [chữ đọc / chữ Hán] là inline-block, chữ đọc là khối THƯỜNG nằm trên (KHÔNG position, KHÔNG transform:
// user 24/11 bật furigana thì vuốt phụ đề trên điện thoại bị giật - mỗi phần tử position/transform thành 1 lớp riêng, ~1.400 lớp/video). margin-top âm để cụm
// không làm cao dòng (dòng vẫn cao đúng FURI_LH), margin ngang âm để chữ đọc dài tràn đều hai bên mà không nới rộng chữ Hán;
// chữ đọc dài hơn chữ Hán thì TỰ CO NGANG (scaleX) nhưng chỉ tới FURI_MIN_SCALE (giống trang in A4ExamVocabPage / DoraJpText - user 24/11: "co ở 1 mức nào đó thôi"),
// phần còn dư chỉ chừa lề khi sát 1 từ furigana khác (để 2 chữ đọc không đè nhau). showFurigana=false thì chỉ hiện chữ (bỏ furigana).
// Ô chứa cao FURI_LH lần cỡ chữ (khung gọi phải đặt đúng lineHeight này): chữ chính nằm giữa ô, đáy furigana cách ĐỈNH chữ chính FURI_GAP_EM.
const FURI_RE = /\[([^\]]+)\]\(([^)]*)\)/g;
const FURI_LH = 2.25; // nới thêm: chữ đọc luôn cách dòng trên một khe rõ ràng (user 24/11: tuyệt đối không chạm dòng trên)
const FURI_RT_EM = 0.62;
const FURI_GAP_EM = 0.26;
const FURI_MIN_SCALE = 0.72;
let furiCtx: CanvasRenderingContext2D | null | undefined;
const furiCache = new Map<string, number>();
const furiRong = (t: string, weight: number) => { // bề rộng (em) đo bằng canvas ở cỡ 100px nên đúng với mọi cỡ chữ
  const k = `${weight}|${t}`;
  const c = furiCache.get(k);
  if (c !== undefined) return c;
  if (furiCtx === undefined) furiCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  let w = t.length;
  if (furiCtx) {
    furiCtx.font = `${weight} 100px "Noto Sans JP", "Yu Gothic", "Hiragino Sans", sans-serif`;
    w = furiCtx.measureText(t).width / 100;
  }
  furiCache.set(k, w);
  return w;
};
function FuriText({ text, show, rtEm = FURI_RT_EM }: { text: string; show: boolean; rtEm?: number }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  FURI_RE.lastIndex = 0;
  while ((m = FURI_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (show) {
      const baseEm = furiRong(m[1], 600);
      const readEm = furiRong(m[2], 500) * rtEm;
      let scale = 1;
      let dư = 0;
      if (readEm > baseEm && readEm > 0) {
        scale = Math.max(FURI_MIN_SCALE, baseEm / readEm);
        dư = Math.max(0, (readEm * scale - baseEm) / 2);
      }
      const fs = rtEm; // GIỮ NGUYÊN cỡ chữ đọc (user 24/11); chữ đọc dài thì chỉ NÉN NGANG (scaleX) - chỉ vài cụm cần nên ít lớp, không gây giật
      const tran = Math.max(0, (readEm - baseEm) / 2); // bề tràn mỗi bên khi CHƯA nén (bố cục), phần nén do transform lo
      const truoc = text[m.index - 1] === ')';
      const sau = text[m.index + m[0].length] === '[';
      const lề = dư > 0 && (truoc || sau) ? { margin: `0 ${sau ? dư.toFixed(3) : 0}em 0 ${truoc ? dư.toFixed(3) : 0}em` } : undefined;
      parts.push(
        <span key={m.index} className="pod-furi" style={lề}>
          <span className="pod-furi-rt" style={{ fontSize: `${fs.toFixed(4)}em`, margin: `${(-(fs + FURI_GAP_EM - (FURI_LH - 1) / 2) / fs).toFixed(3)}em ${(-tran / fs).toFixed(3)}em ${(FURI_GAP_EM / fs).toFixed(3)}em`, ...(scale < 1 ? { transform: `scaleX(${scale.toFixed(3)})` } : {}) }}>{m[2]}</span>{m[1]}
        </span>
      );
    } else parts.push(m[1]);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

// THỜI GIAN PHÁT: vòng poll ghi vào kho này (KHÔNG dùng useState của trang) -> chỉ 2 khối nhỏ (thanh tua, nhãn giờ) vẽ lại 5 lần/giây,
// còn cả trang + danh sách phụ đề đứng yên. Trước đây setCurrentTime làm CẢ TRANG vẽ lại mỗi 200ms -> vuốt danh sách phụ đề trên điện thoại bị giật (user 24/11).
interface KhoGio { t: number; subs: Set<() => void>; }
const taoKhoGio = (): KhoGio => ({ t: 0, subs: new Set() });
const ghiGio = (k: KhoGio, t: number) => { k.t = t; k.subs.forEach((f) => f()); };
function useGio(k: KhoGio): number {
  const [, vẽLại] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { k.subs.add(vẽLại); return () => { k.subs.delete(vẽLại); }; }, [k]);
  return k.t;
}
function ThanhTua({ kho, duration, scrubDraft, onChange, onStart }: { kho: KhoGio; duration: number; scrubDraft: number | null; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onStart: () => void }) {
  const gio = useGio(kho); // luôn gọi hook (không đặt sau ??)
  const t = scrubDraft ?? gio;
  return (
    <input
      type="range" min={0} max={duration || 0} step={0.1}
      value={t}
      onChange={onChange}
      onMouseDown={onStart}
      onTouchStart={onStart}
      className="player-range w-full"
      style={{ ['--fill' as any]: `${duration > 0 ? (t / duration) * 100 : 0}%` }}
      aria-label="Tua video"
    />
  );
}
function NhanGio({ kho, duration, scrubDraft }: { kho: KhoGio; duration: number; scrubDraft: number | null }) {
  const t = useGio(kho);
  return <span className="text-[11px] font-bold text-white/80 tabular-nums shrink-0">{formatTime(scrubDraft ?? t)} / {formatTime(duration)}</span>;
}

// MỘT DÒNG phụ đề trong danh sách bên phải/dưới. React.memo: poll 200ms cập nhật thanh thời gian làm cả trang vẽ lại; nếu không memo thì hàng trăm dòng
// (mỗi dòng có furigana) bị vẽ lại 5 lần/giây -> vuốt danh sách trên điện thoại bị giật (user 24/11). Các hàm truyền vào đều ổn định (useCallback).
const DongPhuDe = React.memo(function DongPhuDe({ seg, idx, active, looping, showFurigana, showVi, onPick, onLoop, setRef }: {
  seg: Segment; idx: number; active: boolean; looping: boolean; showFurigana: boolean; showVi: boolean;
  onPick: (i: number) => void; onLoop: (i: number) => void; setRef: (i: number, el: HTMLElement | null) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      ref={(el) => setRef(idx, el)}
      onClick={() => onPick(idx)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(idx); } }}
      className={`text-left px-3.5 py-3 rounded-xl border-l-4 transition-colors lg:transition-all flex items-start gap-3 cursor-pointer outline-none ${active ? 'bg-[#E3EEFF] border-[#2F7DF6] shadow-sm' : 'border-transparent hover:bg-[#F0F6FF]'}`}
    >
      <span className="flex flex-col items-center gap-0.5 shrink-0">
        {/* khung giờ cao ĐÚNG bằng dòng chữ Nhật đầu tiên (cùng cỡ chữ + lineHeight) và căn giữa -> giờ luôn ngang tâm dòng chữ chính, bật/tắt furigana không đổi */}
        <span className="text-[15px] sm:text-base flex items-center" style={{ height: `${showFurigana ? FURI_LH : 1.6}em`, lineHeight: 1 }}>
          <span className={`text-[10px] font-bold tabular-nums leading-none ${active ? 'text-[#2F7DF6]' : 'text-[#8B9BB8]'}`}>{formatTime(seg.start)}</span>
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onLoop(idx); }}
          aria-label={looping ? 'Tắt lặp câu này' : 'Lặp câu này'}
          aria-pressed={looping}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors lg:transition-all ${looping ? 'bg-[#2F7DF6] text-white shadow-sm' : 'text-[#8B9BB8] hover:bg-[#D3E4FC] hover:text-[#2F7DF6]'}`}
        >
          <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-[15px] sm:text-base font-semibold pod-jp [overflow-wrap:anywhere] ${active ? 'text-[#1A2A54]' : 'text-[#1A2A54]/75'}`} style={{ fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif", lineHeight: showFurigana ? FURI_LH : 1.6 }}><FuriText text={seg.text} show={showFurigana} /></span>
        {showVi && seg.vi && <span className={`text-xs sm:text-[13px] leading-snug transition-colors ${active ? 'text-emerald-700 font-medium' : 'text-emerald-600/80'}`}>{seg.vi}</span>}
      </span>
    </div>
  );
});

// Màu nhãn cấp độ (mỗi cấp một màu): N5 lục, N4 xanh dương, N3 tím, N2 cam, N1 đỏ.
const CAP_THU_TU = ['N5', 'N4', 'N3', 'N2', 'N1'];
const CAP_MAU: Record<string, string> = { N5: '#10B981', N4: '#2F7DF6', N3: '#8B5CF6', N2: '#F59E0B', N1: '#EF4444' };
const capMau = (c?: string) => (c && CAP_MAU[c]) || '#2F7DF6';
function CapNhan({ cap, className = 'px-1.5 py-0.5 text-[10px]' }: { cap: string; className?: string }) {
  const m = capMau(cap);
  return <span className={`${className} rounded-md font-black shrink-0 leading-none`} style={{ color: m, background: `${m}1A`, border: `1px solid ${m}59` }}>{cap}</span>;
}
const capCoTrong = (vs: { capDo?: string }[]) => CAP_THU_TU.filter((c) => vs.some((v) => v.capDo === c));

// Phân trang trang danh sách phát: mỗi trang 20 video; dãy số trang gọn (1 … 4 5 6 … 12)
const VIDEO_MOI_TRANG = 20;
const dayTrang = (cur: number, total: number): (number | '…')[] => {
  const arr = Array.from(new Set([1, total, cur - 1, cur, cur + 1])).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  arr.forEach((n, i) => { if (i > 0 && n - arr[i - 1] > 1) out.push('…'); out.push(n); });
  return out;
};

// Ảnh bìa YouTube: mqdefault chỉ 320px nên bị mờ trên màn nét. Dùng sddefault (640px; 4:3 có dải đen trên/dưới, object-cover cắt bỏ),
// nếu video không có thì lùi về hqdefault (480px, luôn có). Chỉ cần cho ảnh lớn (thẻ video); ảnh ghép nhỏ giữ mqdefault.
const anhSan = (id: string) => `https://img.youtube.com/vi/${id}/sddefault.jpg`;
const anhLui = (e: React.SyntheticEvent<HTMLImageElement>, id: string) => {
  const im = e.currentTarget;
  if (!im.dataset.lui) { im.dataset.lui = '1'; im.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`; }
};
// Khi video KHÔNG có sddefault, YouTube trả HTTP 404 nhưng kèm ảnh xám giữ chỗ 120x90 -> trình duyệt vẫn hiển thị, onError KHÔNG chạy
// (lỗi 25/11: video elx2gCu_C0I hiện khung xám ba chấm). Nên cũng kiểm lúc ảnh tải xong: rộng <=120px = ảnh giữ chỗ -> lùi hqdefault.
const anhKiem = (e: React.SyntheticEvent<HTMLImageElement>, id: string) => {
  if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth <= 120) anhLui(e, id);
};

// TẢI TRƯỚC ảnh bìa (ưu tiên thấp, mỗi ảnh chỉ tải 1 lần): vào trang = 10 video đầu của mọi danh sách phát; mở danh sách phát = trang đang xem + 1 trang sau.
// Dữ liệu phụ đề của video (public/data/podcast/<id>.json) KHÔNG tải trước: chỉ tải khi bấm vào video đó.
const daTaiAnh = new Set<string>();
const giuAnh: HTMLImageElement[] = [];
const taiTruocAnh = (ids: (string | undefined)[]) => {
  ids.forEach((id) => {
    if (!id || daTaiAnh.has(id)) return;
    daTaiAnh.add(id);
    const im = new Image();
    (im as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'low';
    im.decoding = 'async';
    const lui = () => { im.onerror = null; im.onload = null; im.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`; };
    im.onerror = lui;
    im.onload = () => { if (im.naturalWidth > 0 && im.naturalWidth <= 120) lui(); };
    im.src = anhSan(id);
    giuAnh.push(im); // giữ tham chiếu để trình duyệt không bỏ giữa chừng
  });
};

type Stage = 'list' | 'loading' | 'ready' | 'error';

const SPEEDS = [0.75, 1, 1.25];
const POLL_MS = 200;
const LOOP_EPSILON = 0.15; // lệch cuối câu khi lặp (sai số polling)
const HIDE_CONTROLS_MS = 2500;
const YT_ID = /^[\w-]{11}$/;

// TRÌNH DUYỆT TRONG TIKTOK / ZALO / FACEBOOK: WebView của các app này KHÔNG phát video "inline" nên dù đã có playsinline:1 video vẫn bị đẩy lên TOÀN MÀN HÌNH
// -> mất phụ đề, nút lặp câu, thanh điều khiển tự làm. (User 24/11: báo TikTok + Zalo bị, rồi bảo thêm cả Facebook. FBAN/FBAV/FB_IAB cũng bắt luôn Messenger; Instagram chưa thêm.)
// Web không ép được app bật tuỳ chọn đó -> chỉ nhắc người xem mở bằng Safari/Chrome (nút Sao chép link; Android thêm nút mở thẳng Chrome).
// TikTok (user 25/11: Facebook + Zalo nhận, TikTok không nhận): bản TikTok châu Á/Việt Nam hay ghi tên nội bộ "trill_<số>" thay vì "musical_ly" -> thêm trill + aweme (tên nội bộ khác)
// + dấu hiệu chung của mọi app ByteDance (ByteLocale/, JsSdk/ trong UA). Nếu vẫn không nhận: lấy UA thật của máy user (mở trang "what is my user agent" ngay trong TikTok) rồi thêm đúng từ khoá đó.
const UA_TRONG_APP = /musical_ly|BytedanceWebview|TikTok|ttwebview|trill|aweme|ByteLocale|JsSdk|Zalo|FBAN|FBAV|FB_IAB|FBIOS/i;
const KHOA_DA_TAT_NHAC_APP = 'dora_kaiwa_video_tat_nhac_app';
function laTrinhDuyetTrongApp(): boolean {
  try { return UA_TRONG_APP.test(navigator.userAgent || ''); } catch { return false; }
}
function linkMoBangChrome(): string | null {
  // Chỉ Android. Dạng intent://host/path#<hash>#Intent;... (hash của video giữ trước "#Intent;").
  try {
    if (!/Android/i.test(navigator.userAgent || '')) return null;
    const u = new URL(window.location.href);
    return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`;
  } catch { return null; }
}
async function saoChepLink(): Promise<boolean> {
  const link = window.location.href;
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(link); return true; }
  } catch { /* thử cách cũ bên dưới */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = link;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, link.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

function NhacMoTrinhDuyet() {
  const [hien, setHien] = useState(() => {
    if (!laTrinhDuyetTrongApp()) return false;
    try { return sessionStorage.getItem(KHOA_DA_TAT_NHAC_APP) !== '1'; } catch { return true; }
  });
  const [daChep, setDaChep] = useState<boolean | null>(null);
  const linkChrome = useMemo(() => linkMoBangChrome(), []);
  if (!hien) return null;
  const tat = () => {
    setHien(false);
    try { sessionStorage.setItem(KHOA_DA_TAT_NHAC_APP, '1'); } catch { /* bỏ qua */ }
  };
  const chep = async () => {
    const ok = await saoChepLink();
    setDaChep(ok);
    window.setTimeout(() => setDaChep(null), 2500);
  };
  return (
    <div className="shrink-0 w-full rounded-2xl bg-amber-50 border border-amber-200 px-3.5 py-3 flex flex-col gap-2">
      <p className="text-[13px] leading-snug font-semibold text-amber-900">
        Bạn đang mở trong trình duyệt của ứng dụng (TikTok, Zalo, Facebook) nên video có thể tự phóng toàn màn hình và mất phụ đề.
        Hãy mở trang này bằng <b>Safari</b> hoặc <b>Chrome</b> để xem video kèm phụ đề.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={chep} className="px-3 py-1.5 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-xs font-bold rounded-lg active:scale-95 transition-all">
          {daChep === null ? 'Sao chép link' : daChep ? 'Đã sao chép - dán vào Safari/Chrome' : 'Không chép được - hãy giữ vào thanh địa chỉ'}
        </button>
        {linkChrome && (
          <a href={linkChrome} className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-bold rounded-lg active:scale-95 transition-all">
            Mở bằng Chrome
          </a>
        )}
        <button type="button" onClick={tat} className="ml-auto px-2 py-1.5 text-xs font-semibold text-amber-800/80">
          Để sau
        </button>
      </div>
    </div>
  );
}

// Nạp YouTube IFrame API đúng 1 lần.
let ytApiPromise: Promise<void> | null = null;
function loadYoutubeIframeApi(): Promise<void> {
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Địa chỉ nằm trong #hash của web: #/podcast/<mã YouTube> = xem video; #/podcast/ds/<mã> = trang xem TRỌN một danh sách phát.
const hashParts = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
const hashId = () => {
  const p = hashParts();
  return p[0] === 'podcast' && YT_ID.test(p[1] || '') ? p[1] : null;
};
// #/podcast/ds/<mã danh sách phát> = trang xem TRỌN một danh sách phát
const hashPl = () => {
  const p = hashParts();
  return p[0] === 'podcast' && p[1] === 'ds' && p[2] ? p[2] : null;
};

// ===== HÌNH MINH HOẠ đầu trang (SVG TĨNH - user 23/11 bỏ chuyển động): tai nghe ôm nút phát, sóng âm, bong bóng thoại tiếng Nhật, sao (đã bỏ nốt nhạc 24/11) =====
function HinhGioiThieu({ className = '' }: { className?: string }) {
  const jp = "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif";
  const sao = (x: number, y: number, r: number) => `M${x} ${y - r} l${r * 0.4} ${r * 0.6} l${r * 0.6} ${r * 0.4} l${-r * 0.6} ${r * 0.4} l${-r * 0.4} ${r * 0.6} l${-r * 0.4} ${-r * 0.6} l${-r * 0.6} ${-r * 0.4} l${r * 0.6} ${-r * 0.4} z`;
  return (
    <svg viewBox="0 0 360 260" className={className} role="img" aria-label="Hình minh hoạ luyện shadowing tiếng Nhật">
      <defs>
        <linearGradient id="pc-dia" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#DCEAFE" /></linearGradient>
        <linearGradient id="pc-cup" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD166" /><stop offset="1" stopColor="#F59E0B" /></linearGradient>
      </defs>
      {/* vòng sáng nền */}
      <circle cx="180" cy="138" r="104" fill="#BFD7FB" opacity="0.25" />
      <circle cx="180" cy="138" r="78" fill="#BFD7FB" opacity="0.3" />
      {/* sóng âm 2 bên */}
      {[-1, 1].map((s) => (
        <g key={s} fill="#93C5FD">
          {[0, 1, 2, 3, 4].map((i) => {
            const h = [18, 34, 52, 34, 18][i];
            const x = 180 + s * (118 + i * 12) - 3;
            return <rect key={i} x={x} y={150 - h / 2} width="6" height={h} rx="3" opacity={1 - i * 0.15} />;
          })}
        </g>
      ))}
      {/* tai nghe + đĩa phát */}
      <g>
        <circle cx="180" cy="150" r="56" fill="url(#pc-dia)" stroke="#BFD7FB" strokeWidth="3" />
        <circle cx="180" cy="150" r="40" fill="none" stroke="#DCEAFE" strokeWidth="2" />
        <path d="M170 128 L198 150 L170 172 Z" fill="#2F7DF6" stroke="#2F7DF6" strokeWidth="6" strokeLinejoin="round" />
        <path d="M104 160 V138 A76 76 0 0 1 256 138 V160" fill="none" stroke="#1A2A54" strokeWidth="13" strokeLinecap="round" />
        <path d="M104 160 V138 A76 76 0 0 1 256 138 V160" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
        <rect x="86" y="138" width="34" height="58" rx="15" fill="url(#pc-cup)" stroke="#1A2A54" strokeWidth="4" />
        <rect x="240" y="138" width="34" height="58" rx="15" fill="url(#pc-cup)" stroke="#1A2A54" strokeWidth="4" />
      </g>
      {/* bong bóng thoại */}
      <g>
        <path d="M18 44 h102 a14 14 0 0 1 14 14 v20 a14 14 0 0 1 -14 14 h-62 l-14 14 v-14 h-26 a14 14 0 0 1 -14 -14 v-20 a14 14 0 0 1 14 -14 z" fill="#FFFFFF" stroke="#BFD7FB" strokeWidth="2" />
        <text x="69" y="74" textAnchor="middle" fontSize="20" fontWeight="700" fill="#1A2A54" style={{ fontFamily: jp }}>こんにちは</text>
      </g>
      <g>
        <path d="M236 22 h96 a14 14 0 0 1 14 14 v20 a14 14 0 0 1 -14 14 h-24 v14 l-14 -14 h-58 a14 14 0 0 1 -14 -14 v-20 a14 14 0 0 1 14 -14 z" fill="#FFFFFF" stroke="#BFD7FB" strokeWidth="2" />
        <text x="284" y="52" textAnchor="middle" fontSize="20" fontWeight="700" fill="#2F7DF6" style={{ fontFamily: jp }}>ききとり</text>
      </g>
      {/* sao lấp lánh */}
      <path d={sao(150, 30, 10)} fill="#FBBF24" />
      <path d={sao(58, 224, 7)} fill="#93C5FD" />
      <path d={sao(300, 224, 7)} fill="#93C5FD" />
      <path d={sao(222, 92, 5)} fill="#FBBF24" />
    </svg>
  );
}

// Ảnh bìa VIDEO GIẢ (làm mẫu giao diện): nền màu của danh sách phát + chữ Nhật lớn + sóng âm nhỏ.
function BiaGia({ chu, mau }: { chu?: string; mau: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${mau} 0%, ${mau}CC 55%, ${mau}88 100%)` }}>
      <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15" />
      <span className="absolute -left-4 -bottom-8 w-20 h-20 rounded-full bg-white/10" />
      <span className="relative text-white font-bold drop-shadow-sm text-[26px] md:text-[30px] leading-none" style={{ fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif" }}>{chu}</span>
      <span className="absolute left-2 bottom-2 flex items-end gap-[3px] opacity-80">
        {[6, 11, 16, 9, 13].map((h, i) => <span key={i} className="w-[3px] rounded-full bg-white" style={{ height: h }} />)}
      </span>
    </div>
  );
}

export default function PodcastPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // Các tập THẬT (bỏ video giả), không trùng - dùng cho Tiếp tục xem / Đã lưu / tiêu đề màn xem video.
  const videos = useMemo(() => {
    const m = new Map<string, PodcastVideo>();
    playlists.forEach((pl) => pl.videos.forEach((v) => { if (!v.gia && v.youtube && !m.has(v.youtube)) m.set(v.youtube, v); }));
    return [...m.values()];
  }, [playlists]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(() => hashId()); // video đang mở (theo hash)

  const [stage, setStage] = useState<Stage>('list');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loopIdx, setLoopIdx] = useState<number | null>(null); // chỉ số câu đang LẶP (bấm biểu tượng mũi tên xoay dưới giờ của câu); null = không lặp
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const khoGio = useRef<KhoGio>(taoKhoGio()).current; // thời gian phát hiện tại (xem KhoGio)
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [scrubDraft, setScrubDraft] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const [progress, setProgress] = useState<PodcastProgressMap>(() => loadPodcastProgress());
  const [displayPrefs, setDisplayPrefs] = useState<PodcastDisplayPrefs>(() => loadDisplayPrefs());
  const [trang, setTrang] = useState(1); // trang hiện tại của danh sách phát (20 video/trang)
  const lastPl = useRef<string | null>(null);
  const scrollMem = useRef({ list: 0, pl: 0 }); // vị trí cuộn của màn danh sách chính / trang danh sách phát khi rời đi
  const pendingScroll = useRef<number | null>(null);
  const prevView = useRef<'list' | 'pl' | 'video'>(hashId() ? 'video' : hashPl() ? 'pl' : 'list');
  useEffect(() => {
    // Trình duyệt tự khôi phục vị trí cuộn khi bấm "<" (history.back) TRƯỚC khi màn cũ vẽ xong -> nhảy giật. Tự quản vị trí cuộn cho trang này.
    const old = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = old; };
  }, []);
  const dauLuoiRef = useRef<HTMLDivElement | null>(null); // dòng tiêu đề "Tất cả video" (mốc cuộn khi chuyển trang)
  const [hoiXoa, setHoiXoa] = useState(false); // đang hỏi xác nhận xoá lịch sử xem
  const [capLoc, setCapLoc] = useState<string>(''); // bộ lọc cấp độ ở trang danh sách phát ('' = tất cả)
  const [plId, setPlId] = useState<string | null>(() => hashPl()); // danh sách phát đang mở trọn trang (theo hash #ds/<id>)
  const plIdRef = useRef(plId);
  plIdRef.current = plId;
  useLayoutEffect(() => {
    const view = openId ? 'video' : plId ? 'pl' : 'list';
    if (pendingScroll.current !== null) { window.scrollTo(0, pendingScroll.current); pendingScroll.current = null; }
    prevView.current = view;
  }, [openId, plId]);

  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const subtitleListRef = useRef<HTMLDivElement | null>(null);
  const loopIdxRef = useRef(loopIdx);
  loopIdxRef.current = loopIdx;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const segmentsRef = useRef<Segment[]>(segments);
  segmentsRef.current = segments;
  const scrubbingRef = useRef(false); // đang kéo thanh tua: vòng poll không ghi đè currentTime
  const scrubDraftRef = useRef(0);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Danh sách video (tải 1 lần)
  useEffect(() => {
    let cancelled = false;
    fetch(`${DATA_BASE}/data/podcast/danh-sach.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { playlists?: Playlist[] }) => { if (!cancelled) setPlaylists(Array.isArray(d?.playlists) ? d.playlists : []); })
      .catch(() => { if (!cancelled) setListError('Không tải được danh sách phát.'); })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Đổi màn theo hash: #<youtubeId> = xem video, không hash = danh sách
  useEffect(() => {
    const onHash = () => {
      const o = hashId(); const p = hashPl();
      // Màn video PHỦ LÊN TRÊN màn đang đứng (trang chính / danh sách phát vẫn nằm nguyên bên dưới, không đổi vị trí cuộn) -> bấm "<" chỉ việc gỡ lớp phủ,
      // không phải dựng lại + cuộn lại màn dưới (user 24/11: trở về chưa mượt).
      if (o) { pendingScroll.current = null; setOpenId(o); return; }
      const veLaiManDuoi = prevView.current === 'video' && plIdRef.current === p;
      // vị trí cuộn cần đặt SAU khi màn mới đã vẽ (useLayoutEffect bên dưới): vào màn mới = đầu trang; quay về màn cũ = đúng chỗ đã đứng
      pendingScroll.current = veLaiManDuoi ? null : p ? (prevView.current === 'video' ? scrollMem.current.pl : 0) : scrollMem.current.list;
      setOpenId(null); setPlId(p);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const destroyPlayer = useCallback(() => {
    stopPolling();
    try { playerRef.current?.destroy?.(); } catch { /* player đã gỡ khỏi DOM */ }
    playerRef.current = null;
  }, [stopPolling]);

  // Mở / đóng video theo openId: tải các câu của video (public/data/podcast/<id>.json)
  useEffect(() => {
    destroyPlayer();
    setIsPlaying(false);
    ghiGio(khoGio, 0);
    setDuration(0);
    setScrubDraft(null);
    setControlsVisible(true);
    setLoopIdx(null);
    if (!openId) {
      setStage('list');
      setSegments([]);
      return undefined;
    }
    let cancelled = false;
    setStage('loading');
    fetch(`${DATA_BASE}/data/podcast/${openId}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Segment[]) => {
        if (cancelled) return;
        if (!Array.isArray(d) || d.length === 0) throw new Error('rỗng');
        setSegments(d);
        setActiveIndex(0);
        setStage('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMessage('Video này chưa có phụ đề.');
        setStage('error');
      });
    return () => { cancelled = true; };
  }, [openId, destroyPlayer]);

  const videosWithEntry = useMemo(
    () => videos.map((video) => ({ video, entry: getPodcastEntry(progress, video.youtube) })),
    [videos, progress],
  );
  // Đang xem dở (đã mở, chưa tới câu cuối) - mới nhất lên đầu
  const continueWatching = useMemo(() => videosWithEntry
    .filter(({ entry }) => !!entry.lastWatchedAt && !entry.completed)
    .sort((a, b) => (b.entry.lastWatchedAt || 0) - (a.entry.lastWatchedAt || 0)), [videosWithEntry]); // không giới hạn số lượng: trang "Tiếp tục xem" chia trang 20 video như các danh sách khác
  const savedVideos = useMemo(() => videosWithEntry.filter(({ entry }) => entry.saved).map(({ video }) => video), [videosWithEntry]);
  const tongTap = playlists.reduce((n, pl) => n + pl.videos.length, 0);

  const fromList = useRef(false); // đã đi từ màn trước (danh sách / danh sách phát) sang màn này (để "<" quay về TRANG TRƯỚC bằng lịch sử)
  const openVideo = (ytId: string) => {
    scrollMem.current.pl = window.scrollY; fromList.current = true; navigate(HREF.podcastVideo(ytId));
  };
  const goPl = (id: string) => { scrollMem.current.list = window.scrollY; fromList.current = true; navigate(HREF.podcastPlaylist(id)); };
  // Mở thẳng bằng đường dẫn (không qua danh sách) thì "<" thay mục lịch sử hiện tại bằng màn danh sách (không thêm mục, tránh vòng lặp Quay lại).
  const veDanhSach = () => navigate(HREF.podcast, true);
  // "<" ở trang danh sách phát: về trang trước (đúng trang vừa ở); mở thẳng bằng đường dẫn thì về danh sách video
  const backFromPl = () => { if (fromList.current) window.history.back(); else veDanhSach(); };
  const backFromVideo = () => { if (fromList.current) window.history.back(); else veDanhSach(); };

  const handleToggleSaved = (e: React.MouseEvent, ytId: string) => {
    e.stopPropagation(); // không mở video
    setProgress((prev) => {
      const next = withToggleSaved(prev, ytId);
      savePodcastProgress(next);
      return next;
    });
  };

  const toggleDisplayPref = (key: keyof PodcastDisplayPrefs) => {
    setDisplayPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveDisplayPrefs(next);
      return next;
    });
  };

  // Khởi tạo YT.Player khi vào stage 'ready'
  useEffect(() => {
    if (stage !== 'ready' || !openId) return undefined;
    let cancelled = false;
    loadYoutubeIframeApi().then(() => {
      if (cancelled || !playerContainerRef.current) return;
      const YT = (window as any).YT;
      playerRef.current = new YT.Player(playerContainerRef.current, {
        videoId: openId,
        playerVars: {
          autoplay: 0, rel: 0, modestbranding: 1,
          controls: 0, // ẩn thanh điều khiển gốc - dùng thanh tự làm bên dưới
          disablekb: 1, fs: 0, iv_load_policy: 3,
          playsinline: 1, // iPhone: phát ngay trong trang
        },
        events: {
          onReady: (e: any) => {
            const player = e.target;
            setDuration(player.getDuration?.() || 0);
            player.setVolume?.(100);
            player.unMute?.();
            setVolume(100);
            setIsMuted(false);
            pollRef.current = window.setInterval(() => {
              const p = playerRef.current;
              if (!p?.getCurrentTime) return;
              const t = p.getCurrentTime();
              if (!scrubbingRef.current) ghiGio(khoGio, t);
              const d = p.getDuration?.();
              if (d) setDuration((prev) => (prev !== d ? d : prev));
              const segs = segmentsRef.current;
              const active = activeIndexRef.current;
              const current = segs[active];
              if (current && t >= current.start - 0.05 && t < current.end) {
                if (loopIdxRef.current === active && t >= current.end - LOOP_EPSILON) p.seekTo(current.start, true);
                return;
              }
              // Lặp câu mà đã trôi qua khỏi câu (khoảng lặng giữa 2 câu) -> quay lại đầu câu
              if (current && loopIdxRef.current === active && t >= current.end && t < current.end + 1.5) {
                p.seekTo(current.start, true);
                return;
              }
              const found = segs.findIndex((s) => t >= s.start && t < s.end);
              if (found !== -1 && found !== active) setActiveIndex(found);
            }, POLL_MS);
          },
          onStateChange: (e: any) => setIsPlaying(e.data === 1),
        },
      });
    });
    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [stage, openId, destroyPlayer]);

  // Tự cuộn câu đang phát vào khung (neo ~38% từ trên xuống)
  useEffect(() => {
    if (!displayPrefs.autoScroll) return;
    if (Date.now() < vuotDen.current) return; // người dùng đang vuốt (cảm ứng)
    const container = subtitleListRef.current;
    const el = lineRefs.current[activeIndex];
    if (!container || !el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const offset = eRect.top - cRect.top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, offset - container.clientHeight * 0.38 + el.clientHeight / 2), behavior: 'smooth' });
  }, [activeIndex, displayPrefs.autoScroll, stage]);

  // Ghi nhận "đã xem" mỗi khi câu đang phát đổi
  useEffect(() => {
    if (stage !== 'ready' || !openId || segments.length === 0) return;
    setProgress((prev) => {
      const next = withProgress(prev, openId, activeIndex, segments.length);
      savePodcastProgress(next);
      return next;
    });
  }, [stage, openId, activeIndex, segments.length]);

  const handleLineClick = (index: number) => {
    const seg = segments[index];
    if (!seg || !playerRef.current) return;
    if (loopIdxRef.current !== null && loopIdxRef.current !== index) setLoopIdx(null); // bấm sang câu khác thì thôi lặp
    setActiveIndex(index);
    playerRef.current.seekTo(seg.start, true);
    playerRef.current.playVideo?.();
  };

  // Biểu tượng lặp của từng câu: bật = phát lại đúng câu đó liên tục; bấm lần nữa (hoặc bấm câu khác) = tắt.
  const toggleLoop = (index: number) => {
    if (loopIdxRef.current === index) { setLoopIdx(null); return; }
    handleLineClick(index);
    setLoopIdx(index);
  };

  // Hàm ỔN ĐỊNH cho DongPhuDe (memo): luôn gọi bản mới nhất qua ref.
  const handleLineClickRef = useRef(handleLineClick);
  handleLineClickRef.current = handleLineClick;
  const toggleLoopRef = useRef(toggleLoop);
  toggleLoopRef.current = toggleLoop;
  const onPickLine = useCallback((i: number) => handleLineClickRef.current(i), []);
  const onLoopLine = useCallback((i: number) => toggleLoopRef.current(i), []);
  const setLineRef = useCallback((i: number, el: HTMLElement | null) => { lineRefs.current[i] = el as unknown as HTMLButtonElement | null; }, []);
  // Ngón tay đang vuốt danh sách (hoặc vừa nhả < 3,5s: quán tính) -> KHÔNG tự cuộn, tránh giành cuộn với tay (chỉ có trên màn cảm ứng; máy tính dùng chuột không bị ảnh hưởng).
  const vuotDen = useRef(0);
  const batDauVuot = () => { vuotDen.current = Infinity; };
  const ketThucVuot = () => { vuotDen.current = Date.now() + 3500; };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    playerRef.current?.setPlaybackRate?.(rate);
  };

  // Hiện lại thanh điều khiển + hẹn ẩn (chỉ khi đang phát)
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
    if (isPlaying) hideControlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
      return undefined;
    }
    hideControlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  const handleTogglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isPlaying) player.pauseVideo?.();
    else player.playVideo?.();
  };

  // Kéo thanh tua chỉ đổi hiển thị; nhả tay mới seekTo (lắng nghe trên window)
  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    scrubbingRef.current = true;
    scrubDraftRef.current = v;
    setScrubDraft(v);
    showControlsTemporarily();
  };
  useEffect(() => {
    const commitSeek = () => {
      if (!scrubbingRef.current) return;
      scrubbingRef.current = false;
      playerRef.current?.seekTo?.(scrubDraftRef.current, true);
      ghiGio(khoGio, scrubDraftRef.current);
      setScrubDraft(null);
    };
    window.addEventListener('mouseup', commitSeek);
    window.addEventListener('touchend', commitSeek);
    return () => {
      window.removeEventListener('mouseup', commitSeek);
      window.removeEventListener('touchend', commitSeek);
    };
  }, []);

  const handleToggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted || volume === 0) {
      player.unMute?.();
      const restored = volume > 0 ? volume : 50;
      player.setVolume?.(restored);
      setVolume(restored);
      setIsMuted(false);
    } else {
      player.mute?.();
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume?.(v);
    if (v === 0) { playerRef.current?.mute?.(); setIsMuted(true); }
    else { playerRef.current?.unMute?.(); setIsMuted(false); }
  };

  // Thẻ 1 tập: video thật (ảnh YouTube, ♡ lưu, tiến độ) hoặc VIDEO GIẢ làm mẫu (ảnh bìa tự vẽ, nhãn "Sắp có", không mở được).
  // Điện thoại: hàng vuốt ngang (thẻ ~68% bề ngang); máy tính: lưới 3-4 cột.
  const theVideo = (v: PodcastVideo, mau: string, key: string, fill = false) => {
    const cardCls = `relative ${fill ? 'w-full' : 'shrink-0 w-[68vw] max-w-[260px] sm:w-60 md:w-auto md:max-w-none snap-start'} text-left rounded-2xl bg-white border border-[#D3E4FC] p-2.5 flex flex-col gap-2`;
    const ten = (
      <div className="min-w-0 flex flex-col gap-1 px-0.5 pb-0.5">
        <span className="text-sm font-bold text-[#1A2A54] leading-snug line-clamp-2 min-h-[2.5rem] pt-0.5">{v.title}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5B6B85] min-w-0">
          {v.capDo && <CapNhan cap={v.capDo} />}
          <span className="truncate">{v.gia ? 'Tập mẫu - sắp có' : v.kenh}</span>
        </span>
      </div>
    );
    if (v.gia || !v.youtube) {
      return (
        <div key={key} className={`${cardCls} select-none`} aria-label={`${v.title} (sắp có)`}>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden">
            <BiaGia chu={v.chu} mau={mau} />
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/50 text-white text-[9px] font-black uppercase tracking-wide leading-none">Sắp có</span>
            {v.duration && <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold tabular-nums leading-none">{v.duration}</span>}
          </div>
          {ten}
        </div>
      );
    }
    const yt = v.youtube;
    const entry = getPodcastEntry(progress, yt);
    const pct = entry.totalSegments ? (((entry.lastSegmentIndex ?? 0) + 1) / entry.totalSegments) * 100 : 0;
    return (
      <div
        key={key}
        role="button"
        tabIndex={0}
        onClick={() => openVideo(yt)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVideo(yt); } }}
        className={`${cardCls} cursor-pointer outline-none hover:border-[#2F7DF6] hover:shadow-md transition-all group`}
      >
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#D3E4FC]">
          <img src={anhSan(yt)} onError={(e) => anhLui(e, yt)} onLoad={(e) => anhKiem(e, yt)} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/15 transition-all">
            <PlayCircle className="w-9 h-9 text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
          </span>
          <button
            type="button"
            onClick={(e) => handleToggleSaved(e, yt)}
            aria-label={entry.saved ? 'Bỏ lưu video này' : 'Lưu video này'}
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 hover:bg-black/70 flex items-center justify-center transition-all"
          >
            <Heart className={`w-4 h-4 ${entry.saved ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
          </button>
          {(entry.completed || pct > 0) && (
            <span className="absolute left-0 right-0 bottom-0 h-1 bg-white/60"><span className="block h-full bg-[#EF4444]" style={{ width: `${entry.completed ? 100 : pct}%` }} /></span>
          )}
          {entry.completed && <span className="absolute bottom-2.5 left-1.5 w-5 h-5 rounded-full bg-emerald-600 ring-2 ring-white flex items-center justify-center"><Check className="w-3 h-3 text-white" strokeWidth={3} /></span>}
          {v.duration && <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-bold tabular-nums leading-none">{v.duration}</span>}
        </div>
        {ten}
      </div>
    );
  };

  // THẺ DANH SÁCH PHÁT ở trang chính: bìa ghép 3 ảnh video (tông màu của danh sách) + tên + mô tả + số video; bấm -> trang của danh sách (#ds/<id>).
  // Bìa 3 ảnh xếp chồng của một danh sách (dùng cho thẻ danh sách phát và thẻ "Đã lưu" dài). cls = bề rộng khung.
  const biaXepChong = (ds: PodcastVideo[], mau: string, cls: string) => {
    const anh = ds.filter((v) => v.youtube && !v.gia).slice(0, 3);
    // 1 video: hình ở GIỮA; 2 video: hai hình đối xứng, cách đều hai mép; 3 video trở lên: ba hình xếp chồng như cũ. (ảnh rộng 52% -> căn giữa = left 24%, top 24%)
    const pos = anh.length === 1
      ? [{ left: 24, top: 24, rot: 0, z: 1 }]
      : anh.length === 2
        ? [{ left: 6, top: 24, rot: -5, z: 1 }, { left: 42, top: 24, rot: 5, z: 2 }]
        : [{ left: 4, top: 20, rot: -7, z: 1 }, { left: 24, top: 6, rot: 1, z: 3 }, { left: 44, top: 22, rot: 8, z: 2 }];
    return (
      <span
        className={`relative block aspect-video rounded-xl overflow-hidden ${cls}`}
        style={{ background: `linear-gradient(135deg, ${mau}18 0%, ${mau}40 100%)` }}
      >
        {anh.length === 0 && <ListVideo className="absolute inset-0 m-auto w-10 h-10" style={{ color: mau }} />}
        {anh.map((v, i) => (
          <img
            key={v.youtube}
            src={`https://img.youtube.com/vi/${v.youtube}/mqdefault.jpg`}
            alt=""
            className="absolute rounded-lg border-[3px] border-white shadow-md object-cover bg-[#D3E4FC] transition-transform group-hover:scale-[1.03]"
            style={{ width: '52%', aspectRatio: '16 / 9', left: `${pos[i].left}%`, top: `${pos[i].top}%`, transform: `rotate(${pos[i].rot}deg)`, zIndex: pos[i].z }}
          />
        ))}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[11px] font-black text-white tabular-nums leading-snug" style={{ background: mau }}>{ds.length} video</span>
      </span>
    );
  };

  const theDanhSach = (id: string, ten: string, moTa: string | undefined, mau: string, ds: PodcastVideo[]) => {
    const caps = capCoTrong(ds);
    return (
      <button
        key={id}
        type="button"
        onClick={() => goPl(id)}
        aria-label={`Mở danh sách phát ${ten}`}
        className="text-left rounded-2xl bg-white border border-[#D3E4FC] p-2.5 flex flex-col gap-3 cursor-pointer outline-none hover:border-[#2F7DF6] hover:shadow-md transition-all group"
      >
        {biaXepChong(ds, mau, 'w-full')}
        <span className="min-w-0 flex flex-col gap-1 px-1 pb-1">
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" className="w-1 h-5 rounded-full shrink-0" style={{ background: mau }} />
            <span className="text-base sm:text-lg font-black text-[#1A2A54] pt-0.5" style={{ lineHeight: 1.45 }}>{ten}</span>
          </span>
          {moTa && <span className="text-xs sm:text-[13px] font-medium text-[#5B6B85] leading-snug line-clamp-2">{moTa}</span>}
          {caps.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{caps.map((c) => <CapNhan key={c} cap={c} className="px-1.5 py-0.5 text-[11px]" />)}</span>}
        </span>
      </button>
    );
  };

  // THẺ "TIẾP TỤC XEM" (khác hẳn thẻ danh sách phát): rộng hết hàng, ảnh LỚN của video xem gần nhất + thanh tiến độ đỏ + nút "Tiếp tục"; bấm "Xem tất cả" mới sang trang danh sách.
  const theTiepTuc = () => {
    const v = continueWatching[0]?.video;
    if (!v) return null;
    const entry = getPodcastEntry(progress, v.youtube);
    const tong = entry.totalSegments || 0;
    const da = Math.min(tong, (entry.lastSegmentIndex ?? 0) + 1);
    const pct = tong ? (da / tong) * 100 : 0;
    return (
      <div key="tiep-tuc" className="rounded-2xl border border-[#BFD7FB] bg-gradient-to-r from-[#E3EEFF] via-[#F0F6FF] to-white p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-5 items-stretch">
        <button
          type="button"
          onClick={() => openVideo(v.youtube)}
          aria-label={`Tiếp tục xem ${v.title}`}
          className="relative w-full sm:w-72 lg:w-80 shrink-0 aspect-video rounded-xl overflow-hidden bg-[#D3E4FC] group outline-none"
        >
          <img src={anhSan(v.youtube)} onError={(e) => anhLui(e, v.youtube)} onLoad={(e) => anhKiem(e, v.youtube)} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-all">
            <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" strokeWidth={1.75} />
          </span>
          {pct > 0 && <span className="absolute left-0 right-0 bottom-0 h-1 bg-white/60"><span className="block h-full bg-[#EF4444]" style={{ width: `${pct}%` }} /></span>}
        </button>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
          <span className="text-base sm:text-lg font-black text-[#1A2A54] line-clamp-2 pt-0.5" style={{ lineHeight: 1.4 }}>{v.title}</span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#5B6B85] min-w-0">
            {v.capDo && <CapNhan cap={v.capDo} />}
            <span className="truncate">{v.kenh}</span>
          </span>
          {tong > 0 && <span className="text-xs font-bold text-[#8B9BB8] tabular-nums">Đã nghe {da}/{tong} câu</span>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openVideo(v.youtube)} className="px-4 py-2 rounded-full bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-xs font-black shadow-sm transition-all active:scale-95">Tiếp tục</button>
            <button type="button" onClick={() => goPl('tiep-tuc')} className="px-3.5 py-2 rounded-full bg-white border border-[#D3E4FC] hover:border-[#93C5FD] text-[#5B6B85] text-xs font-bold transition-all">Xem tất cả {continueWatching.length} video</button>
          </div>
        </div>
      </div>
    );
  };

  // Trang xem TRỌN một danh sách phát (#ds/<id>); 'tiep-tuc' / 'da-luu' là hai hàng đặc biệt
  const plView: { ten: string; moTa?: string; mau: string; videos: PodcastVideo[] } | null = plId === 'tiep-tuc'
    ? { ten: 'Tiếp tục xem', moTa: 'Những video bạn đang xem dở.', mau: '#2F7DF6', videos: continueWatching.map(({ video }) => video) }
    : plId === 'da-luu'
      ? { ten: 'Đã lưu', moTa: 'Những video bạn đã bấm ♡ để lưu.', mau: '#F43F5E', videos: savedVideos }
      : (() => { const p = playlists.find((x) => x.id === plId); return p ? { ten: p.ten, moTa: p.moTa, mau: p.mau || '#2F7DF6', videos: p.videos } : null; })();
  // Đổi sang danh sách KHÁC thì về trang 1 + bỏ lọc; đi xem video rồi quay lại cùng danh sách thì GIỮ nguyên trang + bộ lọc.
  useEffect(() => {
    if (plId && plId !== lastPl.current) { setCapLoc(''); setTrang(1); }
    setHoiXoa(false); // đổi trang/danh sách thì bỏ câu hỏi xác nhận xóa đang mở
    if (plId) lastPl.current = plId;
    else if (!openId) lastPl.current = null; // về màn danh sách chính: lần sau mở lại thì bắt đầu từ đầu
  }, [plId, openId]);
  // Nút xóa ở thẻ giới thiệu: "Tiếp tục xem" -> xóa lịch sử xem (giữ video đã lưu); "Đã lưu" -> bỏ lưu tất cả (giữ lịch sử xem).
  const xoaLichSu = () => {
    setProgress((prev) => { const next = plId === 'da-luu' ? withClearedSaved(prev) : withClearedHistory(prev); savePodcastProgress(next); return next; });
    setHoiXoa(false);
  };
  const chonCap = (c: string) => { setCapLoc(c); setTrang(1); };
  const doiTrang = (n: number) => {
    setTrang(n);
    // Nhảy NGAY (không trượt) để dòng "Tất cả video" nằm sát dưới thanh trên cùng; không cuộn lên tận thẻ giới thiệu.
    const el = dauLuoiRef.current;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'instant' as ScrollBehavior });
  };
  const capDem: Record<string, number> = {};
  (plView?.videos || []).forEach((v) => { if (v.capDo) capDem[v.capDo] = (capDem[v.capDo] || 0) + 1; });
  const capCo = CAP_THU_TU.filter((c) => capDem[c]);
  const dsLoc = plView ? (capLoc ? plView.videos.filter((v) => v.capDo === capLoc) : plView.videos) : [];
  const tongTrang = Math.max(1, Math.ceil(dsLoc.length / VIDEO_MOI_TRANG));
  const trangHT = Math.min(trang, tongTrang);
  const dsTrang = dsLoc.slice((trangHT - 1) * VIDEO_MOI_TRANG, trangHT * VIDEO_MOI_TRANG);
  useEffect(() => {
    if (playlists.length === 0) return undefined;
    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) playlists.forEach((pl) => { const v = pl.videos[i]; if (v && v.youtube && !v.gia) ids.push(v.youtube); });
    const t = window.setTimeout(() => taiTruocAnh(ids), 250); // chờ trang chính vẽ xong rồi mới tải nền
    return () => window.clearTimeout(t);
  }, [playlists]);
  // 2) mở danh sách phát: ảnh của trang đang xem + 1 trang sau (đổi trang / đổi bộ lọc thì tải tiếp)
  const khoaAnh = plView ? `${plId}|${capLoc}|${trangHT}|${dsLoc.length}` : '';
  useEffect(() => {
    if (!khoaAnh) return;
    taiTruocAnh(dsLoc.slice((trangHT - 1) * VIDEO_MOI_TRANG, (trangHT + 1) * VIDEO_MOI_TRANG).filter((v) => v.youtube && !v.gia).map((v) => v.youtube));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaAnh]);
  // Màn xem video = ĐÚNG 1 TRANG như các trang chơi game: khoá cuộn/vuốt nền (chỉ danh sách phụ đề tự cuộn bên trong).
  useEffect(() => {
    if (!openId) return undefined;
    const h = document.documentElement; const b = document.body;
    const truoc = { ho: h.style.overflow, bo: b.style.overflow, hb: h.style.overscrollBehavior, bb: b.style.overscrollBehavior };
    h.style.overflow = 'hidden'; b.style.overflow = 'hidden'; h.style.overscrollBehavior = 'none'; b.style.overscrollBehavior = 'none';
    return () => { h.style.overflow = truoc.ho; b.style.overflow = truoc.bo; h.style.overscrollBehavior = truoc.hb; b.style.overscrollBehavior = truoc.bb; };
  }, [openId]);
  // Cỡ khung video (máy tính, >=1024px): rộng tối đa 90% cột, và THU NHỎ khi thẻ "câu đang phát" cao lên (luôn 16:9). Tiêu đề + thẻ nằm NGAY dưới video, chỗ trống dồn xuống đáy.
  const cotTraiRef = useRef<HTMLDivElement | null>(null);
  const tieuDeRef = useRef<HTMLDivElement | null>(null);
  const theCauRef = useRef<HTMLDivElement | null>(null);
  const [rongVideo, setRongVideo] = useState<number | null>(null);
  useEffect(() => {
    if (stage !== 'ready' || !openId) return undefined;
    const tinh = () => {
      const col = cotTraiRef.current;
      if (!col || window.innerWidth < 1024) { setRongVideo(null); return; }
      const cs = window.getComputedStyle(col);
      const W = col.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const H = col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap) || 0;
      const cao = (el: HTMLElement | null) => (el && el.offsetParent !== null ? el.offsetHeight + gap : 0);
      const conLai = H - cao(tieuDeRef.current) - cao(theCauRef.current) - gap; // trừ thêm 1 khoảng cách giữa video và phần dưới
      const w = Math.max(200, Math.min(W * 0.9, (conLai * 16) / 9));
      setRongVideo((prev) => (prev !== null && Math.abs(prev - w) < 1 ? prev : Math.floor(w)));
    };
    tinh();
    const ro = new ResizeObserver(tinh);
    [cotTraiRef.current, tieuDeRef.current, theCauRef.current].forEach((el) => { if (el) ro.observe(el); });
    window.addEventListener('resize', tinh);
    return () => { ro.disconnect(); window.removeEventListener('resize', tinh); };
  }, [stage, openId, activeIndex, displayPrefs.showFurigana, displayPrefs.showVi]);
  const openVideoInfo = videos.find((v) => v.youtube === openId) || null;
  const chip = (on: boolean, tone: 'blue' | 'green' = 'blue') => `flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
    on ? (tone === 'green' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-[#E3EEFF] border-[#2F7DF6] text-[#2F7DF6]') : 'bg-white border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD]'
  }`;

  // Cụm nút Furigana / Dịch / Tự cuộn / Lưu: máy tính ở đầu khung phụ đề; điện thoại ở trong thẻ video, ngay dưới video (user 24/11).
  const nutCongCu = (
    <>
          <button type="button" onClick={() => toggleDisplayPref('showFurigana')} className={chip(displayPrefs.showFurigana)}><Type className="w-3.5 h-3.5" />Furigana</button>
          <button type="button" onClick={() => toggleDisplayPref('showVi')} className={chip(displayPrefs.showVi, 'green')}><Languages className="w-3.5 h-3.5" />Dịch</button>
          <button type="button" onClick={() => toggleDisplayPref('autoScroll')} className={chip(displayPrefs.autoScroll)}><Crosshair className="w-3.5 h-3.5" />Tự cuộn</button>
          {/* Lưu video đang xem (cùng kho với nút ♡ ở thẻ video / danh sách "Đã lưu") */}
          <button
            type="button"
            onClick={(e) => openId && handleToggleSaved(e, openId)}
            aria-pressed={!!(openId && progress[openId]?.saved)}
            className={`${chip(false)} ${!!(openId && progress[openId]?.saved) ? '!bg-rose-50 !border-rose-300 !text-rose-600' : ''}`}
          ><Heart className={`w-3.5 h-3.5 ${!!(openId && progress[openId]?.saved) ? 'fill-rose-500 text-rose-500' : ''}`} />Lưu</button>
    </>
  );

  return (
    <div className="min-h-dvh bg-[#F0F6FF] relative overflow-x-hidden no-scrollbar">
      {/* Thanh công cụ: danh sách chính = SiteNav (tab Sách kaiwa / Nghe chính tả / Video shadowing + thanh tab dưới trên điện thoại).
          Màn xem video / trang danh sách phát: chỉ GIỮ thanh trên (nút "<" về màn trước + logo), ẨN các nút chuyển trang (menu giữa trên máy tính,
          thanh tab đáy trên điện thoại) - như KanjiNav hideTopMenu + hideMobileTabs bên web Phá Đảo. */}
      {openId || plId
        ? <PodcastTopBar onBack={openId ? backFromVideo : backFromPl} />
        : <SiteNav active="podcast" />}

      {/* ===== MÀN DANH SÁCH: phần giới thiệu (hình minh hoạ + tiêu đề) -> Tiếp tục xem / Đã lưu -> các DANH SÁCH PHÁT ===== */}
      {/* Màn chính KHÔNG bị gỡ khỏi trang khi sang danh sách phát / video, chỉ ẩn (hidden): bấm "<" quay về là hiện lại NGAY, không dựng lại thẻ và ảnh bìa nên không chớp/giật. */}
      {(
        <main className={`pt-16 pb-32 lg:pb-16 ${plId ? 'hidden' : ''}`}>
          <section className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-10 pt-6 sm:pt-10">{/* máy tính: chừa lề rộng 2 bên, không sát mép màn hình (user 23/11) */}
            {/* Giới thiệu */}
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-white via-[#F5F9FF] to-[#DCEAFE] border border-[#D3E4FC] text-[#1A2A54] px-5 sm:px-10 pt-6 pb-7 sm:py-9 flex flex-col-reverse lg:flex-row items-center gap-3 lg:gap-8 shadow-sm">{/* tông SÁNG, không xanh đặc (user 23/11: chói) */}
              <span aria-hidden="true" className="absolute -left-16 -top-20 w-64 h-64 rounded-full bg-[#2F7DF6]/[0.04]" />
              <span aria-hidden="true" className="absolute -right-10 -bottom-24 w-72 h-72 rounded-full bg-[#2F7DF6]/[0.06]" />
              <div className="relative z-10 flex-1 min-w-0 text-center lg:text-left">
                <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E3EEFF] text-[#2F7DF6] text-xs font-bold">
                  <Headphones className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Luyện nghe – nói theo người bản xứ
                </span>
                <h1 className="mt-0 lg:mt-3 text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-tight">Shadowing</h1>
                {/* Điện thoại/iPad (dưới lg): bỏ nhãn "Luyện nghe – nói theo người bản xứ", câu đó thành MÔ TẢ dưới tiêu đề; máy tính giữ nguyên nhãn + mô tả cũ */}
                <p className="mt-2 text-sm sm:text-base font-semibold text-[#5B6B85] max-w-md mx-auto lg:mx-0">
                  <span className="lg:hidden">Luyện nghe – nói theo người bản xứ</span>
                  <span className="hidden lg:inline">Nghe và nói theo từng câu, có furigana và dịch tiếng Việt.</span>
                </p>
                {playlists.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2 justify-center lg:justify-start">
                    <span className="px-3 py-1.5 rounded-full bg-[#2F7DF6] text-white text-xs font-black">{tongTap} video</span>
                    <span className="px-3 py-1.5 rounded-full bg-white border border-[#D3E4FC] text-[#5B6B85] text-xs font-bold">N5-N1</span>
                  </div>
                )}
              </div>
              <HinhGioiThieu className="relative z-10 w-60 sm:w-72 lg:w-[380px] shrink-0" />
            </div>

            {listLoading && (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 className="w-9 h-9 text-[#2F7DF6] animate-spin" />
                <span className="text-sm font-bold text-[#5B6B85]">Đang tải danh sách phát...</span>
              </div>
            )}
            {!listLoading && listError && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center"><AlertTriangle className="w-7 h-7" /></div>
                <p className="text-sm font-semibold text-[#5B6B85] max-w-sm">{listError}</p>
              </div>
            )}
            {!listLoading && !listError && playlists.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="w-14 h-14 bg-[#E3EEFF] text-[#2F7DF6] rounded-2xl flex items-center justify-center"><ListVideo className="w-7 h-7" /></div>
                <p className="text-sm font-semibold text-[#5B6B85] max-w-sm">Chưa có danh sách phát nào.</p>
              </div>
            )}

            {!listLoading && playlists.length > 0 && (
              <div className="mt-8 sm:mt-10 flex flex-col gap-8 sm:gap-10">
                {/* TIẾP TỤC XEM: chỉ hiện khi có video xem dở; tiêu đề đặt ngay trên nền trang */}
                {continueWatching.length > 0 && (
                  <section aria-labelledby="muc-tiep-tuc">
                    <div className="flex items-center gap-2 mb-3">
                      <span aria-hidden="true" className="w-1.5 h-6 rounded-full shrink-0 bg-[#2F7DF6]" />
                      <h2 id="muc-tiep-tuc" className="text-lg sm:text-xl font-black text-[#1A2A54] pt-1" style={{ lineHeight: 1.45 }}>Tiếp tục xem</h2>
                    </div>
                    {theTiepTuc()}
                  </section>
                )}
                {/* DANH SÁCH PHÁT (kèm thẻ "Đã lưu" khi có) */}
                <section aria-labelledby="muc-danh-sach-phat">
                  <div className="flex items-center gap-2 mb-3">
                    <span aria-hidden="true" className="w-1.5 h-6 rounded-full shrink-0 bg-[#2F7DF6]" />
                    <h2 id="muc-danh-sach-phat" className="text-lg sm:text-xl font-black text-[#1A2A54] pt-1" style={{ lineHeight: 1.45 }}>Danh sách phát</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {savedVideos.length > 0 && theDanhSach('da-luu', 'Đã lưu', 'Những video bạn đã bấm ♡ để lưu.', '#F43F5E', savedVideos)}
                    {playlists.map((p) => theDanhSach(p.id, p.ten, p.moTa, p.mau || '#2F7DF6', p.videos))}
                  </div>
                </section>
              </div>
            )}
          </section>
        </main>
      )}

      {/* ===== MÀN MỘT DANH SÁCH PHÁT: xem trọn mọi video của danh sách ===== */}
      {plId && (
        <main className="pt-16 pb-24 lg:pb-12">
          <section className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-10 pt-6 sm:pt-10">
            {listLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <Loader2 className="w-9 h-9 text-[#2F7DF6] animate-spin" />
                <span className="text-sm font-bold text-[#5B6B85]">Đang tải danh sách phát...</span>
              </div>
            ) : !plView ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center"><AlertTriangle className="w-7 h-7" /></div>
                <p className="text-sm font-semibold text-[#5B6B85] max-w-sm">Không tìm thấy danh sách phát này.</p>
                <button type="button" onClick={veDanhSach} className="px-5 py-2.5 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95">Về danh sách shadowing</button>
              </div>
            ) : (
              <>
                {/* THẺ GIỚI THIỆU danh sách phát (cùng kiểu thẻ đầu trang chính, tông màu theo danh sách) */}
                {(() => {
                  const mau = plView.mau;
                  const anh = plView.videos.filter((v) => v.youtube && !v.gia).slice(0, 3);
                  const caps = capCoTrong(plView.videos);
                  // 1 video: hình giữa; 2 video: hai hình đối xứng cách đều hai mép; 3 video trở lên: xếp chồng như cũ (khung 324x140, ảnh rộng 168)
                  const pos = anh.length === 1
                    ? [{ left: 78, top: 23, rot: 0, z: 1 }]
                    : anh.length === 2
                      ? [{ left: 10, top: 23, rot: -5, z: 1 }, { left: 146, top: 23, rot: 5, z: 2 }]
                      : [
                        { left: 0, top: 30, rot: -7, z: 1 },
                        { left: 78, top: 0, rot: 1, z: 3 },
                        { left: 156, top: 34, rot: 8, z: 2 },
                      ];
                  return (
                    <div
                      className="relative overflow-hidden rounded-[28px] border text-[#1A2A54] px-5 sm:px-10 py-6 sm:py-9 flex flex-col lg:flex-row items-start lg:items-center gap-5 lg:gap-8 shadow-sm"
                      style={{ background: `linear-gradient(135deg, #FFFFFF 0%, ${mau}12 55%, ${mau}30 100%)`, borderColor: `${mau}45` }}
                    >
                      <span aria-hidden="true" className="absolute -left-16 -top-20 w-64 h-64 rounded-full" style={{ background: `${mau}0D` }} />
                      <span aria-hidden="true" className="absolute -right-10 -bottom-24 w-72 h-72 rounded-full" style={{ background: `${mau}14` }} />
                      <div className="relative z-10 flex-1 min-w-0 text-left">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 text-xs font-bold" style={{ color: mau, border: `1px solid ${mau}40` }}>
                          <ListVideo className="w-3.5 h-3.5" strokeWidth={2.5} />
                          Danh sách phát
                        </span>
                        <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight pt-1" style={{ lineHeight: 1.4 }}>{plView.ten}</h1>
                        {plView.moTa && <p className="mt-2 text-sm sm:text-base font-semibold text-[#5B6B85] max-w-md">{plView.moTa}</p>}
                        <div className="mt-5 flex flex-wrap gap-2 justify-start">
                          <span className="px-3 py-1.5 rounded-full text-white text-xs font-black" style={{ background: mau }}>{plView.videos.length} video</span>
                          {caps.length > 0 && <span className="px-3 py-1.5 rounded-full bg-white border border-[#D3E4FC] text-[#5B6B85] text-xs font-bold">{caps.length === 1 ? caps[0] : `${caps[0]}-${caps[caps.length - 1]}`}</span>}
                        </div>
                        {((plId === 'tiep-tuc' && Object.values(progress).some((e) => e.lastWatchedAt)) || (plId === 'da-luu' && savedVideos.length > 0)) && (
                          <div className="mt-4 flex justify-start">
                            {!hoiXoa ? (
                              <button type="button" onClick={() => setHoiXoa(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-[#D3E4FC] hover:border-rose-300 hover:text-rose-600 text-[#5B6B85] text-xs font-bold transition-all">
                                <Trash2 className="w-3.5 h-3.5" />{plId === 'da-luu' ? 'Xóa danh sách đã lưu' : 'Xóa lịch sử xem'}
                              </button>
                            ) : (
                              <span className="inline-flex flex-wrap items-center justify-start gap-2 px-3.5 py-1.5 rounded-2xl bg-white border border-rose-200 text-xs font-bold text-[#1A2A54]">
                                {plId === 'da-luu' ? 'Bỏ lưu toàn bộ video đã lưu?' : 'Xóa toàn bộ lịch sử xem?'}
                                <button type="button" onClick={xoaLichSu} className="px-3 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-black transition-all">Xóa</button>
                                <button type="button" onClick={() => setHoiXoa(false)} className="px-3 py-1.5 rounded-full bg-[#F0F6FF] hover:bg-[#E3EEFF] text-[#5B6B85] font-bold transition-all">Hủy</button>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {anh.length > 0 && (
                        <div aria-hidden="true" className="relative z-10 hidden sm:block shrink-0" style={{ width: 156 + 168, height: 140 }}>
                          {anh.map((v, i) => (
                            <img
                              key={v.youtube}
                              src={`https://img.youtube.com/vi/${v.youtube}/mqdefault.jpg`}
                              alt=""
                              className="absolute rounded-xl border-4 border-white shadow-lg object-cover bg-[#D3E4FC]"
                              style={{ width: 168, height: 100, left: pos[i].left, top: pos[i].top, transform: `rotate(${pos[i].rot}deg)`, zIndex: pos[i].z }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div ref={dauLuoiRef} className="mt-8 mb-3 flex items-baseline gap-2.5">
                  <h2 className="text-lg sm:text-xl font-black text-[#1A2A54] pt-1" style={{ lineHeight: 1.45 }}>{capLoc ? `Video ${capLoc}` : 'Tất cả video'}</h2>
                  <span className="text-sm sm:text-base font-bold text-[#8B9BB8] tabular-nums pt-1" style={{ lineHeight: 1.45 }}>{dsLoc.length}</span>
                </div>
                {/* BỘ LỌC CẤP ĐỘ: bấm một cấp để lọc, bấm "Tất cả" (hoặc bấm lại cấp đang chọn) để bỏ lọc.
                    Điện thoại: MỘT DÒNG duy nhất (nút chia đều bề ngang, không bao giờ xuống dòng; màn quá hẹp thì cuộn ngang); từ sm (máy tính) giữ nguyên như cũ. */}
                {capCo.length > 1 && (
                  <div className="mb-4 flex items-center gap-1 sm:gap-2 flex-nowrap overflow-x-auto hide-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0" role="group" aria-label="Lọc theo cấp độ">
                    <button
                      type="button"
                      onClick={() => chonCap('')}
                      aria-pressed={capLoc === ''}
                      className={`flex items-center justify-center gap-1 sm:gap-1.5 flex-1 min-w-fit sm:flex-none px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${capLoc === '' ? 'bg-[#E3EEFF] border-[#2F7DF6] text-[#2F7DF6]' : 'bg-white border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD]'}`}
                    >Tất cả<span className="hidden sm:inline tabular-nums opacity-70">{plView.videos.length}</span></button>
                    {capCo.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => chonCap(capLoc === c ? '' : c)}
                        aria-pressed={capLoc === c}
                        className="flex items-center justify-center gap-1 sm:gap-1.5 flex-1 min-w-fit sm:flex-none px-1.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black border transition-all whitespace-nowrap shrink-0"
                        style={capLoc === c ? { background: capMau(c), borderColor: capMau(c), color: '#fff' } : { background: `${capMau(c)}14`, borderColor: `${capMau(c)}66`, color: capMau(c) }}
                      >{c}<span className="tabular-nums opacity-75">{capDem[c]}</span></button>
                    ))}
                  </div>
                )}
                {dsLoc.length === 0 ? (
                  <p className="py-12 text-center text-sm font-semibold text-[#5B6B85]">Chưa có video nào.</p>
                ) : (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4`}>
                    {dsTrang.map((v, i) => theVideo(v, plView.mau, `pl-${plId}-${v.youtube || i}`, true))}
                  </div>
                )}
                {tongTrang > 1 && (
                  <nav aria-label="Chuyển trang" className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                    <button type="button" onClick={() => doiTrang(trangHT - 1)} disabled={trangHT === 1} aria-label="Trang trước"
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#D3E4FC]">
                      <ChevronLeft className="w-4 h-4" strokeWidth={3} />
                    </button>
                    {dayTrang(trangHT, tongTrang).map((it, i) => it === '…'
                      ? <span key={`d${i}`} className="w-6 text-center text-sm font-bold text-[#8B9BB8]">…</span>
                      : (
                        <button key={it} type="button" onClick={() => doiTrang(it)} aria-label={`Trang ${it}`} aria-current={it === trangHT ? 'page' : undefined}
                          className={`min-w-9 h-9 px-2 rounded-full text-sm font-bold tabular-nums border transition-all ${it === trangHT ? 'bg-[#2F7DF6] border-[#2F7DF6] text-white' : 'bg-white border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD]'}`}>
                          {it}
                        </button>
                      ))}
                    <button type="button" onClick={() => doiTrang(trangHT + 1)} disabled={trangHT === tongTrang} aria-label="Trang sau"
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#D3E4FC]">
                      <ChevronRight className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </main>
      )}

      {/* ===== MÀN XEM 1 VIDEO ===== */}
      {openId && (
        // Màn xem video: cao đúng 1 màn hình, chừa thanh trên (h-16); điện thoại đã ẨN thanh tab đáy (hideMobileTabs) nên chỉ chừa vùng an toàn.
        <main className="fixed inset-0 z-30 bg-[#F0F6FF] pt-16 pb-[env(safe-area-inset-bottom)] lg:pb-0 flex flex-col overflow-hidden overscroll-none">{/* phủ lên màn dưới (nền đặc, dưới thanh trên z-40) */}
          {stage === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-9 h-9 text-[#2F7DF6] animate-spin" />
              <span className="text-sm font-bold text-[#5B6B85]">Đang tải phụ đề của video...</span>
            </div>
          )}
          {stage === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center"><AlertTriangle className="w-8 h-8" /></div>
              <p className="text-sm font-semibold text-[#5B6B85] max-w-sm">{errorMessage}</p>
              <button type="button" onClick={veDanhSach} className="px-5 py-2.5 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95">
                Về danh sách shadowing
              </button>
            </div>
          )}
          {stage === 'ready' && (
            <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto lg:px-6 lg:py-4 flex flex-col lg:flex-row overflow-hidden">
              {/* Vùng phát video */}
              {/* Cột trái (máy tính): KHÔNG cuộn, mọi phần tử nằm gọn trong trang. Câu phụ đề dài -> thẻ "câu đang phát" cao lên -> khung video THU NHỎ lại
                  (luôn đúng 16:9, không có dải đen): xem .pod-vid-box ở kaiwa/video/index.html. Điện thoại + iPad (<1024px): xếp dọc, KHÔNG có thẻ câu đang phát (user 24/11); máy tính: 2 cột + thẻ. */}
              <div ref={cotTraiRef} className="lg:w-[58%] shrink-0 flex flex-col p-3 sm:p-5 lg:py-0 gap-3 sm:gap-4 max-lg:!pb-[6px] max-lg:!gap-2.5 overflow-y-auto lg:overflow-hidden overscroll-contain hide-scrollbar">
                <NhacMoTrinhDuyet />
                <div className="shrink-0 w-full flex items-start justify-center">
                <div
                  className="pod-vid-box relative rounded-2xl overflow-hidden bg-black shadow-lg"
                  style={rongVideo ? { width: rongVideo } : undefined}
                  onMouseMove={showControlsTemporarily}
                  onTouchStart={showControlsTemporarily}
                >
                  {/* Khung nhúng thật - pointer-events-none khoá hẳn UI gốc của YouTube; mọi thao tác qua lớp phủ + thanh tự làm */}
                  <div ref={playerContainerRef} className="w-full h-full pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => { handleTogglePlay(); showControlsTemporarily(); }}
                    aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
                    className="absolute inset-0 z-10 flex items-center justify-center"
                  >
                    {!isPlaying && (
                      <span className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                      </span>
                    )}
                  </button>
                  {/* Thanh điều khiển tự làm: tua / phát-tạm dừng / tốc độ / âm lượng - tự ẩn khi đang phát */}
                  <div className={`absolute inset-x-0 bottom-0 z-20 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col gap-1.5 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <ThanhTua kho={khoGio} duration={duration} scrubDraft={scrubDraft} onChange={handleSeekInput} onStart={() => { scrubbingRef.current = true; showControlsTemporarily(); }} />
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={handleTogglePlay} aria-label={isPlaying ? 'Tạm dừng' : 'Phát'} className="text-white/90 hover:text-white transition-colors">
                        {isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
                      </button>
                      <NhanGio kho={khoGio} duration={duration} scrubDraft={scrubDraft} />
                      <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5 shrink-0">
                        {SPEEDS.map((rate) => (
                          <button
                            key={rate} type="button"
                            onClick={() => { handleSpeedChange(rate); showControlsTemporarily(); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${playbackRate === rate ? 'bg-white text-[#1E5FD9]' : 'text-white/70 hover:text-white'}`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                      <span className="flex-1" />
                      <button type="button" onClick={() => { handleToggleMute(); showControlsTemporarily(); }} aria-label={isMuted || volume === 0 ? 'Bật tiếng' : 'Tắt tiếng'} className="text-white/90 hover:text-white transition-colors shrink-0">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range" min={0} max={100} step={1}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { handleVolumeChange(e); showControlsTemporarily(); }}
                        className="player-range w-14 sm:w-20 shrink-0"
                        style={{ ['--fill' as any]: `${isMuted ? 0 : volume}%` }}
                        aria-label="Âm lượng"
                      />
                    </div>
                  </div>
                </div>
                </div>
                {/* Điện thoại: cụm nút ngay dưới video */}
                <div className="lg:hidden flex items-center justify-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto hide-scrollbar">{nutCongCu}</div>

                {openVideoInfo && (
                  <div ref={tieuDeRef} className="pod-vid-w hidden lg:block min-w-0 px-0 shrink-0 mx-auto max-w-full" style={rongVideo ? { width: rongVideo } : undefined}>{/* tiêu đề BÁM THEO video: cùng bề rộng + cùng mép trái, dù video co dãn (máy tính) */}
                    <h1 className="text-base sm:text-lg font-black text-[#1A2A54] leading-snug truncate">{openVideoInfo.title}</h1>
                    <p className="text-xs font-semibold text-[#5B6B85] truncate">
                      {openVideoInfo.capDo && <span className="font-black" style={{ color: capMau(openVideoInfo.capDo) }}>{openVideoInfo.capDo} · </span>}
                      {openVideoInfo.kenh}{openVideoInfo.tieuDeGoc ? ` · ${openVideoInfo.tieuDeGoc}` : ''}
                    </p>
                  </div>
                )}

                {/* Câu đang phát - chỉ máy tính (ẩn trên thiết bị cảm ứng thật, xem .current-sentence-card ở podcast/index.html) */}
                {segments[activeIndex] && (
                  <div className="hidden lg:flex lg:flex-1 lg:min-h-0 items-center">{/* thẻ câu đang phát (chỉ >=1024px): căn GIỮA theo chiều dọc trong khoảng từ tiêu đề đến mép dưới (user 24/11) */}
                  <div ref={theCauRef} className="current-sentence-card w-full bg-white border border-[#BFD7FB] rounded-2xl px-6 py-7 min-h-[10.5rem] flex flex-col justify-center shrink-0 max-h-[50dvh] overflow-y-auto hide-scrollbar text-center shadow-sm">
                    <p className="text-xl font-semibold text-[#1A2A54] pod-jp [overflow-wrap:anywhere]" style={{ fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif", lineHeight: displayPrefs.showFurigana ? FURI_LH : 1.7 }}><FuriText text={segments[activeIndex].text} show={displayPrefs.showFurigana} rtEm={0.58} /></p>
                    {displayPrefs.showVi && segments[activeIndex].vi && <p className="text-sm text-emerald-700 font-medium mt-1">{segments[activeIndex].vi}</p>}
                  </div>
                  </div>
                )}
              </div>

              {/* Vùng phụ đề chạy */}
              <div className="flex-1 min-h-0 border-t lg:border-t-0 lg:border-l border-[#D3E4FC] bg-white flex flex-col lg:border lg:rounded-2xl lg:overflow-hidden lg:shadow-sm">
                <div className="px-3 sm:px-5 py-3 shrink-0 hidden lg:flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto hide-scrollbar border-b border-[#E3EEFF]">
                  {nutCongCu}
                </div>
                <div
                  ref={subtitleListRef}
                  onTouchStart={batDauVuot}
                  onTouchEnd={ketThucVuot}
                  onTouchCancel={ketThucVuot}
                  className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar touch-pan-y px-2.5 sm:px-4 py-3 pb-10 flex flex-col gap-1.5"
                >
                  {segments.map((seg, idx) => (
                    <DongPhuDe
                      key={idx}
                      seg={seg}
                      idx={idx}
                      active={idx === activeIndex}
                      looping={loopIdx === idx}
                      showFurigana={displayPrefs.showFurigana}
                      showVi={displayPrefs.showVi}
                      onPick={onPickLine}
                      onLoop={onLoopLine}
                      setRef={setLineRef}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
