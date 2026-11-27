import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import KaiwaPracticeView from './KaiwaPracticeView';
import { loadCourse, getCachedCourse } from './kaiwaLoader';
import { useDaXem, danhDauDaXem, khoaPhan, khoaBai } from './kaiwaDaXem';
import { parseKaiwaHash, setKaiwaHash } from './kaiwaRoute';
import { kaiwaErrorMessage } from '../../utils/kaiwaApi';

// 26/11/2026 (user): cuốn sách -> TRANG CỦA CUỐN theo hash #<id sách> liệt kê các PHẦN (mỗi phần 1 hàng, nằm ở ShadowingPage.tsx) -> bấm phần = POPUP danh sách BÀI (cửa sổ này) -> bấm bài = màn luyện tập như cũ.
// Cửa sổ này giờ CHỈ CÒN 2 màn: "list" (popup các bài của 1 phần; trên điện thoại trượt từ dưới lên, máy tính là thẻ giữa màn) -> "detail" (luyện tập, full như trước).
// Màn "parts" (chọn phần học) đã chuyển ra trang của cuốn ở ShadowingPage.tsx; cách chia phần của từng cuốn nằm ở kaiwaParts.js (PARTS_CONFIG).
//
// "initialLevel" (vd '42baisotrungcap') + "initialPartIdx" (0-based): nơi gọi chọn sẵn cuốn và phần; khi mở, cửa sổ gọi loadCategory(initialLevel, initialPartIdx)
// để nhảy thẳng vào popup bài của phần đó (dữ liệu thường đã được trang sách tải trước vào kaiwaParts, nên mở là có ngay, không hiện thanh tải).
//
// "initialGuideOpen" (tuỳ chọn) - dùng khi bấm nút "Hướng dẫn" ở ShadowingPage.tsx: mở cửa sổ (không cần initialLevel)
// và bật sẵn overlay Hướng dẫn che kín toàn màn hình (renderGuideOverlay, đứng độc lập ở tầng ngoài cùng).
// Quyền xem: chỉ tài khoản đã đăng nhập và có quyền (VPS kiểm ở vps/kaiwa-server.mjs) - không có bài khóa / bản xem trước.

// KHÓA CUỘN NỀN KIỂU NHẸ (user 26/11: iPhone, vuốt cho thanh địa chỉ Safari ẩn rồi mở popup thì bị giật/co dãn/lag). Hook dùng chung useBodyScrollLock đặt body position:fixed + top:-scrollY rồi
// scrollTo lúc đóng: trên iPhone việc đưa trang về đầu làm thanh địa chỉ HIỆN LẠI -> chiều cao màn hình (dvh / fixed inset-0) đổi giữa chừng -> popup co dãn, dựng lại, giật. Ở đây chỉ đặt
// overflow:hidden cho html + body (KHÔNG đụng vị trí cuộn nên thanh địa chỉ giữ nguyên trạng thái, đóng popup không phải scrollTo); lớp phủ có touch-none + overscroll-none như các popup khác
// của web để cử chỉ vuốt không lọt xuống trang nền (vùng cuộn bên trong popup vẫn cuộn bình thường).
function useSoftScrollLock(active) {
    React.useEffect(() => {
        if (!active) return undefined;
        const html = document.documentElement;
        const body = document.body;
        const truoc = { ho: html.style.overflow, bo: body.style.overflow, hob: html.style.overscrollBehavior };
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        return () => {
            html.style.overflow = truoc.ho;
            body.style.overflow = truoc.bo;
            html.style.overscrollBehavior = truoc.hob;
        };
    }, [active]);
}

