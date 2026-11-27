// API SÁCH KAIWA của Dora Kaiwa (chạy trên VPS, nginx chuyển https://xh.doranihongo.com/dora-kaiwa/ vào đây).
// CHỈ tài khoản Supabase của web Dora Kaiwa (role admin / giaovien / hocvien, còn hạn) lấy được chữ, ảnh, audio.
// Node 18+, không cần cài thư viện. Cài đặt: vps/README.md.
//
// Dữ liệu đọc THẲNG từ thư mục đã có trên VPS (không chép thêm bản nào):
//   DATA_DIR  = .../baitap-data/khoa      -> sachkaiwa/sachkaiwa<cuốn>.json, tuvung-hinh/kaiwa-*.webp
//   AUDIO_DIR = /opt/baitap/kaiwa-audio   -> <thư mục sách>/<tên>.m4a
//
// API:
//   GET  /healthz                                   -> ok
//   POST /data  { token, book: "nameraka" }         -> nội dung JSON của cuốn
//   POST /img   { token, tep: "tuvung-hinh/kaiwa-tt-001.webp" } -> ảnh webp
//   POST /link  { token, file: "sdn1/sdn1p3.m4a" }  -> { exp, url: "media/sdn1/sdn1p3.m4a?e=..&s=.." }
//   GET  /media/<sách>/<tên>.m4a?e=..&s=..          -> audio (kiểm chữ ký + hạn, có Range để tua)
// Thân POST gửi dạng text/plain (khỏi preflight CORS). token = access token Supabase của người đang đăng nhập.
// 401 = chưa đăng nhập / token sai, hết hạn · 403 = tài khoản không có quyền · 503 = không hỏi được Supabase (không cho qua).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const env = process.env;
const PORT = Number(env.PORT || 3200);
const HOST = env.HOST || '127.0.0.1';
const SUPABASE_URL = (env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || '';
const DATA_DIR = path.resolve(env.DATA_DIR || '/opt/baitap/repo/baitap-data/khoa');
const AUDIO_DIR = path.resolve(env.AUDIO_DIR || '/opt/baitap/kaiwa-audio');
const LINK_SECRET = env.LINK_SECRET || '';
const LINK_TTL_SEC = Math.max(60, Number(env.LINK_TTL_SEC || 6 * 3600));
const list = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
const ORIGINS = list(env.ALLOWED_ORIGINS || 'https://doranihongo.com,https://www.doranihongo.com,http://localhost:3000');
// Cùng danh sách với ALLOWED_ROLES ở public/js/supabaseClient.js ('student' của web kanji KHÔNG được vào).
const ROLES = list(env.ALLOWED_ROLES || 'admin,giaovien,hocvien');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || LINK_SECRET.length < 32) {
    console.error('Thiếu cấu hình: cần SUPABASE_URL, SUPABASE_ANON_KEY, LINK_SECRET (tối thiểu 32 ký tự).');
    process.exit(1);
}

const BOOK_RE = /^[a-z0-9]{3,40}$/;
const AUDIO_RE = /^[a-z0-9]{3,40}\/[A-Za-z0-9_-]{1,60}\.m4a$/;
const IMG_RE = /^tuvung-hinh\/kaiwa-[a-z0-9-]{1,60}\.webp$/;
const MAX_BODY = 8 * 1024;
const ROLE_TTL_MS = 60 * 1000;
const PASSWORD_GRACE_SEC = 10; // như PASSWORD_CHANGE_GRACE_MS ở supabaseClient.js
const FAIL_LIMIT = 30; // số token sai tối đa mỗi IP mỗi phút

// ---------- trả lời ----------
const send = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
};

// ---------- kiểm quyền ----------
const decodePayload = (token) => {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); } catch { return null; }
};

