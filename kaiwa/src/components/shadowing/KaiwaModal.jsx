import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import KaiwaPracticeView from './KaiwaPracticeView';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { DATA_BASE } from '../../utils/dataBase';

// Modal này CHỈ CÒN 3 màn: "parts" (chọn phần học) -> "list" (chọn bài) -> "detail" (luyện tập).
// Màn "categories" (chọn bộ giáo trình) đã BỊ XOÁ HẲN (không phải chỉ bỏ qua) - trang /kaiwa/
// (KaiwaPage.jsx) giờ tự hiện danh sách giáo trình ngay trên trang, đồng bộ style Kanji/Từ vựng,
// nên không cần màn chọn giáo trình bên trong modal nữa.
//
// "initialLevel" (vd '42baisotrungcap') - do đó gần như LUÔN được truyền khi mở modal: nơi gọi đã
// tự chọn sẵn giáo trình từ trang, modal chỉ việc gọi loadCategory(initialLevel) ngay khi mở để
// nhảy thẳng vào "parts" (không có "categories" nào để rơi vào nếu thiếu prop này).
//
// "initialGuideOpen" (tuỳ chọn) - dùng khi bấm nút "Hướng dẫn" ở KaiwaPage.jsx: mở modal (không
// cần initialLevel) và bật sẵn overlay Hướng dẫn che kín toàn màn hình (renderGuideOverlay, giờ
// đứng độc lập ở tầng ngoài cùng, không còn lồng trong màn "categories" đã xoá).
// KAIWA MỞ CÔNG KHAI HOÀN TOÀN (user chốt 05/11/2026): mọi bài của 3 giáo trình ai cũng học được, kể cả khách chưa đăng nhập.
// Không còn kho khóa ở VPS / Supabase / data/khach cho Kaiwa: 3 file JSON nằm thẳng ở public/data/sachkaiwa/ và đi cùng bản build lên GitHub Pages.

