/**
 * Trạng thái "đã xem / đã lưu" + tuỳ chọn hiển thị của trang VIDEO SHADOWING (#/podcast, xem pages/PodcastPage.tsx).
 * Chép từ web Phá Đảo Tiếng Nhật (src/podcast/podcastProgress.ts), đổi khoá localStorage, bỏ phần đồng bộ đám mây VPS.
 * Lưu hẳn ở trình duyệt (localStorage), KHÔNG đồng bộ tài khoản: đổi máy / trình duyệt thì mất trạng thái.
 * Khoá theo mã video YouTube (11 ký tự).
 */

export const PODCAST_PROGRESS_KEY = 'dora_kaiwa_podcast_progress_v1';

export interface PodcastProgressEntry {
  saved: boolean;
  lastWatchedAt: number | null; // Date.now() lúc gần nhất mở video này
  lastSegmentIndex: number | null;
  totalSegments: number | null;
  completed: boolean; // đã tới câu phụ đề cuối cùng
  at?: number; // lúc SỬA gần nhất (ms)
}

export type PodcastProgressMap = Record<string, PodcastProgressEntry>;

const EMPTY_ENTRY: PodcastProgressEntry = {
  saved: false,
  lastWatchedAt: null,
  lastSegmentIndex: null,
  totalSegments: null,
  completed: false,
};

export function loadPodcastProgress(): PodcastProgressMap {
  try {
    const raw = window.localStorage.getItem(PODCAST_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {}; // localStorage bị chặn / JSON hỏng: coi như chưa có gì
  }
}

export function savePodcastProgress(map: PodcastProgressMap): void {
  try {
    window.localStorage.setItem(PODCAST_PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // đầy quota / bị chặn ghi: bỏ qua, chỉ là nhãn trang trí trên danh sách
  }
}

export function getPodcastEntry(map: PodcastProgressMap, videoId: string): PodcastProgressEntry {
  return map[videoId] || EMPTY_ENTRY;
}

/** Bật/tắt "đã lưu" cho 1 video - trả về map mới. */
export function withToggleSaved(map: PodcastProgressMap, videoId: string): PodcastProgressMap {
  const entry = getPodcastEntry(map, videoId);
  return { ...map, [videoId]: { ...entry, saved: !entry.saved, at: Date.now() } };
}

/** Xoá LỊCH SỬ XEM (đang xem dở + tích "đã xem hết"); GIỮ các video đã lưu ♡. */
export function withClearedHistory(map: PodcastProgressMap): PodcastProgressMap {
  const next: PodcastProgressMap = {};
  for (const [id, e] of Object.entries(map)) {
    if (e.saved) next[id] = e.lastWatchedAt || e.completed ? { ...EMPTY_ENTRY, saved: true, at: Date.now() } : e; // chỉ video có lịch sử mới đổi (mới được đẩy lên đám mây)
  }
  return next;
}

/** Bỏ lưu TẤT CẢ video đã lưu ♡; GIỮ lịch sử xem (đang xem dở / đã xem hết). */
export function withClearedSaved(map: PodcastProgressMap): PodcastProgressMap {
  const next: PodcastProgressMap = {};
  for (const [id, e] of Object.entries(map)) {
    if (e.lastWatchedAt || e.completed) next[id] = e.saved ? { ...e, saved: false, at: Date.now() } : e;
  }
  return next;
}

/** Ghi nhận đang xem tới câu nào (completed = đã tới câu cuối). */
export function withProgress(map: PodcastProgressMap, videoId: string, segmentIndex: number, totalSegments: number): PodcastProgressMap {
  const entry = getPodcastEntry(map, videoId);
  const completed = entry.completed || (totalSegments > 0 && segmentIndex >= totalSegments - 1);
  return { ...map, [videoId]: { ...entry, lastWatchedAt: Date.now(), lastSegmentIndex: segmentIndex, totalSegments, completed, at: Date.now() } };
}

// Tuỳ chọn hiển thị màn xem 1 video (furigana, dịch, tự cuộn) - chung mọi video.
const DISPLAY_PREFS_KEY = 'dora_kaiwa_podcast_display_prefs_v1';

export interface PodcastDisplayPrefs {
  showFurigana: boolean;
  showVi: boolean;
  autoScroll: boolean;
}

const DEFAULT_DISPLAY_PREFS: PodcastDisplayPrefs = { showFurigana: true, showVi: true, autoScroll: true };

export function loadDisplayPrefs(): PodcastDisplayPrefs {
  try {
    const raw = window.localStorage.getItem(DISPLAY_PREFS_KEY);
    if (!raw) return { ...DEFAULT_DISPLAY_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DISPLAY_PREFS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_DISPLAY_PREFS };
  }
}

export function saveDisplayPrefs(prefs: PodcastDisplayPrefs): void {
  try {
    window.localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // chỉ là tuỳ chọn hiển thị
  }
}
