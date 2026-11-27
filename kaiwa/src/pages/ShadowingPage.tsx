import { useEffect, useRef, useState, type ComponentType } from 'react';
import SiteNav from '../components/SiteNav';
import InnerNav from '../components/shadowing/InnerNav.jsx';
import KaiwaModal from '../components/shadowing/KaiwaModal.jsx';
import KaiwaBookArt from '../components/shadowing/KaiwaBookArt.jsx';
import { previewParts, donViOf } from '../components/shadowing/kaiwaParts.js';
import { loadCourse, getCachedCourse } from '../components/shadowing/kaiwaLoader.js';
import { useDaXem, khoaPhan } from '../components/shadowing/kaiwaDaXem.js';
import { parseKaiwaHash, setKaiwaHash, bookHref } from '../components/shadowing/kaiwaRoute.js';
import { HREF } from '../utils/route';

type Course = { id: string; title: string; nhan: string[]; bai: number; mota: string };

// Hình minh hoạ của từng cuốn (file .jsx chép nguyên - khai kiểu ở đây)
const BookArt = KaiwaBookArt as unknown as ComponentType<{ id: string; className?: string }>;

// Các giáo trình Kaiwa - chép từ KaiwaPage.jsx (/kaiwa/giaotrinh/) của web Phá Đảo Tiếng Nhật, đúng thứ tự.
// id khớp PARTS_CONFIG ở components/shadowing/kaiwaParts.js và tên file sachkaiwa<id>.json trên VPS.
// bai = số bài ghi ở thẻ sách; nhan = nhãn trình độ; mota = giới thiệu ở đầu trang của cuốn.
const COURSES: Course[] = [
  { id: '700caugiaotiepcoban', title: '700 câu cơ bản N5', nhan: ['Sơ cấp'], bai: 91,
    mota: 'Những câu giao tiếp thiết yếu cho người mới học, đi từ chào hỏi, chức năng giao tiếp, ngữ pháp đến tình huống và chủ đề đời sống. Mỗi bài là hội thoại ngắn có audio để nghe và nói theo.' },
  { id: '200cumsieungan', title: '200 câu ngắn dùng ngay', nhan: ['Sơ cấp', 'Trung cấp'], bai: 200,
    mota: '200 câu ngắn người Nhật nói rất thường xuyên, chia theo việc muốn nói như ngạc nhiên, hỏi lại, nhờ vả, khuyên nhủ, phụ họa. Mỗi câu có giải thích cách dùng và hội thoại mẫu.' },
  { id: '42baisotrungcap', title: 'Kaiwa hàng ngày', nhan: ['Sơ cấp', 'Trung cấp'], bai: 42,
    mota: '42 bài hội thoại đời thường chia 5 phần theo độ khó tăng dần, từ câu chào và đáp ngắn đến những tình huống giao tiếp quen thuộc hằng ngày. Mỗi bài gồm nhiều tình huống nhỏ để nghe và nói theo từng câu.' },
  { id: '210cumsieungan', title: '210 câu ngắn dùng ngay', nhan: ['Trung cấp', 'Cao cấp'], bai: 210,
    mota: '210 câu ngắn khẩu ngữ mức trung – thượng cấp, xếp theo việc muốn nói: đồng ý, khen, phàn nàn, từ chối, nhờ vả… Mỗi câu có giải thích sắc thái và hội thoại mẫu.' },
  { id: 'nameraka', title: 'Kaiwa tự nhiên', nhan: ['Trung cấp'], bai: 23,
    mota: 'Học cách người Nhật thật sự nói trong hội thoại: dạng rút gọn (てる, ちゃ, って), lược trợ từ, nói lấp lửng, đảo trật tự từ. Có thêm cách từ chối, hỏi, cảm ơn, xin lỗi nghe tự nhiên.' },
  { id: '22baitrungthuongcap', title: 'Kaiwa theo mối quan hệ', nhan: ['Trung cấp', 'Cao cấp'], bai: 41,
    mota: 'Hội thoại chia theo người đối thoại: gia đình, bạn bè, hàng xóm, nhân viên cửa hàng, đồng nghiệp, cấp trên… để biết đổi mức độ lịch sự cho đúng quan hệ. Cuối giáo trình có các bài dài như khiếu nại, phỏng vấn, lễ cưới, thuyết trình.' },
  { id: '180bieudatcamxuc', title: '180 cách diễn đạt cảm xúc', nhan: ['Sơ cấp', 'Trung cấp'], bai: 180,
    mota: '180 cách nói khẩu ngữ để diễn đạt cảm xúc: vui mừng, ngạc nhiên, lo lắng, tức giận, thất vọng, bất mãn… Mỗi mục có nghĩa, sắc thái và hội thoại mẫu để dùng đúng hoàn cảnh.' },
  { id: '125maucaumorong', title: '125 mẫu mở rộng', nhan: ['Trung cấp'], bai: 125,
    mota: '125 mẫu câu và từ đệm của văn nói như 〜かと, 〜からって, 〜というか, cùng cách hùa theo, ngập ngừng, phủ định nhẹ giúp câu chuyện nghe tự nhiên. Học qua hội thoại ngắn kèm giải thích cách dùng.' },
  { id: '180cachnoiquenthuoc', title: '180 quán dụng ngữ', nhan: ['Trung cấp', 'Cao cấp'], bai: 180,
    mota: '180 quán dụng ngữ của người Nhật, xếp theo ý nghĩa: gặp may, làm việc nhanh gọn, bận rộn, đánh giá người… Mỗi mục có giải thích nghĩa, cách dùng và hội thoại mẫu.' },
  { id: 'tuongthanhtuonghinh', title: '185 từ tượng thanh, tượng hình', nhan: ['Sơ cấp', 'Trung cấp', 'Cao cấp'], bai: 185,
    mota: '185 từ tượng thanh, tượng hình người Nhật dùng hằng ngày như ペラペラ, ザーザー, ドキドキ, chia theo hành động, trạng thái sự vật, cơ thể và cảm xúc. Mỗi từ có giải thích nghĩa, dạng hay đi kèm và hội thoại mẫu.' },
];