const KaiwaModal = ({ isOpen, onClose, initialLevel, initialGuideOpen }) => {
    // --- BẢN ĐỒ CẤU HÌNH NHÓM BÀI THỦ CÔNG ---
    const playTimeRef = React.useRef(0); // Bộ đếm số giây đã nghe
    const shouldShowAdRef = React.useRef(false); // Cờ báo hiệu đủ 5 phút
    const handleTick = React.useCallback(() => {
        playTimeRef.current += 1; // Mỗi giây cộng thêm 1
        if (playTimeRef.current >= 300 && !shouldShowAdRef.current) { // 300 giây = 5 phút
            shouldShowAdRef.current = true; // Cắm cờ đòi quà!
        }
    }, []);

    const handleClose = () => {
        onClose(); // Đóng giao diện Kaiwa
        if (shouldShowAdRef.current) {
            // Bắn sự kiện ép buộc hiện pop up
            setTimeout(() => window.dispatchEvent(new CustomEvent('forceTriggerAd')), 500);
            shouldShowAdRef.current = false; // Reset cờ
            playTimeRef.current = 0; // Reset bộ đếm giờ cho lần học sau
        }
    };
    // Đã phân chia chuẩn xác theo dữ liệu JSON của bạn
    const MANUAL_PARTS_CONFIG = {
        '42baisotrungcap': [
            { title: "Phần 1", desc: "Gồm 10 bài", lessonCount: 10 },
            { title: "Phần 2", desc: "Gồm 9 bài", lessonCount: 9 },
            { title: "Phần 3", desc: "Gồm 8 bài", lessonCount: 8 },
            { title: "Phần 4", desc: "Gồm 8 bài", lessonCount: 8 },
            { title: "Phần 5", desc: "Gồm 7 bài", lessonCount: 7 }
        ],
        'nameraka': [
            { title: "BIẾN ÂM", desc: "Gồm 6 bài", lessonCount: 6 },
            { title: "HÌNH THÁI HỘI THOẠI", desc: "Gồm 6 bài", lessonCount: 6 },
            { title: "MỤC ĐÍCH HỘI THOẠI", desc: "Gồm 11 bài", lessonCount: 11 }
        ],
        '22baitrungthuongcap': [
            { title: "Phần 1", desc: "Gia đình, người yêu", lessonCount: 5 },
            { title: "Phần 2", desc: "Bạn bè", lessonCount: 5 },
            { title: "Phần 3", desc: "Người quen, hàng xóm", lessonCount: 5 },
            { title: "Phần 4", desc: "Bác sĩ, nhân viên cửa hàng...", lessonCount: 5 },
            { title: "Phần 5", desc: "Đồng nghiệp", lessonCount: 5 },
            { title: "Phần 6", desc: "Cấp trên, cấp dưới", lessonCount: 5 },
            { title: "Phần 7", desc: "Người ngoài công ty, người phỏng vấn", lessonCount: 3 },
            { title: "Phần 8", desc: "Hội thoại dài, bài phát biểu", lessonCount: 8 },
        ]
    };

    // "idle" - CHƯA có màn nào hiện thật sự (trước là 'categories', đặt tên theo màn "chọn giáo
    // trình" đã xoá - đổi tên cho đúng bản chất: chỉ còn là trạng thái "đang đợi loadCategory chạy
    // xong", không còn ứng với view nào được render nữa, xem return() ở cuối file).
    const [view, setView] = React.useState('idle');
    
    const [allLessons, setAllLessons] = React.useState([]); 
    const [parts, setParts] = React.useState([]); 
    const [selectedPartIdx, setSelectedPartIdx] = React.useState(0); 

    const [currentLessonIdx, setCurrentLessonIdx] = React.useState(0); 
    const [isLoading, setIsLoading] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const [courseCache, setCourseCache] = React.useState({});
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);

    // Nhớ vị trí cuộn của màn "Chọn phần học"/"Chọn bài" - quay lại (bấm "<" từ màn bài về màn
    // phần) thì vẫn ở đúng chỗ cũ, không nhảy về đầu danh sách (div bị unmount khi đổi "view" nên
    // cần tự lưu/khôi phục, y hệt roadmapScrollRef/roadmapScrollPos trong StudySetupModal.jsx).
    const partsScrollRef = React.useRef(null);
    const partsScrollPos = React.useRef(0);
    const listScrollRef = React.useRef(null);
    const listScrollPos = React.useRef(0);

    useBodyScrollLock(isOpen);
    React.useEffect(() => {
        if (!isOpen) {
            setView('idle');
            setIsGuideOpen(false);
        }
    }, [isOpen]);

    // Quay lại màn "Chọn phần học"/"Chọn bài" (đổi "view") -> khôi phục đúng vị trí đã cuộn trước
    // đó, không nhảy về đầu.
    React.useEffect(() => {
        if (view === 'parts' && partsScrollRef.current) {
            partsScrollRef.current.scrollTop = partsScrollPos.current;
        }
        if (view === 'list' && listScrollRef.current) {
            listScrollRef.current.scrollTop = listScrollPos.current;
        }
    }, [view]);

    // Tự tải "initialLevel" ngay khi vừa mở (xem giải thích ở khai báo prop phía trên). ĐẶT TRƯỚC
    // "if (!isOpen) return null" bên dưới (bắt buộc - hook không được nằm sau return sớm, nếu
    // không sẽ vi phạm Rules of Hooks: số hook gọi được sẽ khác nhau giữa lúc đóng/mở, React ném
    // lỗi "Rendered fewer/more hooks than expected"). Tham chiếu "loadCategory" tuy khai báo ở
    // dưới nhưng vẫn AN TOÀN nhờ closure - hàm callback này chỉ thực sự CHẠY sau khi cả component
    // đã render xong (React hoãn effect tới sau commit), lúc đó "loadCategory" chắc chắn đã được
    // gán; nhánh "isOpen" false thì "&&" chặn trước, không bao giờ chạm tới "loadCategory".
    React.useEffect(() => {
        if (isOpen && initialLevel && view === 'idle') {
            loadCategory(initialLevel);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, initialLevel]);

    // Tự bật overlay Hướng dẫn (xem giải thích ở khai báo prop "initialGuideOpen" phía trên) -
    // CÙNG lý do đặt trước "if (!isOpen) return null" như effect initialLevel ở trên.
    React.useEffect(() => {
        if (isOpen && initialGuideOpen) {
            setIsGuideOpen(true);
        }
    }, [isOpen, initialGuideOpen]);

    if (!isOpen) return null;

    const loadCategory = async (level) => {
    // 1. KIỂM TRA BỘ NHỚ TẠM (CACHE)
    // Nếu giáo trình này đã được tải trước đó, lấy ra dùng luôn và bỏ qua loading
    if (courseCache[level]) {
        setAllLessons(courseCache[level].data);
        setParts(courseCache[level].parts);
        setView('parts');
        return; 
    }

    // 2. NẾU CHƯA CÓ TRONG BỘ NHỚ TẠM -> BẮT ĐẦU TẢI VÀ HIỆN LOADING
    setIsLoading(true);
    setProgress(20);
    try {
        // Đường dẫn TUYỆT ĐỐI từ gốc site (trước là "./data/..." tương đối) - CẦN THIẾT để component
        // này còn tải đúng dữ liệu khi mở từ trang /kaiwa/ (lồng 1 cấp thư mục): "./data/..." ở đó
        // sẽ trỏ nhầm thành "/kaiwa/data/..." (không tồn tại) - y hệt lý do đã sửa ở LibraryModal.jsx.
        // Dữ liệu Kaiwa công khai: tải thẳng file tĩnh ở public/data/sachkaiwa/ (không qua VPS / khoaData nữa).
        const res = await fetch(`${DATA_BASE}/data/sachkaiwa/sachkaiwa${level}.json`);
        if (!res.ok) throw new Error("Chưa có data");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Chưa có data");
        
        const config = MANUAL_PARTS_CONFIG[level];
        const chunkedParts = [];

        if (config) {
            let currentIndex = 0;
            config.forEach((partConfig) => {
                const lessonsInPart = data.slice(currentIndex, currentIndex + partConfig.lessonCount);
                if (lessonsInPart.length > 0) {
                    chunkedParts.push({
                        title: partConfig.title,
                        desc: partConfig.desc,
                        lessons: lessonsInPart,
                        startIndex: currentIndex 
                    });
                }
                currentIndex += partConfig.lessonCount;
            });

            if (currentIndex < data.length) {
                chunkedParts.push({
                    title: "Phần bổ sung",
                    desc: `Các bài còn lại`,
                    lessons: data.slice(currentIndex),
                    startIndex: currentIndex
                });
            }
        } else {
            const CHUNK_SIZE = 10;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                chunkedParts.push({
                    title: `Phần ${Math.floor(i / CHUNK_SIZE) + 1}`,
                    desc: `Từ bài ${i + 1} đến bài ${Math.min(i + CHUNK_SIZE, data.length)}`,
                    lessons: data.slice(i, i + CHUNK_SIZE),
                    startIndex: i
                });
            }
        }
        
        // 3. LƯU DỮ LIỆU VỪA TẢI VÀO BỘ NHỚ TẠM (CACHE) ĐỂ LẦN SAU DÙNG
        setCourseCache(prev => ({
            ...prev,
            [level]: {
                data: data,
                parts: chunkedParts
            }
        }));

        setAllLessons(data);
        setParts(chunkedParts);

        // Đẩy thanh loading lên 100% và chuyển giao diện
        setProgress(100);
        setTimeout(() => {
            setView('parts'); 
            setIsLoading(false);
        }, 400);

    } catch (error) {
        alert(`Đang cập nhật bộ dữ liệu ${level.toUpperCase()}!`);
        setIsLoading(false);
        onClose(); // (dự án Dora) tải lỗi thì đóng luôn, tránh để lại khung trống không có nút nào bấm được
    }
};

