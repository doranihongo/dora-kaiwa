// TẢI DỮ LIỆU MỘT CUỐN KAIWA (từ VPS, chỉ tài khoản có quyền - utils/kaiwaApi.ts) + bộ nhớ tạm.
// Cách chia phần: kaiwaParts.js (chép nguyên từ web Phá Đảo).
import { buildCourse } from './kaiwaParts.js';
import { fetchKaiwaBook, onAccountChange } from '../../utils/kaiwaApi';

// Bộ nhớ tạm theo cuốn (module-level: trang sách tải trước, cửa sổ bài dùng lại không phải tải lần nữa)
const cache = new Map();   // level -> { data, parts }
const dangTai = new Map(); // level -> Promise
onAccountChange(() => cache.clear()); // đăng xuất / đổi tài khoản: bỏ dữ liệu đã tải

export const getCachedCourse = (level) => cache.get(level) || null;

export function loadCourse(level) {
    const co = getCachedCourse(level);
    if (co) return Promise.resolve(co);
    if (dangTai.has(level)) return dangTai.get(level);
    const p = fetchKaiwaBook(level)
        .then((raw) => {
            const course = buildCourse(level, raw);
            cache.set(level, course);
            return course;
        })
        .finally(() => dangTai.delete(level));
    dangTai.set(level, p);
    return p;
}
