import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, MessageCircle, MessagesSquare, Lock, Unlock, Library, Users, X } from 'lucide-react';
import { useCourses } from '../CoursesContext';
import { isCourseAllowed } from '../utils/courses/courseAccess';
import { waitForAuthUser } from '../utils/authState';
import { HREF } from '../utils/route';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import SiteNav from './SiteNav';
import VocabBookArt from './art/VocabBookArt.jsx';
import VideoArt from './art/KaiwaVideoArt.jsx';

// 3 công cụ học - mỗi công cụ là 1 TRANG riêng (#/shadowing, #/nghechinhta, #/podcast), thẻ dạng "bìa sách"
// y hệt thẻ chọn của trang /kaiwa/ bên web Phá Đảo Tiếng Nhật (hình vẽ sẵn + tiêu đề + mô tả + dòng phụ).
const LEARNING_TOOLS = [
  { key: 'shadowing', href: HREF.shadowing, title: 'Sách kaiwa', caption: 'Nhập vai hội thoại theo bài', meta: '9 giáo trình' },
  { key: 'nghechinhta', href: HREF.nghechinhta, title: 'Nghe chính tả', caption: 'Chép chính tả & đục lỗ', meta: 'Nghe và chép lại' },
  { key: 'podcast', href: HREF.podcast, title: 'Video', caption: 'Shadowing theo người bản xứ', meta: 'N5-N1' },
] as const;

const OTHER_ITEMS = [
  { name: 'Tài liệu tham khảo', description: 'Thư viện tổng hợp', icon: Library },
  { name: 'Nhóm học tập', description: 'Trao đổi, thảo luận', icon: Users },
];

const CARD =
  'group bg-white rounded-2xl border border-[#D3E4FC] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all';

function ToolArt({ k }: { k: (typeof LEARNING_TOOLS)[number]['key'] }) {
  const cls = 'w-full h-full overflow-visible drop-shadow-lg';
  if (k === 'shadowing') return <VocabBookArt kind="kaiwa" level="n4" badge="10" className={cls} />;
  if (k === 'nghechinhta') return <VocabBookArt kind="chinhta" level="n3" badge="書" className={cls} />;
  return <VideoArt className={cls} />;
}

