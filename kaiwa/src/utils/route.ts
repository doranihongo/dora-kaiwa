import { useEffect, useState } from 'react';

// ---------------------------------------------------------
// Chia "trang" của web bằng đường dẫn trong phần #hash (web tĩnh trên GitHub
// Pages - không có server nên không thể có đường dẫn thật /shadowing/ mà
// không đẻ thêm 1 file HTML cho mỗi trang). Mỗi màn có địa chỉ riêng, nút
// Quay lại của trình duyệt/điện thoại đi đúng 1 màn, và mở thẳng được từ link.
//
//   #/                       trang chủ (khóa học + công cụ học)
//   #/shadowing              trang Sách kaiwa (9 giáo trình); /<sách>/<phần>/<bài> xem components/shadowing/kaiwaRoute.js
//   #/nghechinhta            trang Nghe chính tả
//   #/podcast                trang Nghe Podcast (video YouTube)
//   #/podcast/<mã YouTube>   màn xem 1 video của trang Video shadowing (nút Quay lại về màn trước)
//   #/podcast/ds/<mã>        trang xem trọn 1 danh sách phát của trang Video shadowing
//   #/khoa/<khóa>            trang chi tiết 1 khóa học
//   #/khoa/<khóa>/<buổi>     trang 1 buổi học
// ---------------------------------------------------------

export type Route =
  | { name: 'home' }
  | { name: 'shadowing' }
  | { name: 'nghechinhta' }
  | { name: 'podcast'; videoId?: string | null; playlistId?: string | null }
  | { name: 'course'; courseId: string; lessonId: string | null };

export const HREF = {
  home: '#/',
  shadowing: '#/shadowing',
  nghechinhta: '#/nghechinhta',
  podcast: '#/podcast',
  podcastVideo: (youtubeId: string) => `#/podcast/${encodeURIComponent(youtubeId)}`,
  podcastPlaylist: (playlistId: string) => `#/podcast/ds/${encodeURIComponent(playlistId)}`,
  course: (courseId: string, lessonId?: string | null) =>
    `#/khoa/${encodeURIComponent(courseId)}${lessonId ? `/${encodeURIComponent(lessonId)}` : ''}`,
};

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  switch (parts[0]) {
    case 'shadowing':
      return { name: 'shadowing' };
    case 'nghechinhta':
      return { name: 'nghechinhta' };
    case 'podcast':
      // Mã video YouTube = đúng 11 ký tự [A-Za-z0-9_-]; sai dạng thì coi như không có (về danh sách).
      // PodcastPage tự đọc lại #hash để đổi màn (video / danh sách phát) - hai trường này chỉ để biết thêm từ bên ngoài.
      return {
        name: 'podcast',
        videoId: /^[\w-]{11}$/.test(parts[1] || '') ? parts[1] : null,
        playlistId: parts[1] === 'ds' && parts[2] ? parts[2] : null,
      };
    case 'khoa':
      return parts[1] ? { name: 'course', courseId: parts[1], lessonId: parts[2] || null } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

/** Route hiện tại, tự cập nhật khi đổi #hash (bấm link, nút Quay lại/Tiến của trình duyệt). */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseHash(hash);
}

/** Đi tới 1 trang (thêm 1 mục vào lịch sử). replace=true: thay mục hiện tại, không thêm. */
export function navigate(href: string, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = href;
  }
}
