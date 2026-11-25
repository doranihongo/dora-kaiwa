import { useState } from 'react';
import SiteNav from '../components/SiteNav';
import KaiwaModal from '../components/shadowing/KaiwaModal.jsx';
import VocabBookArt from '../components/art/VocabBookArt.jsx';

// 3 cuốn Kaiwa (id khớp MANUAL_PARTS_CONFIG và tên file public/data/sachkaiwa/ của shadowing/KaiwaModal.jsx).
// Hiện dạng THẺ CUỐN SÁCH (bìa vẽ sẵn VocabBookArt bên trái, chữ bên phải; cuốn đầu rộng hết hàng).
// cover = màu bìa (khoá màu của LEVEL_COVER); bai = số bài (ghi ở huy hiệu bìa và dòng cuối thẻ);
// caption = mô tả (dòng giữa).
const COURSES = [
  { id: '42baisotrungcap', title: 'Kaiwa N5-N3', caption: 'Hội thoại hàng ngày', cover: 'n4', bai: 42, wide: true },
  { id: 'nameraka', title: 'Kaiwa N3', caption: 'Hội thoại tự nhiên', cover: 'n3', bai: 23, wide: false },
  { id: '22baitrungthuongcap', title: 'Kaiwa N3-N1', caption: 'Theo các mối quan hệ', cover: 'n1', bai: 22, wide: false },
];

const NO_TAP = { WebkitTapHighlightColor: 'transparent' } as const;

// Trang "Shadowing" (#/shadowing): SÁCH KAIWA - 3 cuốn sách. Bấm 1 cuốn mở KaiwaModal (popup phủ kín màn hình,
// z cao hơn thanh công cụ) ngay ở màn "Chọn phần học" của cuốn đó; nút "Hướng dẫn học" mở popup với overlay
// Hướng dẫn. Đóng popup = chỉ đặt lại state của trang này (KHÔNG đổi route).
export default function ShadowingPage() {
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [openGuide, setOpenGuide] = useState(false);

  const closeModal = () => {
    setOpenCourseId(null);
    setOpenGuide(false);
  };

  return (
    <div className="min-h-dvh bg-[#F0F6FF] relative overflow-x-hidden">
      <SiteNav active="shadowing" />

      {/* pb-20 lg:pb-0: chừa chỗ cho thanh tab dưới CHỈ hiện trên điện thoại (xem SiteNav.tsx). */}
      <main className="pt-16 pb-20 lg:pb-0">
        {/* Đệm cuối rộng hơn (nút "Hướng dẫn học" nằm sát đáy): điện thoại 6rem + vùng an toàn iPhone, từ sm 6rem. */}
        <section className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pt-14 sm:pb-24">
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] uppercase text-[#1A2A54]">Sách Kaiwa</h1>
            <p className="mt-2 sm:mt-4 text-[#5B6B85] text-sm sm:text-lg max-w-2xl mx-auto">Luyện nói theo phương pháp Shadowing.</p>
          </div>

          {/* 3 cuốn sách Kaiwa: cuốn đầu rộng hết hàng (sm:col-span-2), hai cuốn sau nằm cạnh nhau; điện thoại xếp 1 cột. */}
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5" aria-label="Chọn sách Kaiwa">
            {COURSES.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => setOpenCourseId(course.id)}
                style={NO_TAP}
                className={`group bg-white p-4 sm:p-6 rounded-2xl border border-[#D3E4FC] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-3 sm:gap-6 w-full text-left cursor-pointer ${course.wide ? 'sm:col-span-2 sm:justify-center' : ''}`}
              >
                <span className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:-rotate-3">
                  <VocabBookArt kind="kaiwa" level={course.cover} badge={String(course.bai)} className="w-full h-full overflow-visible drop-shadow-lg" />
                </span>
                <span className="min-w-0 flex flex-col text-left">
                  <h3 className="text-lg sm:text-2xl font-black text-[#1A2A54] uppercase leading-tight whitespace-nowrap">{course.title}</h3>
                  <span className="mt-1 text-sm sm:text-base font-semibold text-[#5B6B85]">{course.caption}</span>
                  <span className="mt-1.5 text-[13px] sm:text-sm font-bold text-[#6B7A96] whitespace-nowrap">{course.bai} bài</span>
                </span>
              </button>
            ))}
          </div>

          {/* HƯỚNG DẪN HỌC - nút gọn căn giữa, dưới 3 thẻ; mở popup với overlay Hướng dẫn (initialGuideOpen). */}
          <div className="flex justify-center mt-10">
            <button
              type="button"
              onClick={() => setOpenGuide(true)}
              style={NO_TAP}
              className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-full group transition-all hover:border-indigo-300 hover:shadow-md active:scale-95 cursor-pointer"
            >
              <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
              </div>
              <span className="text-sm font-black text-indigo-900 uppercase tracking-wide">Hướng dẫn học</span>
            </button>
          </div>
        </section>
      </main>

      <KaiwaModal
        isOpen={!!openCourseId || openGuide}
        initialLevel={openCourseId}
        initialGuideOpen={openGuide}
        onClose={closeModal}
      />
    </div>
  );
}