// Hiệu ứng mở popup (user 26/11: "mở mượt mà giống các popup trong kanji", cả máy tính lẫn điện thoại): nền mờ dần + thẻ nổi lên nhẹ. TỰ ĐỊNH NGHĨA vì trang này không có
// plugin tailwindcss-animate (các class animate-in / zoom-in-95 / fade-in trước đây KHÔNG có tác dụng). Chỉ chạy lúc popup vừa mở (đổi danh sách -> chi tiết dùng chung 1 thẻ nên không chạy lại).
const KW_CSS = `
@keyframes kw-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes kw-pop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
.kw-fade { animation: kw-fade .2s ease-out both; }
.kw-pop { animation: kw-pop .24s cubic-bezier(.2,.8,.2,1) both; }
/* điện thoại (user 26/11: lag khi chuyển qua lại): chỉ mờ dần thẻ, không scale thẻ lớn bo góc, nền không animate */
@media (max-width: 639px) { .kw-pop { animation: kw-fade .15s ease-out both; } .kw-fade { animation: none; } }
@media (prefers-reduced-motion: reduce) { .kw-fade, .kw-pop { animation: none; } }
`;

// POPUP "CHỌN BÀI" của 1 phần (user 26/11/2026): bấm 1 phần ở trang giáo trình -> popup này; bấm 1 bài -> màn luyện tập.
// Đầu popup: ô số phần + tên phần (user 26/11 bỏ dòng "N câu/mẫu" bên dưới tên); thân: danh sách bài, MỖI BÀI 1 HÀNG. Là thành phần RIÊNG bọc React.memo (user 26/11: điện thoại lag khi chuyển qua lại):
// danh sách GIỮ trong DOM (ẩn) khi xem chi tiết nên không được vẽ lại mỗi lần bấm bài trước/sau - props đều ổn định (part, onPick, onClose là hàm cố định).
// Tiêu đề MỘT DÒNG, KHÔNG xuống dòng (user 26/11 chốt cuối: thử "tối đa 2 dòng" rồi bảo "thôi 1 dòng thôi, ko xuống dòng 2"): bắt đầu ở cỡ lớn nhất (điện thoại 18px, máy tính 24px),
// nếu tràn thì giảm dần 0.5px tới cỡ nhỏ nhất (11px / 14px). Đo bằng scrollWidth > clientWidth nên chỉ chạy lúc dựng và khi đổi cỡ cửa sổ (không đo mỗi lần vẽ).
function FitTitle({ children, className = '' }) {
    const ref = React.useRef(null);
    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const fit = () => {
            const lon = window.matchMedia('(min-width: 640px)').matches;
            const min = lon ? 14 : 11;
            let s = lon ? 24 : 18;
            el.style.fontSize = s + 'px';
            while (el.scrollWidth > el.clientWidth + 0.5 && s > min) { s -= 0.5; el.style.fontSize = s + 'px'; }
        };
        fit();
        window.addEventListener('resize', fit);
        return () => window.removeEventListener('resize', fit);
    }, [children]);
    return <h2 ref={ref} className={`whitespace-nowrap overflow-hidden ${className}`}>{children}</h2>;
}

