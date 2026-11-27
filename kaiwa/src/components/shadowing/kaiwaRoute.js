// ĐỊA CHỈ (hash) của trang Sách kaiwa - mở popup chọn bài / vào chi tiết 1 bài thì ghi địa chỉ, tải lại trang mở đúng chỗ:
//   #/shadowing                            danh sách các cuốn
//   #/shadowing/<id sách>                  trang của cuốn (danh sách các phần)
//   #/shadowing/<id sách>/<phần>           popup danh sách bài của phần số <phần> (đếm từ 1)
//   #/shadowing/<id sách>/<phần>/<bài>     trang chi tiết của bài số <bài> (đếm từ 1 theo SỐ BÀI trong danh sách)
// Đổi địa chỉ bằng history.replaceState (không thêm mục lịch sử, không bắn hashchange nên không lặp vòng); dán / sửa tay địa chỉ hay nút Lùi của trình duyệt thì có hashchange -> ShadowingPage + KaiwaModal đọc lại.
import { HREF } from '../../utils/route';

export const bookHref = (slug) => `${HREF.shadowing}/${slug}`;

export function parseKaiwaHash(hash) {
    let h = String(hash ?? window.location.hash ?? '').replace(/^#\/?/, '');
    try { h = decodeURIComponent(h); } catch { /* giữ nguyên */ }
    const [trang = '', slug = '', p, l] = h.split('/');
    if (trang !== 'shadowing') return { slug: '', part: null, lesson: null };
    const so = (x) => { const n = Number(x); return x !== undefined && x !== '' && Number.isInteger(n) && n >= 1 ? n : null; };
    const part = so(p);
    return { slug: slug.toLowerCase(), part, lesson: part != null ? so(l) : null };
}

export function setKaiwaHash(slug, part, lesson) {
    if (!window.location.hash.startsWith(HREF.shadowing)) return; // đã rời trang Sách kaiwa
    const h = `${bookHref(slug)}${part ? `/${part}` : ''}${part && lesson ? `/${lesson}` : ''}`;
    if (window.location.hash === h) return;
    try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + h); } catch { window.location.hash = h; }
}
