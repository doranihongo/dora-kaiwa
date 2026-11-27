import { useEffect, useReducer } from 'react';

// ĐÃ XEM (user 26/11): phần / bài đã bấm vào xem thì ở danh sách chuyển MÀU TÍM (như liên kết đã thăm). Kể cả bài xem qua mũi tên < > trong popup chi tiết.
// Lưu ở PHIÊN HIỆN TẠI: sessionStorage - đóng tab/trang là hết (tải lại trang cùng tab vẫn còn). Một kho chung cho cả danh sách phần (KaiwaPage) lẫn popup bài (KaiwaModal).
const KEY = 'kaiwa-da-xem';
const kho = new Set();
const dangNghe = new Set();
try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null;
    if (raw) JSON.parse(raw).forEach((k) => kho.add(k));
} catch { /* trình duyệt chặn sessionStorage: chỉ giữ trong bộ nhớ trang */ }

const luu = () => { try { sessionStorage.setItem(KEY, JSON.stringify([...kho])); } catch { /* bỏ qua */ } };

export const khoaPhan = (level, i) => `p:${level}:${i}`;
export const khoaBai = (level, lesson, globalIdx) => `b:${level}:${lesson && lesson.id != null ? lesson.id : globalIdx}`;

export function danhDauDaXem(key) {
    if (!key || kho.has(key)) return;
    kho.add(key);
    luu();
    dangNghe.forEach((f) => f());
}

// Hook: trả về hàm daXem(key); component tự vẽ lại khi có mục mới được đánh dấu.
export function useDaXem() {
    const [, veLai] = useReducer((x) => x + 1, 0);
    useEffect(() => {
        dangNghe.add(veLai);
        return () => { dangNghe.delete(veLai); };
    }, []);
    return (key) => kho.has(key);
}
