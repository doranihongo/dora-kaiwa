// ---------------------------------------------------------
// Ánh xạ URL slide CŨ sang ảnh nằm cùng web (GitHub Pages).
//
// Ảnh slide (WebP) nằm trong repo này tại public/slides/<khóa>/<buổi>/<n>.webp
// và được phục vụ cùng domain ở "/slides/...". Nhưng Supabase (bảng
// kaiwa_lessons) vẫn lưu URL của bucket Cloudflare cũ:
//   slide_folder = "https://kaiwa.jlptdora.online/<khóa>/<buổi>/", slide_ext = "jpg"
// (domain đó đòi URL có chữ ký nên không dùng được nữa). Thay vì bắt phải sửa
// dữ liệu thật, hàm này đổi URL cũ sang "/slides/<khóa>/<buổi>/" + đuôi webp
// ngay khi dựng danh sách ảnh. Cấu trúc thư mục giữ nguyên nên khớp 1-1.
//
// Khi cột slide_folder trong Supabase đã đổi sang "/slides/<khóa>/<buổi>/"
// (và slide_ext = "webp") thì hàm này không còn khớp gì để đổi - có thể xóa
// file này cùng chỗ gọi trong buildRawSlideUrls.ts.
// ---------------------------------------------------------

const LEGACY_SLIDE_ORIGIN = 'https://kaiwa.jlptdora.online/';

export interface LegacySlideLesson {
  slideFolder?: string;
  slideExt?: string;
  slideCount?: number;
}

export function mapLegacySlideLesson<T extends LegacySlideLesson>(lesson: T): T {
  const folder = lesson.slideFolder;
  if (!folder || !folder.startsWith(LEGACY_SLIDE_ORIGIN)) return lesson;

  return {
    ...lesson,
    slideFolder: `${window.location.origin}/slides/${folder.slice(LEGACY_SLIDE_ORIGIN.length)}`,
    slideExt: 'webp',
  };
}
