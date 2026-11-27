// Chạy thử vps/kaiwa-server.mjs ở máy: Supabase GIẢ + dữ liệu giả trong thư mục tạm. Dùng: node vps/test-server.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dora-kaiwa-'));
const data = path.join(tmp, 'khoa');
const audio = path.join(tmp, 'audio');
const put = (file, body) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
put(path.join(data, 'sachkaiwa/sachkaiwanameraka.json'), '[{"id":"1","title":"thử"}]');
put(path.join(data, 'tuvung-hinh/kaiwa-tt-001.webp'), 'WEBP');
put(path.join(data, 'tuvung-hinh/minna-n4.webp'), 'KHAC');
put(path.join(audio, 'nameraka/a1.m4a'), '0123456789');
put(path.join(tmp, 'bimat.m4a'), 'BIMAT');

const now = () => Math.floor(Date.now() / 1000);
const jwt = (sub, extra = {}) => `x.${Buffer.from(JSON.stringify({ sub, iat: now(), exp: now() + 3600, ...extra })).toString('base64url')}.ky`;
const PROFILES = {
    hocvien: { role: 'hocvien' },
    giaovien: { role: 'giaovien', expires_at: new Date(Date.now() + 864e5).toISOString() },
    admin: { role: 'admin' },
    student: { role: 'student' },
    hethan: { role: 'hocvien', expires_at: new Date(Date.now() - 1000).toISOString() },
    doimatkhau: { role: 'hocvien', password_changed_at: new Date(Date.now() + 60e3).toISOString() },
};
let supabaseDown = false;
const mock = http.createServer((req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (supabaseDown) return reply(500, {});
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token.endsWith('.ky')) return reply(401, {}); // chữ ký sai
    const sub = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/auth/v1/user') return reply(200, { id: sub });
    assert.equal(url.searchParams.get('id'), `eq.${sub}`);
    return reply(200, PROFILES[sub] ? [PROFILES[sub]] : []);
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));

const PORT = 3299;
const server = spawn(process.execPath, [fileURLToPath(new URL('./kaiwa-server.mjs', import.meta.url))], {
    env: {
        ...process.env, PORT: String(PORT), SUPABASE_URL: `http://127.0.0.1:${mock.address().port}`, SUPABASE_ANON_KEY: 'anon',
        LINK_SECRET: 'x'.repeat(40), DATA_DIR: data, AUDIO_DIR: audio, ALLOWED_ORIGINS: 'https://doranihongo.com',
    },
    stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('exit', () => reject(new Error('server không chạy'))); });

const BASE = `http://127.0.0.1:${PORT}`;
const post = (p, body, headers = {}) => fetch(`${BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', ...headers }, body: JSON.stringify(body) });
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('  ok', name); };

try {
    await test('chưa đăng nhập bị chặn ở mọi API', async () => {
        for (const [p, b] of [['/data', { book: 'nameraka' }], ['/link', { file: 'nameraka/a1.m4a' }], ['/img', { tep: 'tuvung-hinh/kaiwa-tt-001.webp' }]]) {
            assert.equal((await post(p, b)).status, 401);
        }
    });
    await test('token rác / hết hạn / chữ ký sai -> 401', async () => {
        for (const token of ['rac', jwt('admin', { exp: now() - 5 }), jwt('admin').replace('.ky', '.sai')]) {
            assert.equal((await post('/data', { token, book: 'nameraka' })).status, 401);
        }
    });
    await test('admin, giáo viên, học viên còn hạn đọc được', async () => {
        for (const who of ['admin', 'giaovien', 'hocvien']) {
            const r = await post('/data', { token: jwt(who), book: 'nameraka' });
            assert.equal(r.status, 200);
            assert.equal((await r.json())[0].title, 'thử');
        }
    });
    await test('student web kanji, hết hạn, không có hồ sơ -> 403', async () => {
        for (const who of ['student', 'hethan', 'khongco']) assert.equal((await post('/data', { token: jwt(who), book: 'nameraka' })).status, 403);
    });
    await test('token cũ hơn lần đổi mật khẩu -> 401', async () => {
        assert.equal((await post('/data', { token: jwt('doimatkhau'), book: 'nameraka' })).status, 401);
    });
    const token = jwt('hocvien');
    await test('chặn đường dẫn lạ, ảnh không thuộc Kaiwa', async () => {
        for (const [p, b] of [['/data', { token, book: '../nameraka' }], ['/link', { token, file: '../bimat.m4a' }], ['/link', { token, file: 'nameraka/../../bimat.m4a' }], ['/img', { token, tep: 'tuvung-hinh/minna-n4.webp' }]]) {
            assert.equal((await post(p, b)).status, 400, JSON.stringify(b));
        }
        assert.equal((await post('/data', { token, book: 'khongco' })).status, 404);
        assert.equal((await post('/link', { token, file: 'nameraka/zz.m4a' })).status, 404);
        assert.equal((await post('/constructor', { token })).status, 404);
    });
    await test('ảnh Kaiwa', async () => {
        const r = await post('/img', { token, tep: 'tuvung-hinh/kaiwa-tt-001.webp' });
        assert.equal(r.headers.get('content-type'), 'image/webp');
        assert.equal(await r.text(), 'WEBP');
    });
    await test('audio: link ký số nghe được, tua được; sửa chữ ký / tên file / hạn thì bị chặn', async () => {
        const { url, exp } = await (await post('/link', { token, file: 'nameraka/a1.m4a' })).json();
        assert.ok(exp > now());
        const full = await fetch(`${BASE}/${url}`);
        assert.equal(await full.text(), '0123456789');
        const part = await fetch(`${BASE}/${url}`, { headers: { Range: 'bytes=2-5' } });
        assert.equal(part.status, 206);
        assert.equal(await part.text(), '2345');
        assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
        assert.equal((await fetch(`${BASE}/media/nameraka/a1.m4a`)).status, 403);
        assert.equal((await fetch(`${BASE}/${url.replace(/s=.{4}/, 's=0000')}`)).status, 403);
        assert.equal((await fetch(`${BASE}/${url.replace('a1.m4a', 'a2.m4a')}`)).status, 403);
        assert.equal((await fetch(`${BASE}/${url.replace(/e=\d+/, `e=${exp + 999}`)}`)).status, 403);
    });
    await test('CORS chỉ cho domain của web', async () => {
        const ok = await post('/data', { token, book: 'nameraka' }, { Origin: 'https://doranihongo.com' });
        assert.equal(ok.headers.get('access-control-allow-origin'), 'https://doranihongo.com');
        const la = await post('/data', { token, book: 'nameraka' }, { Origin: 'https://trang-la.example' });
        assert.equal(la.headers.get('access-control-allow-origin'), null);
    });
    await test('Supabase lỗi -> 503, không cho qua', async () => {
        supabaseDown = true;
        assert.equal((await post('/data', { token: jwt('admin', { n: 1 }), book: 'nameraka' })).status, 503);
        supabaseDown = false;
    });
    await test('dò token sai liên tục -> 429', async () => {
        let last = 0;
        for (let i = 0; i < 35; i++) last = (await post('/data', { token: jwt('admin', { n: i }).replace('.ky', '.sai'), book: 'nameraka' }, { 'X-Real-IP': '9.9.9.9' })).status;
        assert.equal(last, 429);
    });
    console.log(`ĐẠT ${n} nhóm kiểm tra`);
} finally {
    server.kill();
    mock.close();
    fs.rmSync(tmp, { recursive: true, force: true });
}
