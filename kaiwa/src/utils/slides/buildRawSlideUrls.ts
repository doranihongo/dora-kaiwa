import { probeSlideImages } from './probeSlideImages';
import { mapLegacySlideLesson } from './legacySlides';

export interface RawSlideLesson {
  slideFolder?: string;
  slideExt?: string;
  slideCount?: number;
}

/**
 * Sinh danh sách URL ảnh slide công khai của 1 buổi học (LessonView.tsx) -
 * gom logic 2 nhánh slideCount/probe vào 1 chỗ.
 * @see Lesson.slideCount/slideFolder/slideExt (types.ts) - ưu tiên
 *   slideCount (không dò gì cả) nếu có, rơi về probeSlideImages.ts khi
 *   chưa điền.
 */
export async function buildRawSlideUrls(rawLesson: RawSlideLesson): Promise<string[]> {
  const lesson = mapLegacySlideLesson(rawLesson); // URL Cloudflare cũ -> /slides/ (xem legacySlides.ts)
  if (!lesson.slideFolder) return [];
  if (lesson.slideCount && lesson.slideCount > 0) {
    const base = lesson.slideFolder.endsWith('/') ? lesson.slideFolder : `${lesson.slideFolder}/`;
    const ext = lesson.slideExt || 'svg';
    return Array.from({ length: lesson.slideCount }, (_, i) => `${base}${i + 1}.${ext}`);
  }
  return probeSlideImages(lesson.slideFolder, { ext: lesson.slideExt });
}