const renderGuideOverlay = () => (
    <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-10 duration-300">
        {/* Header Guide - tông xanh #F0F6FF/#D3E4FC đồng bộ theme chính. KHÔNG còn nút "<" quay
            về màn "categories" (bấm "Hướng dẫn học" từ /kaiwa/ mở thẳng overlay này qua
            initialGuideOpen, không đi qua màn categories nào cả) - chỉ còn đúng 1 nút X đóng
            HẲN modal (handleClose), y hệt các popup Kanji/Từ vựng chỉ có 1 cách đóng duy nhất. */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-[#D3E4FC] bg-[#F0F6FF] z-10 shadow-sm shrink-0">
            <h2 className="text-lg font-black text-[#1A2A54] uppercase tracking-tight leading-none">Hướng dẫn học Kaiwa</h2>
            <button onClick={(e) => { e.currentTarget.blur(); handleClose(); }} aria-label="Đóng" style={{ WebkitTapHighlightColor: 'transparent' }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
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
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-[#D3E4FC]">Tập vai A/B</span> Tự động tắt tiếng nhân vật bạn chọn để bạn tự đọc.</li>
                                    <li className="flex items-center gap-2"><span className="px-2 py-1 bg-white rounded shadow-sm border border-[#D3E4FC]">Ẩn lời thoại</span> Làm mờ văn bản ép bạn phản xạ bằng trí nhớ.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);
  const renderParts = () => (
        <div className="flex flex-col h-full bg-[#F0F6FF] overflow-hidden">
            {/* KHÔNG còn nút "<" quay về "categories" - màn đó giờ không thể tới được nữa từ
                /kaiwa/ (trang đã tự hiện danh sách giáo trình ở màn chính, xem KaiwaPage.jsx),
                initialLevel luôn đưa thẳng vào đây nên nút back trỏ vào 1 màn "chết" là thừa. */}
            <div className="p-4 bg-[#F0F6FF] border-b border-[#D3E4FC] flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <h2 className="text-sm font-black text-[#1A2A54] uppercase leading-none">Chọn phần học</h2>
                <button onClick={(e) => { e.currentTarget.blur(); handleClose(); }} aria-label="Đóng" style={{ WebkitTapHighlightColor: 'transparent' }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
            </div>
            <div
                ref={partsScrollRef}
                onScroll={(e) => { partsScrollPos.current = e.target.scrollTop; }}
                // "pb-8" (thay vì pb-4 mặc định của p-4) trên điện thoại - đệm thêm khoảng trống dưới
                // thẻ cuối cùng, tránh sát mép dưới màn hình (đặc biệt máy có vạch cử chỉ). Từ sm+ trở
                // lên (máy tính/tablet) không cần, trả lại pb-4 như cũ.
                className="p-4 pb-8 sm:pb-4 space-y-3 overflow-y-auto custom-scrollbar flex-1"
            >
                {parts.map((part, idx) => (
                    <button
                        key={idx}
                        onClick={(e) => { e.currentTarget.blur(); setSelectedPartIdx(idx); setView('list'); }}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                        className="w-full p-5 bg-white border border-[#D3E4FC] rounded-xl text-left md:hover:border-[#2F7DF6] md:hover:shadow-md transition-all active:scale-[0.98] flex items-center justify-between group"
                    >
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-[#1A2A54] font-sans md:group-hover:text-[#2F7DF6] transition-colors uppercase tracking-wide">{part.title}</span>
                            <span className="text-xs font-bold text-[#5B6B85] mt-1">{part.desc}</span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#F0F6FF] flex items-center justify-center md:group-hover:bg-[#E3EEFF] transition-colors">
                            <svg className="w-4 h-4 text-[#5B6B85] md:group-hover:text-[#2F7DF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderList = () => {
        const currentPart = parts[selectedPartIdx];
        if (!currentPart) return null;

        return (
            <div className="flex flex-col h-full bg-[#F0F6FF] overflow-hidden">
                <div className="p-4 bg-[#F0F6FF] border-b border-[#D3E4FC] flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={(e) => { e.currentTarget.blur(); setView('parts'); }} style={{ WebkitTapHighlightColor: 'transparent' }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <h2 className="text-sm font-black text-[#1A2A54] uppercase leading-none">{currentPart.title}</h2>
                    </div>
                    <button onClick={(e) => { e.currentTarget.blur(); handleClose(); }} aria-label="Đóng" style={{ WebkitTapHighlightColor: 'transparent' }} className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
                </div>
                <div
                    ref={listScrollRef}
                    onScroll={(e) => { listScrollPos.current = e.target.scrollTop; }}
                    // "pb-8" trên điện thoại - cùng lý do đã giải thích ở khung "Chọn phần học" phía trên.
                    className="p-4 pb-8 sm:pb-4 space-y-2 overflow-y-auto custom-scrollbar flex-1"
                >
                    {currentPart.lessons.map((lesson, idx) => {
                        const globalIdx = currentPart.startIndex + idx;
                        return (
                            <button
                                key={lesson.id || globalIdx}
                                onClick={(e) => { e.currentTarget.blur(); setCurrentLessonIdx(globalIdx); setView('detail'); }}
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                // Bỏ hẳn số thứ tự "#..." bên phải (không dùng nữa)
                                className="w-full p-4 bg-white border border-[#D3E4FC] rounded-xl text-left md:hover:border-[#2F7DF6] md:hover:shadow-md transition-all active:scale-[0.98] flex items-center group"
                            >
                                <span className="text-base sm:text-lg font-bold text-[#1A2A54] font-sans md:group-hover:text-[#2F7DF6] transition-colors">{lesson.title}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[500] flex justify-center items-center bg-zinc-900/90 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
            {/* "relative" - THIẾU trước đây khiến overlay loading (absolute inset-0 ngay bên
                dưới) không có điểm neo là chính khung popup này, phải "leo" lên tận khung ngoài
                cùng (fixed inset-0, phủ HẾT màn hình) - đó là lý do trên máy tính, lúc bấm chọn
                giáo trình, hình loading che kín cả màn hình thay vì chỉ nằm gọn trong popup "Chọn
                phần học" này. */}
            <div className="relative bg-white w-full h-full sm:h-[90vh] max-w-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* --- GIAO DIỆN LOADING MỚI --- */}
            {isLoading && (
                <div className="absolute inset-0 z-[600] flex flex-col items-center justify-center bg-white/90 backdrop-blur-md">
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
                {/* renderGuideOverlay giờ đứng ở tầng NGOÀI CÙNG này (trước đây nằm trong
                    renderCategories, đã xoá màn đó - xem KaiwaPage.jsx) để vẫn che được lên trên
                    bất kỳ view nào đang hiện, phòng khi mở kèm initialGuideOpen mà chưa kịp có
                    initialLevel nào khác. */}
                {isGuideOpen && renderGuideOverlay()}
                {view === 'parts' && renderParts()}
                {view === 'list' && renderList()}
                
                {view === 'detail' && (
                    <KaiwaPracticeView 
                        lesson={allLessons[currentLessonIdx]} 
                        total={allLessons.length}
                        currentIndex={currentLessonIdx}
                        onBack={() => setView('list')}
                        onNext={() => setCurrentLessonIdx(Math.min(currentLessonIdx + 1, allLessons.length - 1))}
                        onPrev={() => setCurrentLessonIdx(Math.max(currentLessonIdx - 1, 0))}
                        onTick={handleTick}
                    />
                )}
            </div>
        </div>
    );
};

let hasWarnedAudioGlobal = false;
// ==========================================
// COMPONENT: KAIWA PRACTICE VIEW (SỬ DỤNG HOWLER.JS SIÊU MƯỢT)

export default KaiwaModal;
