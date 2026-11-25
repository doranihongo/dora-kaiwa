import { useState, useEffect } from 'react';
import { ChevronLeft, PlayCircle, ChevronRight, ChevronDown, Check, Lock, MessagesSquare } from 'lucide-react';
import { useCourses } from '../CoursesContext';
import { isCourseAllowed } from '../utils/courses/courseAccess';
import { waitForAuthUser } from '../utils/authState';
import { getCourseStages } from '../utils/courses/courseStages';


export default function CourseDetail({ courseId, onBack, onHome, onSelectLesson }: {
  courseId: string,
  onBack: () => void,
  onHome: () => void,
  onSelectLesson: (lId: string) => void
}) {
  const { courses, loadedCourseDetails, loadCourseDetails, detailsLoading } = useCourses();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // Tập hợp chặng đang mở (accordion "KHỞI ĐỘNG/TĂNG TỐC/VỀ ĐÍCH" - xem
  // utils/courseStages.ts) - mỗi chặng đóng/mở ĐỘC LẬP (mở chặng này không
  // tự đóng chặng khác), khác với accordion Từ vựng/Ngữ pháp trong
  // LessonView.tsx (chỉ 1 mục mở tại 1 thời điểm).
  const [openStages, setOpenStages] = useState<Set<number>>(new Set());

  const toggleStage = (stageIdx: number) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageIdx)) next.delete(stageIdx);
      else next.add(stageIdx);
      return next;
    });
  };

  // Lớp phòng thủ thứ 2 - Home.tsx đã chặn không cho bấm vào khóa chưa
  // được cấp quyền rồi (onSelectCourse chỉ gọi khi isAllowed), nhưng vẫn
  // tự kiểm tra lại ở đây cho chắc (không tin tưởng hoàn toàn component
  // cha). undefined lúc mới mount (đợi __authReady) -> coi như CHƯA xác
  // định, không phải "bị khóa" - tránh nháy nhầm màn khóa trước khi kịp
  // đọc xong window.__authUser.
  const [authUser, setAuthUser] = useState<any>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    // waitForAuthUser() tự đợi window.__authReady xuất hiện rồi mới đọc,
    // thay vì coi ngay là "chưa đăng nhập" nếu authGuard (common.js) chưa
    // kịp chạy tới - xem giải thích đầy đủ trong utils/authState.ts.
    waitForAuthUser().then((authUser) => {
      setAuthUser(authUser);
      setAuthChecked(true);
    });
  }, []);
  const isAllowed = isCourseAllowed(authUser, courseId);

  useEffect(() => {
    const container = document.getElementById('course-detail-container');
    if (!container) return;

    if (showExitConfirm) {
      container.style.overflow = 'hidden';
    } else {
      container.style.overflow = '';
    }
    return () => {
      container.style.overflow = '';
    };
  }, [showExitConfirm]);

  useEffect(() => {
    loadCourseDetails(courseId);
  }, [courseId]);

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );
  
  let learnedLessons: Record<string, boolean> = {};
  try {
    const saved = localStorage.getItem('phadao_learned_lessons');
    if (saved) learnedLessons = JSON.parse(saved);
  } catch {}

  if (!course) return <div className="p-8 text-center text-[#1A2A54] font-bold min-h-screen">Không tìm thấy khóa học</div>;

  if (!authChecked) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-[#2F7DF6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center gap-4">
        <Lock className="w-12 h-12 text-[#8B9BB8]" />
        <p className="text-[#1A2A54] font-bold text-lg">Tài khoản của bạn chưa được cấp quyền truy cập khóa học này.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white font-bold rounded-xl transition-colors">
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];
  // null = khóa chưa được cấu hình chia chặng -> hiển thị phẳng như cũ.
  const courseStages = getCourseStages(course.title, lessons);

  // `number` = STT hiển thị (1-based), tính sẵn ở nơi gọi để giữ đúng thứ
  // tự liên tục qua các chặng thay vì reset về 1 mỗi chặng.
  const renderLessonButton = (lesson: any, number: number) => {
    const isLearned = learnedLessons[`${courseId}_${lesson.id}`];
    return (
      <button
        key={lesson.id}
        onClick={() => onSelectLesson(lesson.id)}
        className="w-full bg-white p-3 md:p-4 rounded-2xl border border-[#D3E4FC] shadow-sm hover:shadow-md hover:border-[#B6D0F7] hover:-translate-y-0.5 transition-all flex items-center gap-3 md:gap-5 group text-left cursor-pointer"
      >
        <div className={`w-12 h-12 md:w-14 md:h-14 flex-shrink-0 ${isLearned ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-[#E3EEFF] text-[#2F7DF6] border-[#D3E4FC] group-hover:bg-[#2F7DF6] group-hover:text-white group-hover:border-[#2F7DF6]'} border rounded-xl flex items-center justify-center text-base md:text-lg font-black transition-colors`}>
          {isLearned ? <Check className="w-6 h-6 md:w-7 md:h-7 stroke-[3]" /> : String(number).padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold leading-snug text-[#1A2A54] group-hover:text-[#2F7DF6] transition-colors break-words">{lesson.title}</h3>
        </div>
        <div className="hidden md:flex bg-[#E3EEFF] text-[#2F7DF6] font-bold items-center gap-1.5 pl-5 pr-4 py-2.5 rounded-xl group-hover:bg-[#2F7DF6] group-hover:text-white transition-colors">
          Vào học <ChevronRight className="w-5 h-5" />
        </div>
        <ChevronRight className="md:hidden w-5 h-5 shrink-0 text-[#8B9BB8] group-hover:text-[#2F7DF6] transition-colors" strokeWidth={2.5} />
      </button>
    );
  };

  return (
    // min-h-full (không phải h-full) + shrink-0: div này là con flex của
    // #course-detail-container (App.tsx, overflow-y-auto + flex flex-col) -
    // nếu để h-full, height:100% trở thành flex-basis cố định đúng 1
    // màn hình, rồi flex-shrink mặc định (1) co nó lại vừa đúng 1 màn hình
    // dù <main> bên dưới dài hơn nhiều - khiến containing block của nav
    // sticky chỉ cao đúng 1 viewport, cuộn qua khỏi đó là nav biến mất
    // (bug "vuốt xuống danh sách buổi học thì thanh trên cùng bị ẩn").
    // min-h-full + shrink-0: sàn tối thiểu 1 màn hình khi nội dung ngắn,
    // nhưng không bị ép co lại khi nội dung dài hơn - đi kèm flex-auto
    // (không phải flex-1) ở <main> bên dưới, xem comment ở đó.
    <div className="h-full min-h-0 flex flex-col font-sans">
      {/* Thanh đầu sáng - y hệt InnerNav của web Phá Đảo Tiếng Nhật: nút "<" tròn + tên trang quay về
          (ở đây là tên khóa) + nút TRANG CHỦ viên thuốc. */}
      <nav className="flex-shrink-0 bg-[#F0F6FF] border-b border-[#D3E4FC] z-50" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onBack}
                aria-label="Quay lại trang chủ"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={3} />
              </button>
              <span className="text-base sm:text-lg font-black text-[#1A2A54] uppercase truncate">{course.title}</span>
            </div>
            <button
              onClick={() => setShowExitConfirm(true)}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              className="inline-flex items-center px-4 h-10 bg-[#DCEAFE] hover:bg-[#BFDBFE] active:scale-95 transition-all rounded-full text-sm font-bold text-[#2F7DF6] shadow-sm flex-shrink-0 whitespace-nowrap"
            >
              TRANG CHỦ
            </button>
          </div>
        </div>
      </nav>

      {/* flex-auto (flex-basis: auto), không phải flex-1 (flex-basis: 0%):
          flex-basis 0% khiến trình duyệt tính "kích thước tự nhiên" của
          main bằng 0 khi đo kích thước nội dung cho div cha ở trên - danh
          sách buổi học dài bao nhiêu cũng không kéo div cha (chứa nav
          sticky) cao ra theo, xem comment ở div cha. */}
      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
      <main className="w-full px-3.5 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-8 sm:gap-10">
        {/* Hero Section - thẻ trắng viền #D3E4FC như thẻ khóa học ở trang chủ */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#D3E4FC]">
          <div className="h-44 sm:h-64 w-full relative bg-[#E3EEFF]">
              {course.imageUrl ? (
                <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#2F7DF6]/40">
                  <MessagesSquare className="w-16 h-16" strokeWidth={1.6} />
                </div>
              )}
              <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 right-4 flex flex-wrap gap-2 items-end pointer-events-none">
                  <div className="bg-white/95 border border-[#D3E4FC] px-3.5 py-1.5 rounded-full text-xs font-bold text-[#2F7DF6] shadow-sm flex items-center gap-1.5">
                    <PlayCircle className="w-4 h-4" />
                    <span>{lessons.length} Buổi học</span>
                  </div>
              </div>
          </div>
          <div className="p-5 md:p-8 flex flex-col gap-2 sm:gap-3">
              <h1 className="text-2xl md:text-4xl font-black uppercase leading-tight text-[#1A2A54]">{course.title}</h1>
              <p className="text-sm md:text-lg text-[#5B6B85] font-semibold leading-relaxed">{course.description}</p>
          </div>
        </div>

        {/* Lesson List */}
        <div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#1A2A54] mb-4 sm:mb-6 flex items-center gap-3">
            <PlayCircle className="w-6 h-6 sm:w-7 sm:h-7 text-[#2F7DF6]" />
            Danh sách các buổi học
          </h2>
          {detailsLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-10 h-10 border-4 border-[#2F7DF6] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : courseStages ? (
            /* Chia chặng (KHỞI ĐỘNG/TĂNG TỐC/VỀ ĐÍCH) - accordion, bấm tiêu
               đề mới trượt ra danh sách buổi trong chặng đó ngay tại chỗ (vị
               trí tiêu đề giữ nguyên, không tự cuộn trang) - mỗi chặng đóng/mở
               độc lập, không tự đóng chặng khác (xem cơ chế grid-rows y hệt
               accordion Từ vựng/Ngữ pháp trong LessonView.tsx). */
            <div className="flex flex-col gap-4">
              {courseStages.map((stage, stageIdx) => {
                const isOpen = openStages.has(stageIdx);
                return (
                  <div
                    key={stage.label}
                    className={`rounded-2xl overflow-hidden border bg-white transition-all duration-300 ${isOpen ? 'border-[#2F7DF6]/60 shadow-md' : 'border-[#D3E4FC] shadow-sm hover:border-[#B6D0F7]'}`}
                  >
                    <button
                      onClick={() => toggleStage(stageIdx)}
                      className={`relative w-full flex items-center justify-center px-12 py-4 font-bold transition-all duration-300 ${isOpen ? 'bg-[#2F7DF6] text-white' : 'bg-white text-[#1A2A54] hover:bg-[#E3EEFF]'}`}
                      aria-expanded={isOpen}
                    >
                      <span className="flex items-center gap-2 uppercase tracking-wide text-sm md:text-base">
                        {stage.label}
                        <span className="text-[11px] font-semibold opacity-70 normal-case">({stage.lessons.length} buổi)</span>
                      </span>
                      <ChevronDown className={`w-5 h-5 shrink-0 absolute right-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="p-3 sm:p-4 bg-[#F0F6FF] border-t border-[#D3E4FC] space-y-3">
                          {stage.lessons.map((lesson: any, i: number) =>
                            renderLessonButton(lesson, stage.startIndex + i + 1)
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson: any, index: number) => renderLessonButton(lesson, index + 1))}
            </div>
          )}
        </div>
        </div>
      </main>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-[#1A2A54]/40 z-[100] flex items-center justify-center p-4 overscroll-none">
          <div className="bg-white border border-[#D3E4FC] rounded-2xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black uppercase text-[#1A2A54] mb-2">Thoát khóa học</h3>
            <p className="text-[#5B6B85] font-medium mb-8">Bạn có chắc chắn muốn quay về trang chủ?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-[#2F7DF6] bg-[#E3EEFF] hover:bg-[#D3E4FC] transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={onHome}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-[#2F7DF6] hover:bg-[#1E5FD9] shadow-sm transition-all"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
