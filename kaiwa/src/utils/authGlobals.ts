// ---------------------------------------------------------
// Cầu nối có kiểu tới các hàm/biến TOÀN CỤC do script cổ điển của trang
// (public/js/supabaseClient.js, public/js/common.js) khai báo - nạp bằng
// <script defer> TRƯỚC module React (xem kaiwa/index.html). Gom việc đọc
// `window.xxx` vào 1 chỗ thay vì rải `(window as any)` khắp component.
//
// Mọi hàm ở đây chỉ được gọi từ sự kiện/effect (sau khi trang đã tải xong)
// nên các script cổ điển luôn đã chạy.
// ---------------------------------------------------------

type AnyRecord = Record<string, any>;
const w = window as unknown as AnyRecord;

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  displayName: string;
  maxDevices?: number;
  expiresAt?: string | null;
  allowedCourses?: string[];
};

export function getAuthUser(): AuthUser | undefined {
  return w.__authUser;
}

export function getSupabase(): any {
  return w.supabaseClient;
}

/** Đọc hồ sơ `profiles` (có cache 5 phút + tự thử lại, xem common.js). */
export function fetchProfileWithRetry(userId: string): Promise<{ data: AnyRecord | null; error: any }> {
  return w.fetchProfileWithRetry(userId);
}

export function readCache(key: string): any {
  return w.readCache(key);
}

export function writeCache(key: string, value: unknown): void {
  w.writeCache(key, value);
}

export function clearAccountCache(): void {
  w.clearAccountCache();
}

/** Đường dẫn trang đăng nhập (tôn trọng SITE_BASE khi chạy dạng project page). */
export function loginUrl(): string {
  return (w.SITE_BASE || '/') + 'login';
}