const NO_TAP = { WebkitTapHighlightColor: 'transparent' } as const;

const readHash = (): Course | null => {
  const { slug } = parseKaiwaHash();
  return COURSES.find((c) => c.id.toLowerCase() === slug) || null;
};
// Phần (0-based) đang mở theo địa chỉ, hoặc null (không có / sai số phần)
const phanTheoDiaChi = (): number | null => {
  const c = readHash();
  const r = parseKaiwaHash();
  return c && r.part != null && r.part <= previewParts(c.id).length ? r.part - 1 : null;
};

// Thân trang của 1 cuốn: danh sách PHẦN, mỗi phần 1 hàng (số thứ tự + tên phần + số bài).
function KaiwaPartList({ course, onOpenPart, dangMo }: { course: Course; onOpenPart: (i: number) => void; dangMo: number | null }) {
  const parts: { title: string; count: number }[] = previewParts(course.id);
  const daXem = useDaXem(); // phần đã mở xem -> màu TÍM, lưu theo phiên
  useEffect(() => { loadCourse(course.id).catch(() => {}); }, [course.id]); // tải trước để bấm phần là mở liền
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-2.5 sm:gap-3" aria-label={`Các phần của ${course.title}`}>
      {parts.map((p, i) => {
        const xem = daXem(khoaPhan(course.id, i));
        return (
          <button
            key={i}
            type="button"
            onClick={() => onOpenPart(i)}
            disabled={dangMo !== null}
            aria-busy={dangMo === i}
            style={NO_TAP}
            className={`group w-full border rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 text-left shadow-sm transition-all active:scale-[0.98] cursor-pointer bg-white md:hover:border-[#7FB0F9] md:hover:shadow-md ${xem ? 'border-[#DDD6FE]' : 'border-[#D3E4FC]'}`}
          >
            <span className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl font-black text-base sm:text-lg flex items-center justify-center tabular-nums ${xem ? 'bg-[#EDE9FE] text-[#7C3AED]' : 'bg-[#E3EEFF] text-[#2F7DF6]'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1 flex flex-col">
              <span className={`text-base sm:text-lg font-black leading-snug break-words transition-colors ${xem ? 'text-[#7C3AED] md:group-hover:text-[#6D28D9]' : 'text-[#1A2A54] md:group-hover:text-[#2F7DF6]'}`}>{p.title}</span>
              <span className="mt-1 text-xs sm:text-[13px] font-bold text-[#6B7A96]">{dangMo === i ? 'Đang tải…' : `${p.count} ${donViOf(course.id)}`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Trang "Sách kaiwa" (#/shadowing): danh sách giáo trình -> trang của cuốn (#/shadowing/<id>, các PHẦN) -> popup danh sách
// bài -> màn luyện tập (KaiwaModal). Dữ liệu và file nghe lấy từ VPS (utils/kaiwaApi.ts).
export default function ShadowingPage() {
  const [sach, setSach] = useState<Course | null>(readHash);
  const [openPartIdx, setOpenPartIdx] = useState<number | null>(phanTheoDiaChi); // vào bằng link có phần thì mở sẵn
  const [openGuide, setOpenGuide] = useState(false);
  const savedScroll = useRef(0); // vị trí cuộn của danh sách các cuốn, để lùi từ trang cuốn về đúng chỗ cũ
  const [dangMo, setDangMo] = useState<number | null>(null); // phần vừa bấm nhưng dữ liệu cuốn chưa tải xong

  // Bấm 1 phần: có dữ liệu sẵn -> mở popup ngay; chưa có (mạng chậm) -> chờ xong rồi mới mở, hàng vừa bấm ghi "Đang tải…".
  const moPhan = async (i: number) => {
    if (!sach || dangMo !== null) return;
    const id = sach.id;
    if (!getCachedCourse(id)) {
      setDangMo(i);
      try { await loadCourse(id); } catch { /* popup tự báo lỗi nếu vẫn không tải được */ }
      setDangMo(null);
      if (readHash()?.id !== id) return; // trong lúc chờ đã đổi sang cuốn khác
    }
    setKaiwaHash(id, i + 1, null); // ghi địa chỉ trước khi mở popup (KaiwaModal đọc lại lúc mở)
    setOpenPartIdx(i);
  };

  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash.startsWith(HREF.shadowing)) return; // đang rời trang
      const next = readHash();
      setSach((prev) => {
        if (prev?.id !== next?.id) {
          // vào trang cuốn: lên đầu trang; lùi về danh sách: quay lại đúng chỗ đã cuộn
          if (next) window.scrollTo(0, 0);
          else requestAnimationFrame(() => window.scrollTo(0, savedScroll.current));
        }
        return next;
      });
      setOpenPartIdx(phanTheoDiaChi());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const closeModal = () => {
    if (sach && openPartIdx !== null) setKaiwaHash(sach.id, null, null); // đóng popup -> địa chỉ về trang của cuốn
    setOpenPartIdx(null);
    setOpenGuide(false);
  };

  // Thanh InnerNav của trang cuốn: nút CHỌN GIÁO TRÌNH (bảng thả xuống đủ các cuốn, 2 mũi tên sách trước/sau)
  const idx = sach ? COURSES.findIndex((c) => c.id === sach.id) : -1;
  const navTab = sach ? {
    key: 'chon-sach',
    label: 'Chọn giáo trình',
    prevHref: idx > 0 ? bookHref(COURSES[idx - 1].id) : null,
    nextHref: idx < COURSES.length - 1 ? bookHref(COURSES[idx + 1].id) : null,
    menuWidth: 'w-72',
    menu: COURSES.map((c) => ({ key: c.id, label: c.title, href: bookHref(c.id), active: c.id === sach.id })),
  } : null;

  return (
    <div className="min-h-dvh bg-[#F0F6FF] relative overflow-x-hidden">
      {sach
        ? <InnerNav backHref={HREF.shadowing} backLabel="GIÁO TRÌNH" tab={navTab} />
        : <SiteNav active="shadowing" />}

      {/* Danh sách: pb-20 lg:pb-0 chừa chỗ cho thanh tab dưới CHỈ hiện trên điện thoại (SiteNav). Trang cuốn: InnerNav thấp hơn. */}
      <main className={sach ? 'pt-14 sm:pt-16' : 'pt-16 pb-20 lg:pb-0'}>
        <section className={`max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-10 sm:pt-14 ${sach ? 'pb-[calc(11rem+env(safe-area-inset-bottom))] sm:pb-36' : 'pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-24'}`}>
          <div className="text-center mb-10 sm:mb-14">
            {sach ? (<>
              <div className="mx-auto mb-3 w-44 sm:w-56"><BookArt id={sach.id} className="w-full h-auto overflow-visible" /></div>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] uppercase text-[#1A2A54] break-words [overflow-wrap:anywhere]">{sach.title}</h1>
              <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Trình độ">
                {sach.nhan.map((n) => (
                  <span key={n} className="px-2.5 py-1 rounded-md bg-[#E3EEFF] text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-none text-[#2F7DF6]">{n}</span>
                ))}
              </div>
              <p className="mt-4 sm:mt-5 max-w-xl mx-auto text-[#5B6B85] text-sm sm:text-base leading-relaxed">{sach.mota}</p>
            </>) : (<>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] uppercase text-[#1A2A54]">Giáo trình Kaiwa</h1>
              <p className="mt-2 sm:mt-4 text-[#5B6B85] text-sm sm:text-lg max-w-3xl mx-auto">
                Hội thoại người Nhật dùng thật.<br className="sm:hidden" /><span className="hidden sm:inline"> </span>Giọng chuẩn Tokyo.<br /><span className="font-bold text-[#2F7DF6]">KHÔNG phải do AI tạo</span>.
              </p>
            </>)}
          </div>

          {/* TRANG CỦA 1 CUỐN: danh sách phần, mỗi phần 1 hàng */}
          {sach && <KaiwaPartList key={sach.id} course={sach} onOpenPart={moPhan} dangMo={dangMo} />}

          {!sach && (<>
            {/* Mỗi sách 1 hàng; điện thoại: hình ở trên, tên + nhãn bên dưới, căn giữa. */}
            <div className="max-w-3xl mx-auto grid grid-cols-1 gap-3 sm:gap-5" aria-label="Chọn giáo trình Kaiwa">
              {COURSES.map((course) => (
                <a
                  key={course.id}
                  href={bookHref(course.id)}
                  onClick={() => { savedScroll.current = window.scrollY; }}
                  style={NO_TAP}
                  className="group bg-white p-4 sm:p-6 rounded-2xl border border-[#D3E4FC] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col items-center gap-2.5 sm:flex-row sm:items-center sm:gap-6 w-full min-w-0 overflow-hidden text-center sm:text-left"
                >
                  <span className="w-32 sm:w-36 shrink-0 flex items-center justify-center">
                    <BookArt id={course.id} className="w-full h-auto overflow-visible" />
                  </span>
                  <span className="min-w-0 w-full sm:w-auto flex flex-col items-center sm:items-start text-center sm:text-left">
                    <h3 className="w-full text-[15px] sm:text-xl font-black text-[#1A2A54] uppercase leading-[1.6] sm:leading-tight truncate sm:whitespace-normal sm:overflow-visible break-words [overflow-wrap:anywhere]">{course.title}</h3>
                    <span className="mt-1.5 flex flex-wrap justify-center sm:justify-start gap-1.5" aria-label="Trình độ">
                      {course.nhan.map((n) => (
                        <span key={n} className="px-2 py-[3px] rounded-md bg-[#E3EEFF] text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-none text-[#2F7DF6]">{n}</span>
                      ))}
                    </span>
                    <span className="mt-1.5 text-[13px] sm:text-sm font-bold text-[#6B7A96] whitespace-nowrap">{course.bai} {donViOf(course.id)}</span>
                  </span>
                </a>
              ))}
            </div>

            {/* HƯỚNG DẪN HỌC - nút gọn căn giữa; mở overlay Hướng dẫn có sẵn trong KaiwaModal. */}
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
          </>)}
        </section>
      </main>

      <KaiwaModal
        isOpen={openPartIdx !== null || openGuide}
        initialLevel={openPartIdx !== null && sach ? sach.id : null}
        initialPartIdx={openPartIdx}
        initialLesson={openPartIdx !== null ? parseKaiwaHash().lesson : null}
        initialGuideOpen={openGuide}
        onClose={closeModal}
      />
    </div>
  );
}
