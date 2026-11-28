// ---------------------------------------------------------
// Dữ liệu SÁCH KAIWA (chữ, ảnh, audio) nằm trên VPS, KHÔNG nằm trong web tĩnh:
// API ở vps/kaiwa-server.mjs, chỉ trả cho tài khoản đăng nhập có quyền (gửi kèm
// access token Supabase). Thử API chạy ở máy: đặt biến VITE_KAIWA_API khi build.
// ---------------------------------------------------------
import { waitForAuthUser, waitForSupabaseClient } from './authState';

const API: string = (import.meta.env.VITE_KAIWA_API || 'https://xh.doranihongo.com/dora-kaiwa').replace(/\/+$/, '');

export type KaiwaErrorCode = 'auth' | 'forbidden' | 'missing' | 'network';

export class KaiwaError extends Error {
  code: KaiwaErrorCode;
  constructor(code: KaiwaErrorCode) {
    super(code);
    this.code = code;
  }
}

const MESSAGES: Record<KaiwaErrorCode, string> = {
  auth: 'Phiên đăng nhập đã hết hạn, bạn đăng nhập lại nhé.',
  forbidden: 'Tài khoản của bạn chưa có quyền xem sách Kaiwa.',
  missing: 'Nội dung này đang được cập nhật, bạn thử lại sau nhé.',
  network: 'Không tải được dữ liệu. Bạn kiểm tra mạng rồi thử lại nhé.',
};

export const kaiwaErrorMessage = (e: unknown): string => MESSAGES[e instanceof KaiwaError ? e.code : 'network'];

// --- bộ nhớ tạm: bỏ hết khi đăng xuất / đổi tài khoản ---
const clearers = new Set<() => void>();
export function onAccountChange(clear: () => void) {
  clearers.add(clear);
}

let lastUserId: string | null = null;
let watching = false;
function watchAccount(client: any) {
  if (watching) return;
  watching = true;
  client.auth.onAuthStateChange((event: string, session: any) => {
    const id: string | null = session?.user?.id || null;
    if (event === 'SIGNED_OUT' || (lastUserId && id && id !== lastUserId)) clearers.forEach((f) => f());
    lastUserId = id;
  });
}

async function getToken(refresh = false): Promise<string | null> {
  const client = await waitForSupabaseClient();
  if (!client) return null;
  watchAccount(client);
  try {
    const { data } = refresh ? await client.auth.refreshSession() : await client.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function post(path: string, body: Record<string, string>): Promise<Response> {
  await waitForAuthUser(); // đợi authGuard kiểm xong phiên đăng nhập
  let token = await getToken();
  for (let attempt = 0; ; attempt += 1) {
    if (!token) throw new KaiwaError('auth');
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // text/plain để khỏi preflight CORS
        body: JSON.stringify({ ...body, token }),
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(20000) : undefined,
      });
    } catch {
      throw new KaiwaError('network');
    }
    if (res.ok) return res;
    if (res.status === 401 && attempt === 0) {
      // token vừa hết hạn: làm mới phiên 1 lần rồi gọi lại
      const fresh = await getToken(true);
      if (fresh && fresh !== token) {
        token = fresh;
        continue;
      }
    }
    if (res.status === 401) throw new KaiwaError('auth');
    if (res.status === 403) throw new KaiwaError('forbidden');
    if (res.status === 404) throw new KaiwaError('missing');
    throw new KaiwaError('network');
  }
}

/** Mảng bài của 1 cuốn (vd 'nameraka'). */
export async function fetchKaiwaBook(book: string): Promise<any[]> {
  const res = await post('/data', { book });
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) throw new KaiwaError('network');
  return data;
}

// audioPath trong JSON: "./data/filenghesachkaiwa/<sách>/<tên>.m4a" -> "<sách>/<tên>.m4a"
const audioFile = (audioPath: string) => String(audioPath || '').replace(/^\.?\/?data\/filenghesachkaiwa\//, '');
const links = new Map<string, { url: string; until: number }>();

/** Liên kết nghe có ký số, hạn vài giờ (thẻ <audio> không gửi được token đăng nhập). */
export async function fetchKaiwaAudioUrl(audioPath: string): Promise<string> {
  const file = audioFile(audioPath);
  const hit = links.get(file);
  if (hit && hit.until > Date.now()) return hit.url;
  const res = await post('/link', { file });
  const data = await res.json().catch(() => null);
  if (!data?.url) throw new KaiwaError('network');
  const url = `${API}/${data.url}`;
  // dùng lại tới trước hạn 10 phút
  links.set(file, { url, until: (Number(data.exp) - 600) * 1000 });
  return url;
}

/** Bỏ liên kết đã nhớ (khi nghe lỗi) để lần bấm sau xin liên kết mới. */
export function forgetKaiwaAudioUrl(audioPath: string) {
  links.delete(audioFile(audioPath));
}

const images = new Map<string, Promise<string | null>>();

/** Ảnh minh hoạ của bài ("tuvung-hinh/kaiwa-....webp") -> object URL cho <img>; không lấy được thì null. */
export function fetchKaiwaImage(tep: string): Promise<string | null> {
  let p = images.get(tep);
  if (!p) {
    p = post('/img', { tep })
      .then(async (res) => URL.createObjectURL(await res.blob()))
      .catch(() => {
        images.delete(tep);
        return null;
      });
    images.set(tep, p);
  }
  return p;
}

onAccountChange(() => {
  links.clear();
  images.forEach((p) => p.then((url) => url && URL.revokeObjectURL(url)));
  images.clear();
});
