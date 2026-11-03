// ---------------------------------------------------------
// Gốc đường dẫn của thư mục dữ liệu học tập (JSON + audio) của các công cụ
// Shadowing (sách kaiwa) và Nghe chính tả: public/data/... trong repo này,
// phục vụ CÙNG domain với web (trước đây lấy từ repo khác qua jsDelivr).
//
// BASE_URL của app là "<gốc web>kaiwa/" (xem vite.config.ts) - bỏ "/kaiwa/" ở
// cuối thì ra gốc web không có dấu "/" cuối: "" khi web ở gốc tên miền,
// "/dora-kaiwa" khi chạy ở github.io/dora-kaiwa/. Nên `${DATA_BASE}/data/x.json`
// luôn đúng ở cả hai trường hợp.
// ---------------------------------------------------------
export const DATA_BASE: string = import.meta.env.BASE_URL.replace(/\/kaiwa\/$/, '');