const LessonList = React.memo(function LessonList({ part, partIdx, level, onPick, onClose, scrollRef, scrollPos }) {
    const daXem = useDaXem(); // bài đã xem -> chữ TÍM (user 26/11), lưu theo phiên
    if (!part) return null;
    return (
        <div className="flex flex-col h-full bg-[#F0F6FF] overflow-hidden">
            <div className="px-4 py-4 sm:px-7 sm:py-5 bg-white border-b border-[#D3E4FC] flex items-center gap-3 sm:gap-4 shrink-0">
                <span className="w-8 h-8 sm:w-12 sm:h-12 shrink-0 rounded-lg sm:rounded-xl bg-[#E3EEFF] text-[#2F7DF6] font-black text-sm sm:text-xl flex items-center justify-center tabular-nums">{partIdx + 1}</span>
                <div className="min-w-0 flex-1">
                    <FitTitle className="font-black text-[#1A2A54] leading-[1.45]">{part.title}</FitTitle>
                </div>
                <button onClick={(e) => { e.currentTarget.blur(); onClose(); }} aria-label="Đóng" style={{ WebkitTapHighlightColor: 'transparent' }} className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
            </div>
            <div
                ref={scrollRef}
                onScroll={(e) => { scrollPos.current = e.target.scrollTop; }}
                // Đệm dưới thẻ cuối rộng (điện thoại 2.5rem, máy tính 3rem) để bài cuối không sát mép popup (user 26/11).
                className="p-4 pb-10 sm:p-6 sm:pb-12 overflow-y-auto custom-scrollbar flex-1"
            >
                <div className="flex flex-col gap-2.5 sm:gap-3">
                    {part.lessons.map((lesson, idx) => {
                        const globalIdx = part.startIndex + idx;
                        const xem = daXem(khoaBai(level, lesson, globalIdx));
                        return (
                            <button
                                key={lesson.id || globalIdx}
                                onClick={(e) => { e.currentTarget.blur(); onPick(globalIdx); }}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                className={`w-full min-h-[3.5rem] px-4 py-3.5 sm:px-5 border rounded-xl text-left shadow-sm transition-all active:scale-[0.98] flex items-center gap-3 group bg-white md:hover:border-[#2F7DF6] md:hover:shadow-md ${xem ? 'border-[#DDD6FE]' : 'border-[#D3E4FC]'}`}
                            >
                                <span className={`min-w-0 flex-1 text-base sm:text-lg font-bold font-sans leading-snug break-words transition-colors ${xem ? 'text-[#7C3AED] md:group-hover:text-[#6D28D9]' : 'text-[#1A2A54] md:group-hover:text-[#2F7DF6]'}`}>{lesson.tenDS || lesson.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});

const KaiwaModal = ({ isOpen, onClose, initialLevel, initialPartIdx = null, initialLesson = null, initialGuideOpen }) => {
    // "idle" - CHƯA có màn nào hiện thật sự (đang đợi loadCategory chạy xong, hoặc chỉ mở overlay Hướng dẫn); sau đó là 'list' -> 'detail'.
    const [view, setView] = React.useState('idle');

    const [allLessons, setAllLessons] = React.useState([]);
    const [parts, setParts] = React.useState([]);
    const [selectedPartIdx, setSelectedPartIdx] = React.useState(0);

    const [currentLessonIdx, setCurrentLessonIdx] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);
    // Nhớ vị trí cuộn của popup "Chọn bài" - quay lại (bấm "<" từ màn luyện tập về popup) thì vẫn ở đúng chỗ cũ,
    // không nhảy về đầu danh sách (div bị unmount khi đổi "view" nên cần tự lưu/khôi phục).
    const listScrollRef = React.useRef(null);
    const listScrollPos = React.useRef(0);

    useSoftScrollLock(isOpen);
    // Hàm CỐ ĐỊNH cho LessonList (bọc React.memo): chọn 1 bài -> sang trang chi tiết; đóng -> luôn gọi onClose mới nhất qua ref.
    const chonBai = React.useCallback((globalIdx) => { setCurrentLessonIdx(globalIdx); setView('detail'); }, []);
    const handleCloseRef = React.useRef(null);
    handleCloseRef.current = onClose;
    const dongPopup = React.useCallback(() => { if (handleCloseRef.current) handleCloseRef.current(); }, []);
    React.useEffect(() => {
        if (!isOpen) {
            setView('idle');
            setIsGuideOpen(false);
            listScrollPos.current = 0;
        }
    }, [isOpen]);

    // Quay lại popup "Chọn bài" (đổi "view") -> khôi phục đúng vị trí đã cuộn trước đó, không nhảy về đầu.
    React.useLayoutEffect(() => {
        if (view === 'list' && listScrollRef.current) {
            listScrollRef.current.scrollTop = listScrollPos.current;
        }
    }, [view]);

    // Tự tải "initialLevel" ngay khi vừa mở (xem giải thích ở khai báo prop phía trên). ĐẶT TRƯỚC
    // "if (!isOpen) return null" bên dưới (bắt buộc - hook không được nằm sau return sớm, nếu
    // không sẽ vi phạm Rules of Hooks). Tham chiếu "loadCategory" tuy khai báo ở dưới nhưng vẫn AN TOÀN
    // nhờ closure - callback này chỉ CHẠY sau khi component render xong; nhánh "isOpen" false thì "&&" chặn trước.
    React.useLayoutEffect(() => {
        if (isOpen && initialLevel && view === 'idle') {
            loadCategory(initialLevel, initialPartIdx, initialLesson);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialLevel, initialPartIdx]);

    // Tự bật overlay Hướng dẫn (xem giải thích ở khai báo prop "initialGuideOpen" phía trên) -
    // CÙNG lý do đặt trước "if (!isOpen) return null" như effect initialLevel ở trên.
    React.useEffect(() => {
        if (isOpen && initialGuideOpen) {
            setIsGuideOpen(true);
        }
    }, [isOpen, initialGuideOpen]);

    // ĐÃ XEM (user 26/11): mở popup của 1 phần -> phần đó đã xem; hiện chi tiết 1 bài (kể cả chuyển bằng mũi tên < >) -> bài đó đã xem. Đặt TRƯỚC "if (!isOpen) return null" (Rules of Hooks).
    React.useEffect(() => {
        if (isOpen && initialLevel && view !== 'idle') danhDauDaXem(khoaPhan(initialLevel, selectedPartIdx));
    }, [isOpen, initialLevel, view, selectedPartIdx]);
    React.useEffect(() => {
        if (isOpen && initialLevel && view === 'detail' && allLessons[currentLessonIdx]) danhDauDaXem(khoaBai(initialLevel, allLessons[currentLessonIdx], currentLessonIdx));
    }, [isOpen, initialLevel, view, allLessons, currentLessonIdx]);

    // ĐỊA CHỈ (user 26/11): popup danh sách bài / trang chi tiết ghi vào hash (#sách/phần/bài - xem kaiwaRoute.js); load lại trang hoặc dán link thì mở lại đúng chỗ.
    React.useEffect(() => {
        if (!isOpen || !initialLevel || view === 'idle') return;
        setKaiwaHash(initialLevel, selectedPartIdx + 1, view === 'detail' ? currentLessonIdx + 1 : null);
    }, [isOpen, initialLevel, view, selectedPartIdx, currentLessonIdx]);
    // Nút Lùi/Tiến của trình duyệt hay sửa tay địa chỉ khi popup đang mở -> đi theo địa chỉ mới (đóng popup do ShadowingPage lo).
    const partsRef = React.useRef([]);
    partsRef.current = parts;
    React.useEffect(() => {
        if (!isOpen || !initialLevel) return undefined;
        const theoDiaChi = () => {
            const r = parseKaiwaHash();
            if (r.slug !== String(initialLevel).toLowerCase() || r.part == null) return;
            const ps = partsRef.current;
            const pi = r.part - 1;
            if (!ps[pi]) return;
            setSelectedPartIdx(pi);
            const g = r.lesson != null ? r.lesson - 1 : -1;
            if (g >= ps[pi].startIndex && g < ps[pi].startIndex + ps[pi].lessons.length) { setCurrentLessonIdx(g); setView('detail'); } else setView('list');
        };
        window.addEventListener('hashchange', theoDiaChi);
        return () => window.removeEventListener('hashchange', theoDiaChi);
    }, [isOpen, initialLevel]);

    if (!isOpen) return null;

    // Mở popup bài của phần partIdx (không hợp lệ thì phần đầu)
    // lessonNo (đếm từ 1, có thể null): mở thẳng trang chi tiết của bài đó nếu nó thuộc phần này (vào bằng địa chỉ #sách/phần/bài). Tất cả setState cùng 1 lượt -> không nháy qua màn danh sách.
    const moPhan = (course, partIdx, lessonNo = null) => {
        setAllLessons(course.data);
        setParts(course.parts);
        const pi = partIdx != null && course.parts[partIdx] ? partIdx : 0;
        setSelectedPartIdx(pi);
        listScrollPos.current = 0;
        const p = course.parts[pi];
        const g = lessonNo != null ? lessonNo - 1 : -1;
        if (p && g >= p.startIndex && g < p.startIndex + p.lessons.length) { setCurrentLessonIdx(g); setView('detail'); } else setView('list');
    };

    const loadCategory = async (level, partIdx, lessonNo = null) => {
        // 1. Đã có trong bộ nhớ tạm (trang sách tải trước / lần mở trước) -> mở ngay, không hiện loading
        const cached = getCachedCourse(level);
        if (cached) {
            moPhan(cached, partIdx, lessonNo);
            return;
        }

        // 2. Chưa có -> tải và hiện loading
        setIsLoading(true);
        setProgress(20);
        try {
            const course = await loadCourse(level);
            // Có dữ liệu là mở ngay (trước đây còn chờ thêm 400ms cho thanh tiến độ chạy giả -> popup bị "co dãn" ở lần mở đầu)
            moPhan(course, partIdx, lessonNo);
            setIsLoading(false);
        } catch (error) {
            alert(kaiwaErrorMessage(error));
            setIsLoading(false);
            onClose();
        }
    };

const renderGuideOverlay = () => (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        {/* Header Guide - tông xanh #F0F6FF/#D3E4FC đồng bộ theme chính. KHÔNG còn nút "<" quay
            về màn "categories" (bấm "Hướng dẫn học" từ /kaiwa/ mở thẳng overlay này qua
            initialGuideOpen, không đi qua màn categories nào cả) - chỉ còn đúng 1 nút X đóng
            HẲN modal (onClose), y hệt các popup Kanji/Từ vựng chỉ có 1 cách đóng duy nhất. */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#D3E4FC] bg-[#F0F6FF] z-10 shadow-sm shrink-0">
            <h2 className="text-lg font-black text-[#1A2A54] uppercase tracking-tight leading-none">Hướng dẫn học Kaiwa</h2>
            <button onClick={(e) => { e.currentTarget.blur(); onClose(); }} aria-label="Đóng" style={{ WebkitTapHighlightColor: 'transparent' }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
        </div>

        {/* Content Guide */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-[#F0F6FF]/40">
            <div className="max-w-2xl mx-auto space-y-8">

                {/* Section 1 */}
                <div className="bg-white p-6 rounded-2xl border border-[#D3E4FC] shadow-sm">
                    <h3 className="text-base font-black text-[#2F7DF6] uppercase mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Shadowing là gì?
                    </h3>
                    <p className="text-sm text-[#5B6B85] leading-relaxed font-medium">
                        <strong className="text-[#1A2A54]">Shadowing</strong> là kỹ thuật luyện nghe nói bằng cách nghe một đoạn hội thoại và lặp lại ngay lập tức giống như một cái bóng bám theo âm thanh gốc. Khác với nghe-lặp-lại truyền thống, bạn phải nói song song với audio.
                    </p>
                </div>

                {/* Section 2 */}
                <div className="bg-white p-6 rounded-2xl border border-[#D3E4FC] shadow-sm">
                    <h3 className="text-base font-black text-[#2F7DF6] uppercase mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        Tại sao lại cần Shadowing?
                    </h3>
                    <ul className="space-y-3 text-sm text-[#5B6B85] font-medium">
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#2F7DF6] shrink-0"></div>
                            <span><strong className="text-[#1A2A54]">Ngữ điệu chuẩn xác:</strong> Giúp bạn nắm bắt được sự lên xuống giọng và cách ngắt nghỉ tự nhiên của người Nhật.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#2F7DF6] shrink-0"></div>
                            <span><strong className="text-[#1A2A54]">Luyện cơ miệng:</strong> Quen với tốc độ nói thật, không bị vấp hay "líu lưỡi" khi giao tiếp.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#2F7DF6] shrink-0"></div>
                            <span><strong className="text-[#1A2A54]">Phản xạ nhanh:</strong> Rèn luyện não bộ xử lý thông tin âm thanh đồng thời với việc phát âm.</span>
                        </li>
                    </ul>
                </div>

                {/* Section 3 */}
                <div>
                    <h3 className="text-lg font-black text-[#1A2A54] uppercase tracking-wide mb-4">PHƯƠNG PHÁP LUYỆN TẬP</h3>
                    <div className="space-y-4">
                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-[#D3E4FC] shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[#1A2A54] text-white font-black flex items-center justify-center shrink-0">1</div>
                            <div>
                                <h4 className="font-black text-[#1A2A54] mb-1 uppercase text-sm tracking-wide">Shadowing câm (Silent Shadowing)</h4>
                                <p className="text-sm text-[#5B6B85] font-medium leading-relaxed">Luyện tập không nói thành lời âm thanh nghe được mà chỉ nhẩm trong đầu. Những đoạn hội thoại có tốc độ nhanh, những mẫu câu khó, trước hết hãy thử với phương pháp này.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-[#D3E4FC] shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[#1A2A54] text-white font-black flex items-center justify-center shrink-0">2</div>
                            <div>
                                <h4 className="font-black text-[#1A2A54] mb-1 uppercase text-sm tracking-wide">Nhẩm theo (Whispering)</h4>
                                <p className="text-sm text-[#5B6B85] font-medium leading-relaxed">Luyện tập không phát âm rõ tiếng nghe được mà chỉ nhẩm lại với tiếng thì thầm. Hãy làm quen với cảm giác của ngữ điệu.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-[#D3E4FC] shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[#1A2A54] text-white font-black flex items-center justify-center shrink-0">3</div>
                            <div>
                                <h4 className="font-black text-[#1A2A54] mb-1 uppercase text-sm tracking-wide">Shadowing nhịp điệu (Prosody Shadowing)</h4>
                                <p className="text-sm text-[#5B6B85] font-medium leading-relaxed">Luyện tập chú trọng đặc biệt tới nhịp điệu và ngữ điệu.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-4 bg-white rounded-2xl border border-[#D3E4FC] shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[#1A2A54] text-white font-black flex items-center justify-center shrink-0">4</div>
                            <div>
                                <h4 className="font-black text-[#1A2A54] mb-1 uppercase text-sm tracking-wide">Shadowing nội dung (Contents Shadowing)</h4>
                                <p className="text-sm text-[#5B6B85] font-medium leading-relaxed">Luyện tập có chú ý đến việc hiểu ý nghĩa. Khi đã luyện tập kỹ Shadowing theo nhịp điệu và có thể thực hiện tốt rồi, hãy vừa shadowing vừa hình dung ý nghĩa và bối cảnh.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 p-5 bg-[#F0F6FF] rounded-2xl border border-[#93C5FD] shadow-sm relative overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-[#2F7DF6] text-white font-black flex items-center justify-center shrink-0">5</div>
                            <div>
                                <h4 className="font-black text-[#1A2A54] mb-1 uppercase text-sm tracking-wide">Nhập vai thực chiến</h4>
                                <p className="text-sm text-[#1A2A54] font-medium leading-relaxed mb-3">Dùng công cụ của web để tự giao tiếp như nói chuyện với người thật:</p>
                                <ul className="space-y-2 text-xs font-bold text-[#2F7DF6]">
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-[#D3E4FC]">Icon loa</span> Tắt tiếng một người nói (A hoặc B) để bạn tự đọc phần của người đó.</li>
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-[#D3E4FC]">Icon mắt</span> Ẩn chữ của một người nói, ép bạn phản xạ bằng trí nhớ.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
    // Popup "Chọn bài" (user 26/11: điện thoại cũng popup GIỮA MÀN HÌNH như các popup khác, không còn trượt từ đáy; máy tính: thẻ TO giữa màn, nền CHUẨN như các popup khác của web (bg-gray-900/60 backdrop-blur-sm - user 26/11 "làm như các cái popup khác"), dùng chung cho cả danh sách bài và trang chi tiết). Màn luyện tập vẫn full như cũ với nền tối.
    // User 26/11: bấm 1 bài ở popup -> VẪN LÀ popup đó (cùng kích cỡ), chỉ đổi nội dung sang trang chi tiết; nền dùng chung kiểu các popup khác (gray-900/60 + blur-sm), không đen đặc.
    // Chỉ overlay Hướng dẫn (không gắn với phần nào) mới dùng khung lớn nền tối như cũ.
    const laPopup = !isGuideOpen;
    const laChiTiet = view === 'detail'; // trang chi tiết: nền TỐI HƠN danh sách bài (user 26/11: "từ popup danh sách vào popup chi tiết thì nền cần tối hơn")

    return (
        <div
            className={`fixed inset-0 z-[500] flex justify-center touch-none overscroll-none kw-fade ${laPopup ? `items-center ${laChiTiet ? 'p-0' : 'p-4'} sm:p-6 ${laChiTiet ? 'bg-gray-900/80' : 'bg-gray-900/60 backdrop-blur-[3px]'} sm:backdrop-blur-sm sm:transition-colors sm:duration-300` : 'items-center p-0 bg-zinc-900/90 sm:backdrop-blur-md sm:p-4'}`}
            // (hiệu ứng mở: kw-fade ở khung ngoài + kw-pop ở thẻ, định nghĩa trong KW_CSS)
            // User 26/11: TRANG CHI TIẾT trên ĐIỆN THOẠI = TOÀN MÀN HÌNH như cũ (không lề, không bo góc); danh sách bài vẫn là popup giữa màn hình; từ sm trở lên chi tiết vẫn cùng khung popup.
            // KHÓA NỀN (user 26/11: "bấm vào nền không bị đóng, khóa nền nhé"): bấm ra ngoài popup KHÔNG đóng; chỉ đóng bằng nút X (danh sách bài) / nút < về danh sách (trang chi tiết). Cuộn trang phía sau cũng bị khóa (useSoftScrollLock).
        >
            <style>{KW_CSS}</style>
            {/* "relative" - làm điểm neo cho overlay loading / Hướng dẫn (absolute inset-0) nằm gọn trong khung này. */}
            <div className={`relative bg-white w-full sm:shadow-2xl flex flex-col overflow-hidden kw-pop ${laPopup ? `max-w-4xl ${laChiTiet ? 'h-full rounded-none' : 'h-[84svh] rounded-3xl'} sm:h-[86vh] sm:rounded-3xl` : 'h-full sm:h-[90vh] max-w-3xl sm:rounded-3xl'}`}>
                {/* --- GIAO DIỆN LOADING --- */}
                {isLoading && (
                    <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center bg-white/95">
                        <div className="text-center">
                            <span className="text-xs font-bold text-[#1A2A54] uppercase tracking-widest animate-pulse mb-4 block">
                                Đang tải dữ liệu... {progress}%
                            </span>
                            <div className="w-48 bg-[#E3EEFF] rounded-full h-1.5 overflow-hidden mx-auto">
                                <div className="bg-[#2F7DF6] h-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    </div>
                )}
                {isGuideOpen && renderGuideOverlay()}
                {/* Danh sách bài GIỮ NGUYÊN trong DOM khi sang trang chi tiết (chỉ ẩn bằng display:none): bấm "<" quay lại là hiện ngay, không dựng lại cả trăm hàng (lag trên điện thoại - user 26/11). */}
                {view !== 'idle' && <div className={view === 'detail' ? 'hidden' : 'contents'}><LessonList part={parts[selectedPartIdx]} partIdx={selectedPartIdx} level={initialLevel} onPick={chonBai} onClose={dongPopup} scrollRef={listScrollRef} scrollPos={listScrollPos} /></div>}

                {view === 'detail' && parts[selectedPartIdx] && (() => {
                    // User 26/11: nút chuyển bài ở đáy chỉ đi trong CÁC BÀI CỦA PHẦN ĐANG MỞ (popup này), không nhảy sang phần khác; bộ đếm "x / y" cũng tính theo phần.
                    const dau = parts[selectedPartIdx].startIndex;
                    const cuoi = dau + parts[selectedPartIdx].lessons.length - 1;
                    return (
                        <KaiwaPracticeView
                            lesson={allLessons[currentLessonIdx]}
                            level={initialLevel}
                            total={cuoi - dau + 1}
                            currentIndex={currentLessonIdx - dau}
                            onBack={() => setView('list')}
                            onNext={() => setCurrentLessonIdx(Math.min(currentLessonIdx + 1, cuoi))}
                            onPrev={() => setCurrentLessonIdx(Math.max(currentLessonIdx - 1, dau))}
                        />
                    );
                })()}
            </div>
        </div>
    );
};

export default KaiwaModal;
