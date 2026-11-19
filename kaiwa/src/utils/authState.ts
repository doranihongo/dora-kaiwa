// ---------------------------------------------------------
// Đợi authGuard (public/js/common.js, script <script defer>/module nạp
// cùng trang) chạy xong rồi trả về window.__authUser - dùng chung cho
// Home.tsx, CourseDetail.tsx, LessonView.tsx thay vì mỗi nơi tự viết lại
// y hệt.
//
// window.__authReady được common.js gán NGAY khi script đó tới lượt chạy
// - bình thường luôn có sẵn trước khi bất kỳ effect React nào kịp chạy
// (effect luôn lùi lại sau khi toàn bộ script đồng bộ của trang chạy
// xong). Nhưng nếu trình duyệt trì hoãn/lỗi tải common.js,
// window.__authReady có thể CHƯA kịp gán lúc effect chạy. Trước đây gặp
// trường hợp đó thì coi luôn là "chưa đăng nhập" (window.__authUser
// undefined) và không bao giờ thử lại - vì effect chỉ chạy đúng 1 lần lúc
// mount - khiến khóa học hiện "Đang khóa" vĩnh viễn dù tài khoản là
// admin/giáo viên. Hàm này CHỦ ĐỘNG đợi (poll) cho tới khi
// window.__authReady xuất hiện thay vì bỏ cuộc ngay.
// ---------------------------------------------------------

const POLL_MS = 50;
const WAIT_FOR_SCRIPT_TIMEOUT_MS = 8000;

// Đợi window.supabaseClient (do public/js/supabaseClient.js gắn vào) xuất hiện.
//
// Sau khi build, Vite đưa <script type="module"> của React lên <head> - tức
// module React chạy TRƯỚC các <script defer> classic ở cuối <body> (xem
// dist/index.html), kể cả supabaseClient.js (còn phải đợi supabase-js từ CDN).
// Effect lúc mount đọc window.supabaseClient quá sớm sẽ thấy undefined: danh sách
// khóa học rơi về rỗng và KHÔNG tự thử lại. Mạng chậm/lần mở đầu chưa có cache
// (đúng tình huống mở từ icon màn hình chính) là lúc dễ dính nhất. Trả về null
// nếu quá hạn mà vẫn không có (chạy ngoài server chính) - nơi gọi tự xử lý.
export function waitForSupabaseClient(): Promise<any | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tryResolve = () => {
      const client = (window as any).supabaseClient;
      if (client) {
        resolve(client);
        return;
      }
      if (Date.now() - start >= WAIT_FOR_SCRIPT_TIMEOUT_MS) {
        resolve(null);
        return;
      }
      setTimeout(tryResolve, POLL_MS);
    };
    tryResolve();
  });
}

export function waitForAuthUser(): Promise<any> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tryResolve = () => {
      const w = window as any;
      if (w.__authReady) {
        w.__authReady.then(() => resolve(w.__authUser));
        return;
      }
      if (Date.now() - start >= WAIT_FOR_SCRIPT_TIMEOUT_MS) {
        // Hết giờ đợi - common.js có thể lỗi tải/chưa chạy được. Trả về
        // window.__authUser hiện có (thường vẫn là undefined) thay vì
        // treo mãi - coi như chưa đăng nhập, an toàn hơn mặc định mở.
        resolve(w.__authUser);
        return;
      }
      setTimeout(tryResolve, POLL_MS);
    };

    tryResolve();
  });
}
