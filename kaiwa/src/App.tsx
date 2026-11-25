import { useEffect } from 'react';
import Home from './components/Home';
import LessonView from './components/LessonView';
import CourseDetail from './components/CourseDetail';
import ShadowingPage from './pages/ShadowingPage';
import DictationPage from './pages/DictationPage';
import PodcastPage from './pages/PodcastPage';
import useBodyScrollLock from './hooks/useBodyScrollLock';
import { useRoute, navigate, HREF } from './utils/route';

// Chia trang bằng #hash - xem utils/route.ts. Mỗi trang có địa chỉ riêng, nút Quay lại của trình duyệt
// đi đúng 1 màn:
//   #/            trang chủ        #/shadowing     trang Shadowing
//   #/khoa/<id>   trang khóa học   #/nghechinhta   trang Nghe chính tả
//   #/khoa/<id>/<buổi> buổi học    #/podcast       trang Nghe Podcast
export default function App() {
  const route = useRoute();
  const courseId = route.name === 'course' ? route.courseId : null;
  const lessonId = route.name === 'course' ? route.lessonId : null;

  // Trang khóa học/buổi học là màn toàn màn hình phủ lên trang chủ (trang chủ vẫn nằm phía sau nên về
  // lại giữ nguyên vị trí cuộn) - khóa cuộn trang chủ trong lúc đó. Dùng hook khóa chung có đếm lượt
  // (xem hooks/useBodyScrollLock.ts) như mọi popup khác.
  useBodyScrollLock(!!courseId);

  // Sang trang khác (tab/nút "<") thì đưa về đầu trang như khi mở 1 trang mới.
  useEffect(() => {
    if (route.name === 'shadowing' || route.name === 'nghechinhta' || route.name === 'podcast') window.scrollTo(0, 0);
  }, [route.name]);

  const goHome = () => navigate(HREF.home);

  if (route.name === 'shadowing') return <ShadowingPage />;
  if (route.name === 'nghechinhta') return <DictationPage />;
  if (route.name === 'podcast') return <PodcastPage />;

  return (
    <>
      <Home />

      {courseId && (
        <div key={courseId} id="course-detail-container" className="fixed inset-0 z-[100] bg-[#F0F6FF] overflow-hidden w-full flex flex-col">
          <CourseDetail
            courseId={courseId}
            onBack={goHome}
            onHome={goHome}
            onSelectLesson={(lId) => navigate(HREF.course(courseId, lId))}
          />
        </div>
      )}

      {courseId && lessonId && (
        <div key={lessonId} id="lesson-view-container" className="fixed inset-0 z-[200] bg-[#F0F6FF] overflow-hidden w-full flex flex-col">
          <LessonView
            courseId={courseId}
            lessonId={lessonId}
            onBack={() => navigate(HREF.course(courseId))}
            onHome={goHome}
          />
        </div>
      )}
    </>
  );
}