export default function Home() {
  const { courses } = useCourses();

  const [showContactPopup, setShowContactPopup] = useState(false);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);

  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  // window.__authUser.allowedCourses (cột `allowed_courses` trong `profiles`) - xem
  // utils/courses/courseAccess.ts. Đợi qua __authReady giống hệt userRole ở trên.
  const [allowedCourses, setAllowedCourses] = useState<string[]>([]);
  // true khi đã đọc xong window.__authUser (dù có hay không) - trong lúc false (mới mount, đang
  // đợi authGuard ở common.js) KHÔNG được coi khóa học là "đang khóa": nếu tính isAllowed ngay sẽ
  // nháy "Đang khóa" cho mọi khóa kể cả với tài khoản admin/giáo viên.
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // waitForAuthUser() tự đợi window.__authReady xuất hiện - xem utils/authState.ts.
    waitForAuthUser().then((authUser) => {
      setUserRole(authUser?.role);
      setAllowedCourses(Array.isArray(authUser?.allowedCourses) ? authUser.allowedCourses : []);
      setAuthChecked(true);
    });
  }, []);

  // Khóa cuộn nền cho các popup do CHÍNH trang chủ dựng (hook dùng chung có đếm lượt, xem hooks/useBodyScrollLock.ts).
  useBodyScrollLock(showContactPopup);
  useBodyScrollLock(isDocsModalOpen);

  return (
    <div className="min-h-dvh bg-[#F0F6FF] relative overflow-x-hidden">
      <SiteNav active={null} />

      {/* pt-16: chừa chỗ thanh trên cố định. pb-20 lg:pb-0: chừa chỗ thanh tab dưới (chỉ điện thoại). */}
      <main className="pt-16 pb-20 lg:pb-0 min-h-dvh flex flex-col">
        <section className="max-w-5xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-14 sm:pb-14 flex-1">
          {/* TIÊU ĐỀ - cỡ chữ/màu y hệt tiêu đề các trang của web Phá Đảo. */}
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] uppercase text-[#1A2A54]">Kaiwa tiếng Nhật</h1>
            <p className="mt-2 sm:mt-4 text-[#5B6B85] text-sm sm:text-lg max-w-2xl mx-auto">Thành thạo trong 3 tháng</p>
          </div>

          {/* KHÓA HỌC */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 lg:gap-6" aria-label="Khóa học">
            {courses.map((course) => {
              // Chưa đọc xong window.__authUser (authChecked=false) -> coi tạm là "được phép" để KHÔNG nháy
              // nhãn "Đang khóa" sai cho admin/giáo viên. Lỡ bấm vào lúc này mà hóa ra không được phép thì
              // CourseDetail.tsx tự kiểm tra lại trước khi hiện nội dung.
              const isAllowed = !authChecked || isCourseAllowed({ role: userRole, allowedCourses }, course.id);
              return (
                <a
                  key={course.id}
                  href={isAllowed ? HREF.course(course.id) : HREF.home}
                  onClick={(e) => {
                    if (!isAllowed) {
                      e.preventDefault();
                      setShowContactPopup(true); // popup liên hệ mở khóa
                    }
                  }}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className={`${CARD} overflow-hidden flex flex-col text-left h-full ${isAllowed ? '' : 'hover:border-red-300'}`}
                >
                  <div className="h-36 sm:h-40 w-full relative overflow-hidden bg-[#E3EEFF]">
                    {course.imageUrl ? (
                      <img
                        src={course.imageUrl}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#2F7DF6]/40">
                        <MessagesSquare className="w-14 h-14" strokeWidth={1.6} />
                      </div>
                    )}
                    {!isAllowed && (
                      <div className="absolute top-3 right-3 bg-white/95 border border-[#D3E4FC] px-3 py-1.5 rounded-full text-xs font-bold text-[#5B6B85] shadow-sm flex items-center gap-1.5 z-10">
                        {/* 2 icon nằm sẵn trong 1 khung cố định, đổi qua opacity (không dùng hidden/display) - tránh tranh chấp CSS. */}
                        <span className="relative w-3.5 h-3.5 shrink-0">
                          <Lock className="w-3.5 h-3.5 text-red-500 absolute inset-0 transition-opacity duration-150 group-hover:opacity-0" />
                          <Unlock className="w-3.5 h-3.5 text-red-500 absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </span>
                        Đang khóa
                      </div>
                    )}
                  </div>

                  <div className="w-full p-4 sm:p-5 flex flex-col flex-1">
                    <h3 className="text-lg sm:text-xl font-black uppercase leading-tight text-[#1A2A54]">{course.title}</h3>
                    <p className="mt-1.5 mb-4 text-sm font-semibold text-[#5B6B85] leading-relaxed flex-1">{course.description}</p>

                    {isAllowed ? (
                      <span className="w-full bg-[#E3EEFF] text-[#2F7DF6] font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 group-hover:bg-[#2F7DF6] group-hover:text-white transition-colors">
                        Học ngay <ChevronRight className="w-5 h-5" />
                      </span>
                    ) : (
                      <span className="w-full bg-[#F0F6FF] text-[#8B9BB8] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 border border-[#D3E4FC] group-hover:bg-red-50 group-hover:text-red-500 group-hover:border-red-200 transition-colors">
                        MỞ KHÓA
                        <span className="relative w-5 h-5 shrink-0">
                          <Lock className="w-5 h-5 absolute inset-0 transition-opacity duration-150 group-hover:opacity-0" />
                          <Unlock className="w-5 h-5 absolute inset-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                        </span>
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>

          {/* CÔNG CỤ HỌC TẬP - mỗi thẻ dẫn sang 1 trang riêng. */}
          <h2 className="mt-14 sm:mt-20 mb-4 sm:mb-6 text-center text-xl sm:text-2xl font-black uppercase tracking-tight text-[#1A2A54]">
            Công cụ học tập
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5 lg:gap-6" aria-label="Công cụ học tập">
            {LEARNING_TOOLS.map((tool) => (
              <a
                key={tool.key}
                href={tool.href}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={`${CARD} p-4 sm:p-6 flex items-center gap-3 sm:flex-col sm:gap-4 w-full text-left sm:text-center`}
              >
                <span className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:-rotate-3">
                  <ToolArt k={tool.key} />
                </span>
                <span className="min-w-0 flex flex-col">
                  <h3 className="text-lg sm:text-xl font-black text-[#1A2A54] uppercase leading-tight">{tool.title}</h3>
                  <span className="mt-1 text-sm sm:text-base font-semibold text-[#5B6B85]">{tool.caption}</span>
                  <span className="mt-1.5 text-[13px] sm:text-sm font-bold text-[#6B7A96]">{tool.meta}</span>
                </span>
              </a>
            ))}
          </div>

          {/* TÀI NGUYÊN & CỘNG ĐỒNG */}
          <h2 className="mt-14 sm:mt-20 mb-4 sm:mb-6 text-center text-xl sm:text-2xl font-black uppercase tracking-tight text-[#1A2A54]">
            Tài nguyên &amp; Cộng đồng
          </h2>
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5" aria-label="Tài nguyên và cộng đồng">
            {OTHER_ITEMS.map((item) => {
              const Icon = item.icon;
              const open = () => {
                if (item.name === 'Tài liệu tham khảo') setIsDocsModalOpen(true);
                else if (item.name === 'Nhóm học tập') window.open('https://www.facebook.com/groups/thithujlptmienphi', '_blank');
              };
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={open}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                  className={`${CARD} p-4 flex items-center gap-4 w-full text-left`}
                >
                  <span className="w-12 h-12 shrink-0 rounded-xl bg-[#E3EEFF] text-[#2F7DF6] flex items-center justify-center group-hover:bg-[#2F7DF6] group-hover:text-white transition-colors">
                    <Icon className="w-6 h-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-black text-[#1A2A54]">{item.name}</span>
                    <span className="block mt-0.5 text-sm font-semibold text-[#5B6B85]">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="py-6 px-6 border-t border-[#D3E4FC] flex flex-col-reverse sm:flex-row items-center justify-between gap-4 text-[#6B7A96] text-xs font-semibold tracking-widest">
          <div className="text-center sm:text-left">© 2026 DORA VIETNAM</div>
          <div className="flex items-center gap-2">
            <a href="https://www.facebook.com/HocvienDora" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-9 h-9 flex items-center justify-center text-[#6B7A96] hover:text-[#2F7DF6] transition-colors">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.tiktok.com/@phadaotiengnhat" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-9 h-9 flex items-center justify-center text-[#6B7A96] hover:text-[#2F7DF6] transition-colors">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 448 512"><path d="M448,209.91a210.06,210.06,0,0,1-122.77-39.25V349.38A162.55,162.55,0,1,1,185,188.31V278.2a74.62,74.62,0,1,0,52.23,71.18V0l88,0a121.18,121.18,0,0,0,1.86,22.17h0A122.18,122.18,0,0,0,381,102.39a121.43,121.43,0,0,0,67,20.14Z"/></svg>
            </a>
            <a href="https://zalo.me/0332660529" target="_blank" rel="noopener noreferrer" aria-label="Zalo" className="w-9 h-9 flex items-center justify-center text-[#6B7A96] hover:text-[#2F7DF6] transition-colors">
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </footer>
      </main>

      {isDocsModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#1A2A54]/40 p-4 animate-in fade-in duration-200" onClick={() => setIsDocsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-[#D3E4FC] flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#D3E4FC] flex justify-between items-center bg-[#F0F6FF]">
              <h3 className="text-sm font-black text-[#1A2A54] uppercase flex items-center gap-2">
                <Library className="w-5 h-5 text-[#2F7DF6]" />
                Tài liệu học tập
              </h3>
              <button type="button" onClick={() => setIsDocsModalOpen(false)} aria-label="Đóng" className="text-[#6B7A96] hover:text-[#2F7DF6] p-1 rounded-lg hover:bg-[#E3EEFF] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
              <a href="https://drive.google.com/drive/folders/19JT79eX8-xn6jweibSj8vzxnugJwjI4C" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-[#D3E4FC] hover:border-[#2F7DF6] hover:bg-[#F0F6FF] transition-all group">
                <div className="w-10 h-10 bg-[#E3EEFF] text-[#2F7DF6] rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A2A54] truncate pb-1">Sách luyện đề JLPT (N5-N1)</p>
                  <p className="text-[10px] font-semibold text-[#6B7A96]">15 quyển</p>
                </div>
                <svg className="w-4 h-4 text-[#8B9BB8] group-hover:text-[#2F7DF6]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>

              <a href="https://www.facebook.com/groups/thithujlptmienphi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-[#D3E4FC] hover:border-[#2F7DF6] hover:bg-[#F0F6FF] transition-all group">
                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A2A54] truncate pb-1">Hàng trăm tài liệu khác...</p>
                  <p className="text-[10px] font-semibold text-[#6B7A96]">Tham gia nhóm tự học</p>
                </div>
                <svg className="w-4 h-4 text-[#8B9BB8] group-hover:text-[#2F7DF6]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>

            <div className="p-4 pt-2">
              <button type="button" onClick={() => setIsDocsModalOpen(false)} className="w-full py-3 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95">
                ĐÓNG
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactPopup && (
        <div className="fixed inset-0 bg-[#1A2A54]/40 z-[9999] flex items-center justify-center p-4" onClick={() => setShowContactPopup(false)}>
          <div className="bg-white border border-[#D3E4FC] rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative z-10 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-[#E3EEFF] text-[#2F7DF6] rounded-full flex items-center justify-center mb-2">
                <BookOpen className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-black text-[#1A2A54]">Mở Khóa Khóa Học</h3>
              <p className="text-[#5B6B85] text-sm mb-4 leading-relaxed font-medium">
                Khóa học này hiện đang bị khóa. Hãy liên hệ với chúng tôi qua Facebook hoặc Zalo để mua khóa học và được cấp quyền truy cập.
              </p>

              <div className="flex w-full gap-3">
                <a href="https://m.me/874210086055767" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#1877F2] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </a>
                <a href="https://zalo.me/0332660529" target="_blank" rel="noopener noreferrer" className="flex-1 bg-[#0068FF] text-white py-3 rounded-xl font-bold text-sm shadow-md hover:bg-[#005AE0] transition-colors flex items-center justify-center gap-2">
                  <MessageCircle className="w-5 h-5 fill-white" />
                  Zalo
                </a>
              </div>

              <button type="button" onClick={() => setShowContactPopup(false)} className="mt-2 w-full py-2.5 text-[#6B7A96] font-bold hover:bg-[#F0F6FF] rounded-xl transition-colors">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
