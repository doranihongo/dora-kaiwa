import { useState } from 'react';
import Home from './components/Home';
import LessonView from './components/LessonView';
import CourseDetail from './components/CourseDetail';
import useBodyScrollLock from './hooks/useBodyScrollLock';

export default function App() {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // Trang khóa học/buổi học là overlay toàn màn hình phủ lên trang chủ - khóa
  // cuộn trang chủ phía sau trong lúc overlay đang mở. Dùng hook khóa chung
  // (có đếm lượt, xem hooks/useBodyScrollLock.ts) như mọi popup khác, thay vì
  // tự ghi style lên <body> ở đây.
  //
  // Nút tài khoản nằm trong thanh điều hướng của Home (UserAccountMenu) nên
  // overlay (z-[100]/z-[200]) tự đè lên nó - không còn phải ẩn/hiện bằng tay.
  useBodyScrollLock(!!activeCourseId || !!activeLessonId);

  const navToHome = () => {
    setActiveCourseId(null);
    setActiveLessonId(null);
  };

  return (
    <>
      <Home
        onSelectCourse={(cId) => setActiveCourseId(cId)}
        onLogout={() => {}}
      />

      {activeCourseId && (
        <div key={activeCourseId} id="course-detail-container" className="fixed inset-0 z-[100] bg-[linear-gradient(315deg,#16324f_0%,#24406b_45%,#345da7_100%)] overflow-hidden w-full flex flex-col">
          <CourseDetail
            courseId={activeCourseId}
            onBack={() => setActiveCourseId(null)}
            onHome={navToHome}
            onSelectLesson={(lId) => setActiveLessonId(lId)}
          />
        </div>
      )}

      {activeCourseId && activeLessonId && (
        <div key={activeLessonId} id="lesson-view-container" className="fixed inset-0 z-[200] bg-[linear-gradient(315deg,#16324f_0%,#24406b_45%,#345da7_100%)] overflow-hidden w-full flex flex-col">
          <LessonView
            courseId={activeCourseId}
            lessonId={activeLessonId}
            onBack={() => setActiveLessonId(null)}
            onHome={navToHome}
          />
        </div>
      )}
    </>
  );
}