const supabaseGet = async (url, token) => {
    const r = await fetch(`${SUPABASE_URL}${url}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
    });
    if (r.status === 401 || r.status === 403) return null;
    if (!r.ok) throw new Error(`supabase ${r.status}`);
    return r.json();
};

// 200 = được phép · 401 = token sai · 403 = đăng nhập rồi nhưng không có quyền. Ném lỗi khi không hỏi được Supabase.
const lookup = async (token) => {
    const user = await supabaseGet('/auth/v1/user', token); // Supabase tự kiểm chữ ký + hạn của token
    if (!user?.id) return 401;
    const rows = await supabaseGet(`/rest/v1/profiles?select=role,expires_at,password_changed_at&id=eq.${encodeURIComponent(user.id)}`, token);
    const p = Array.isArray(rows) ? rows[0] : null;
    if (!p || !ROLES.includes(p.role)) return 403;
    if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return 403;
    // Token cấp TRƯỚC lần đổi mật khẩu gần nhất -> coi như hết hiệu lực
    if (p.password_changed_at) {
        const iat = decodePayload(token)?.iat;
        if (iat && iat < new Date(p.password_changed_at).getTime() / 1000 - PASSWORD_GRACE_SEC) return 401;
    }
    return 200;
};

const cache = new Map(); // sha256(token) -> { status, until }
const pending = new Map(); // sha256(token) -> Promise<status>
const fails = new Map(); // ip -> { n, until }
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    for (const [k, v] of fails) if (v.until <= now) fails.delete(k);
}, 60 * 1000).unref();

const checkToken = async (token, ip) => {
    const payload = decodePayload(token);
    if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) return 401;
    const key = crypto.createHash('sha256').update(token).digest('hex');
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.status;
    const f = fails.get(ip);
    if (f && f.until > Date.now() && f.n >= FAIL_LIMIT) return 429;
    let p = pending.get(key);
    if (!p) {
        p = lookup(token).finally(() => pending.delete(key));
        pending.set(key, p);
    }
    const status = await p;
    cache.set(key, { status, until: Date.now() + ROLE_TTL_MS });
    if (status === 401) {
        const cur = fails.get(ip);
        if (cur && cur.until > Date.now()) cur.n += 1;
        else fails.set(ip, { n: 1, until: Date.now() + 60 * 1000 });
    }
    return status;
};

const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(new Error('BODY')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
});

// Đường dẫn file trong 1 thư mục gốc (đã qua regex; kiểm thêm lần nữa không lọt ra ngoài)
const inside = (root, rel) => {
    const full = path.resolve(root, rel);
    return full.startsWith(root + path.sep) ? full : null;
};
const isFile = (full) => { try { return !!full && fs.statSync(full).isFile(); } catch { return false; } };

// ---------- liên kết ký số cho audio (thẻ <audio> không gửi được token) ----------
const sign = (file, exp) => crypto.createHmac('sha256', LINK_SECRET).update(`dk|${file}|${exp}`).digest('hex');
const safeEqual = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const sendFile = (req, res, full, type, cacheControl) => {
    const size = fs.statSync(full).size;
    let start = 0;
    let end = size - 1;
    let code = 200;
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] !== '' || range[2] !== '')) {
        if (range[1] === '') start = Math.max(0, size - Number(range[2]));
        else {
            start = Number(range[1]);
            if (range[2] !== '') end = Math.min(size - 1, Number(range[2]));
        }
        if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
        code = 206;
    }
    const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': cacheControl };
    if (code === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    res.writeHead(code, headers);
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(full, { start, end }).on('error', () => res.destroy()).pipe(res);
};

const handleMedia = (req, res, url) => {
    let file;
    try { file = decodeURIComponent(url.pathname.slice('/media/'.length)); } catch { return send(res, 400, { error: 'tep' }); }
    const exp = Number(url.searchParams.get('e'));
    const sig = url.searchParams.get('s') || '';
    if (!AUDIO_RE.test(file) || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !safeEqual(sig, sign(file, exp))) {
        return send(res, 403, { error: 'lien-ket-het-han-hoac-sai' });
    }
    const full = inside(AUDIO_DIR, file);
    if (!isFile(full)) return send(res, 404, { error: 'khong-co-tep' });
    return sendFile(req, res, full, 'audio/mp4', 'private, max-age=3600');
};

const POST_ROUTES = {
    '/data': (req, res, b) => {
        if (typeof b.book !== 'string' || !BOOK_RE.test(b.book)) return send(res, 400, { error: 'tep' });
        const full = inside(DATA_DIR, `sachkaiwa/sachkaiwa${b.book}.json`);
        if (!isFile(full)) return send(res, 404, { error: 'khong-co-tep' });
        return sendFile(req, res, full, 'application/json; charset=utf-8', 'private, no-store');
    },
    '/img': (req, res, b) => {
        if (typeof b.tep !== 'string' || !IMG_RE.test(b.tep)) return send(res, 400, { error: 'tep' });
        const full = inside(DATA_DIR, b.tep);
        if (!isFile(full)) return send(res, 404, { error: 'khong-co-tep' });
        return sendFile(req, res, full, 'image/webp', 'private, max-age=3600');
    },
    '/link': (req, res, b) => {
        if (typeof b.file !== 'string' || !AUDIO_RE.test(b.file)) return send(res, 400, { error: 'tep' });
        if (!isFile(inside(AUDIO_DIR, b.file))) return send(res, 404, { error: 'khong-co-tep' });
        const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SEC;
        return send(res, 200, { exp, url: `media/${b.file}?e=${exp}&s=${sign(b.file, exp)}` });
    },
};

const server = http.createServer(async (req, res) => {
    try {
        const origin = req.headers.origin;
        res.setHeader('Vary', 'Origin');
        if (origin && ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

        const url = new URL(req.url, 'http://x');
        if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
        if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname.startsWith('/media/')) return handleMedia(req, res, url);

        const route = req.method === 'POST' && Object.hasOwn(POST_ROUTES, url.pathname) ? POST_ROUTES[url.pathname] : null;
        if (!route) return send(res, 404, { error: 'khong-co' });
        let b;
        try { b = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'json' }); }
        if (!b || typeof b !== 'object') return send(res, 400, { error: 'json' });
        if (!b.token) return send(res, 401, { error: 'chua-dang-nhap' });
        // nginx đặt X-Real-IP; dịch vụ chỉ nghe ở 127.0.0.1 nên không ai bên ngoài gửi thẳng được
        const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
        let status;
        try { status = await checkToken(b.token, ip); } catch (e) { console.error('[xac-thuc]', e.message); return send(res, 503, { error: 'xac-thuc' }); }
        if (status !== 200) return send(res, status, { error: status === 403 ? 'khong-co-quyen' : status === 429 ? 'qua-nhieu' : 'chua-dang-nhap' });
        return route(req, res, b);
    } catch (e) {
        console.error('[loi]', e);
        if (!res.headersSent) send(res, 500, { error: 'loi' });
        else res.destroy();
        return undefined;
    }
});

server.listen(PORT, HOST, () => {
    console.log(`dora-kaiwa nghe ở ${HOST}:${PORT} · chữ: ${DATA_DIR} · audio: ${AUDIO_DIR} · vai trò: ${ROLES.join(', ')}`);
});
