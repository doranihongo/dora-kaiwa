import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, BookOpen, ExternalLink, Languages, ListChecks, ChevronDown, MonitorPlay, Layers, Volume2 } from 'lucide-react';
import { useCourses } from '../CoursesContext';
import { waitForAuthUser } from '../utils/authState';
import SlideShow from './slideshow/SlideShow';
import Blackboard from './slideshow/Blackboard';
import NotePad from './slideshow/NotePad';
import FlashcardModal from './FlashcardModal';
import { buildRawSlideUrls } from '../utils/slides/buildRawSlideUrls';
import { activateSlideBlobCache, getCachedSlideBlob, loadSlideBlob } from '../utils/slides/slideBlobCache';
import type { VocabWord, GrammarPoint } from '../types';

/**
 * Giọng đọc máy (Web Speech API, playVocabAudio bên dưới) đọc từ vựng im
 * bặt hoàn toàn trên iPhone thật dù đã sửa 2 lỗi WebKit đã biết (utterance
 * bị garbage-collect, cancel()+speak() cùng tick) - nhiều khả năng do máy
 * chưa có giọng đọc tiếng Nhật cài sẵn (khác Android/desktop luôn có giọng
 * mặc định). Quyết định: tắt hẳn tính năng nghe phát âm trên iOS (iPhone/
 * iPad/iPod) thay vì để bấm không có phản hồi gì, khó hiểu hơn là ẩn hẳn.
 * navigator.platform === 'MacIntel' + maxTouchPoints > 1: bắt luôn iPadOS
 * (báo User-Agent giống macOS nhưng có cảm ứng, xem thêm ở nhiều nguồn về
 * cách phát hiện iPad trên iPadOS 13+).
 */
const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Khoá cho cache Blob ảnh slide (slideBlobCache.ts) - lấy PATHNAME của URL
 * (bỏ query string) để cùng 1 ảnh luôn khớp đúng Blob đã tải trước đó. Parse
 * lỗi (URL không hợp lệ, hiếm) thì dùng nguyên chuỗi URL làm khoá.
 */
function getSlidePathKey(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Trang chi tiết 1 bài học.
 *   - "Tài liệu" (học viên): `lesson.lessonFileUrl` - luôn mở ra TAB MỚI
 *     (thường là link Google Drive chia sẻ, không phải file trực tiếp nên
 *     không nhúng được trong app - Drive cần phiên đăng nhập riêng của
 *     Google, không đi kèm cookie đăng nhập của web này).
 *   - "Slide" (chỉ giáo viên/admin, và chỉ khóa nằm trong allowed_courses
 *     của họ - xem utils/courseAccess.ts): `lesson.slideFolder` - URL công
 *     khai của 1 thư mục ảnh đặt tên tuần tự (1.svg/2.svg/...) trên GitHub,
 *     sinh danh sách URL qua utils/slides/buildRawSlideUrls.ts rồi hiển thị
 *     bằng SlideShow.tsx. Ảnh công khai - không ký URL, không cần server.
 */
export default function LessonView({ courseId, lessonId, onBack, onHome }: {
  courseId: string,
  lessonId: string,
  onBack: () => void,
  onHome: () => void,
}) {
  const { courses, loadedCourseDetails, detailsLoading } = useCourses();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  // "NỘI DUNG BUỔI HỌC": Từ vựng/Ngữ pháp thu gọn mặc định, bấm tiêu đề mới
  // trượt ra danh sách - chỉ 1 mục mở tại 1 thời điểm (bố cục/hành vi giống
  // hệt khối "NỘI DUNG BUỔI HỌC" Kanji/Từ vựng của dự án "Xóa mù Kanji").
  const [activeContentTab, setActiveContentTab] = useState<'vocab' | 'grammar' | null>(null);
  // true = đang mở flashcard ôn từ vựng (logic/giao diện y hệt FlashcardModal
  // của dự án "Xóa mù Kanji", xem kaiwa/src/components/FlashcardModal.tsx)
  const [isFlashcardOpen, setIsFlashcardOpen] = useState(false);
  // true = đang mở khu vực slide trình chiếu cho giáo viên
  const [teacherSlideOpen, setTeacherSlideOpen] = useState(false);
  // Bảng đen/Ghi chú (chỉ dùng trong lúc trình chiếu Slide, xem SlideShow.tsx)
  // - state giữ Ở ĐÂY (không giữ trong SlideShow) để nội dung KHÔNG mất khi
  // đóng/mở lại Slide (SlideShow unmount/remount mỗi lần bật/tắt, còn
  // LessonView thì không - vẫn 1 instance suốt buổi học, xem lessonKey bên
  // dưới). Chỉ mất khi thực sự sang buổi học khác (lessonKey đổi, xem
  // effect reset bên dưới) - đúng yêu cầu, tránh nội dung buổi này lẫn
  // sang buổi khác.
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  useEffect(() => {
    waitForAuthUser().then((authUser) => setUserRole(authUser?.role));
  }, []);
  // Chỉ giaovien/admin mới thấy nút "Slide" - học viên không có.
  const isTeacherOrAdmin = userRole === 'giaovien' || userRole === 'admin';

  // Khoá nhận diện 1 buổi học, dùng cho cache slide theo từng buổi (xem
  // utils/slideBlobCache.ts) và key={lessonKey} của Blackboard/NotePad bên
  // dưới - sang buổi khác mới tải lại/xoá nội dung buổi cũ.
  const lessonKey = `${courseId}_${lessonId}`;

  // Sang buổi học khác (lessonKey đổi) -> xoá nội dung Bảng đen/Ghi chú của
  // buổi cũ (đóng luôn nếu đang mở) - key={lessonKey} truyền cho
  // Blackboard/NotePad bên dưới lo phần remount (xoá canvas/nội dung thật
  // sự), effect này chỉ lo phần state/hiển thị ở LessonView.
  useEffect(() => {
    setIsBoardOpen(false);
    setIsNoteOpen(false);
    setNoteText('');
  }, [lessonKey]);

  // id của từ đang phát (để hiện icon loa nhấp nháy đúng thẻ), null = không phát.
  const [playingVocabId, setPlayingVocabId] = useState<string | null>(null);
  // Giữ tham chiếu sống tới utterance đang phát - Safari/iOS có bug nổi
  // tiếng: KHÔNG tự giữ nội bộ utterance như trình duyệt khác, nếu không
  // có biến nào tham chiếu tới nó thì bị garbage-collect giữa chừng, giọng
  // đọc im bặt mà không báo lỗi gì (đây là nguyên nhân "bấm không ra
  // tiếng" trên iPhone dù Android/desktop vẫn phát bình thường).
  const ttsUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // setTimeout đang chờ gọi speak() (xem lý do bên dưới) - cần huỷ nếu bấm
  // dừng/bấm từ khác trước khi kịp chạy, không thì nó vẫn phát dù đã bấm
  // dừng.
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopVocabAudio = () => {
    if (ttsTimeoutRef.current !== null) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
    window.speechSynthesis?.cancel();
  };

  // Tất cả từ vựng đều đọc bằng giọng máy trình duyệt (Web Speech API) -
  // trước đây từ có audio thu sẵn dùng file mp3 thật, từ noAudio mới đọc
  // giọng máy, nhưng đổi thống nhất về 1 nguồn duy nhất cho đồng bộ (không
  // còn phân biệt 2 màu icon loa/2 nguồn phát nữa - xem utils/vocabAudioCache.ts
  // cũ, giờ không còn dùng tới).
  const playVocabAudio = (v: VocabWord) => {
    // Đã thử 2 hướng sửa bug WebKit (giữ ref utterance + delay speak() sau
    // cancel()) nhưng iPhone thật vẫn im lặng hoàn toàn - nhiều khả năng do
    // máy chưa có giọng đọc tiếng Nhật (iOS không tự có giọng mặc định cho
    // ngôn ngữ chưa từng bật như Android/desktop). Quyết định: tắt hẳn tính
    // năng nghe phát âm trên iOS thay vì để bấm vô tác dụng khó hiểu - xem
    // IS_IOS đầu file.
    if (IS_IOS) return;
    if (!window.speechSynthesis) return; // trình duyệt không hỗ trợ TTS
    // Bấm lại đúng thẻ đang phát -> dừng luôn (toggle).
    if (playingVocabId === v.id) {
      stopVocabAudio();
      setPlayingVocabId(null);
      return;
    }
    stopVocabAudio();

    const utterance = new SpeechSynthesisUtterance(v.reading || v.word);
    utterance.lang = 'ja-JP';
    ttsUtteranceRef.current = utterance;
    utterance.onend = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));
    utterance.onerror = () => setPlayingVocabId((cur) => (cur === v.id ? null : cur));

    setPlayingVocabId(v.id);
    // setTimeout(0): gọi speak() NGAY sau cancel() trong cùng 1 tick đôi khi
    // bị chính cancel() "nuốt" mất trên Safari/iOS (cancel() xử lý bất đồng
    // bộ nội bộ) - đẩy speak() sang tick kế tiếp để tránh bị nuốt, vẫn nằm
    // trong cùng 1 lượt xử lý sự kiện bấm nên không phá quy tắc "phải gọi
    // trong user-gesture" của iOS.
    ttsTimeoutRef.current = setTimeout(() => {
      ttsTimeoutRef.current = null;
      window.speechSynthesis.speak(utterance);
    }, 0);
  };

  // Dừng giọng đọc đang phát khi rời trang buổi học.
  useEffect(() => {
    return () => {
      stopVocabAudio();
    };
  }, []);

  const course = courses.find(
    c => String(c.id).trim().normalize('NFC') === String(courseId).trim().normalize('NFC')
  );

  const lessons = loadedCourseDetails?.courseId === courseId ? loadedCourseDetails.lessons : [];

  const lesson = lessons.find(
    (l: any) => String(l.id).trim().normalize('NFC') === String(lessonId).trim().normalize('NFC')
  );

  const vocabulary: VocabWord[] = lesson?.vocabulary || [];
  const grammar: GrammarPoint[] = lesson?.grammar || [];

  // --- Tài liệu bài học (học viên) ---
  const lessonFileUrl: string | undefined = lesson?.lessonFileUrl?.trim();
  const hasLessonFile = !!lessonFileUrl;

  /** Luôn mở tab mới - xem giải thích ở comment đầu file. */
  const openLessonFile = () => {
    if (!hasLessonFile) return;
    window.open(lessonFileUrl, '_blank', 'noopener,noreferrer');
  };

  // --- Slide trình chiếu (giáo viên/admin) ---
  // buildRawSlideUrls.ts sinh danh sách URL ảnh công khai (ưu tiên `slideCount`
  // - biết sẵn số trang thì sinh thẳng mảng URL, KHÔNG cần dò; rơi về
  // probeSlideImages khi buổi học chưa điền `slideCount` - xem file đó).
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [slideProbing, setSlideProbing] = useState(false);
  const [slideLoadError, setSlideLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSlideImages([]);
    setSlideLoadError(null);
    // Chỉ giáo viên/admin mới cần slide - học viên không thấy nút "Slide".
    if (!lesson || !lesson.slideFolder || !isTeacherOrAdmin) return;

    // Kích hoạt cache Blob ảnh ĐÚNG buổi học này NGAY (module-level, xem
    // utils/slideBlobCache.ts) để dọn Blob buổi cũ TRƯỚC khi ảnh buổi mới
    // bắt đầu tải.
    activateSlideBlobCache(lessonKey);

    let cancelled = false;
    setSlideProbing(true);
    (async () => {
      try {
        const urls = await buildRawSlideUrls(lesson);
        if (cancelled) return;
        setSlideImages(urls);
      } catch {
        if (!cancelled) setSlideLoadError('Không lấy được danh sách ảnh slide.');
      } finally {
        if (!cancelled) setSlideProbing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, lesson?.slideFolder, lesson?.slideExt, lesson?.slideCount, isTeacherOrAdmin]);

  const hasSlideImages = slideImages.length > 0;

  // Preload TRƯỚC toàn bộ ảnh slide ngay khi biết danh sách - KHÔNG đợi
  // giáo viên bấm "Slide" mới bắt đầu tải như trước (SlideShow.tsx chỉ
  // preload lúc mount, tức là sau khi bấm). Chạy sớm nhất có thể (ngay
  // khi vào trang buổi học) cho ảnh có nhiều thời gian nằm sẵn trong cache
  // HTTP của trình duyệt trước khi thực sự cần.
  // Chỉ chạy cho giáo viên/admin (học viên không thấy nút "Slide", preload
  // cho họ chỉ tốn băng thông vô ích).
  // Trang 1 nạp RIÊNG/trước (fetchPriority "high") để chắc chắn có sẵn sớm
  // nhất dù thứ tự trình duyệt xử lý các request khác thế nào; các trang
  // còn lại nạp "low" - trình duyệt tự giới hạn ~6 kết nối song song/domain
  // nên tự động thành từng cụm trước-sau, không cần tự chia lô thủ công.
  //
  // Nút "Slide" bật ngay khi PRELOAD_GATE_COUNT trang ĐẦU đã xong thật sự
  // (xem slideGateReady/hasSlideImages ở nút bên dưới) - không đợi cả buổi
  // học (có thể vài chục trang, rất nặng nếu là SVG Canva xuất ra) mới cho
  // bấm vào, chỉ cần đủ để mở lên là xem mượt ngay từ trang 1. Các trang
  // từ PRELOAD_GATE_COUNT+1 trở đi vẫn được nạp CÙNG LÚC (không đợi mở
  // Slide mới bắt đầu) - chỉ là không tính vào điều kiện bật nút, cứ âm
  // thầm tải tiếp phía sau trong lúc giáo viên đã xem các trang đầu.
  //
  // Tải THẬT nội dung ảnh bằng fetch()+Blob() (không phải chỉ new Image())
  // rồi giữ lại làm Blob URL trong cache Blob (slideBlobCache.ts) - để khi
  // SlideShow.tsx mở lên và TỰ preload lại (new Image(), xem effect riêng
  // của nó) chỉ việc đọc thẳng Blob URL này (đã có sẵn trong bộ nhớ JS,
  // không qua mạng). fetch() cần nguồn ảnh bật CORS (Access-Control-Allow-
  // Origin) mới đọc được nội dung cross-origin - raw.githubusercontent.com
  // và jsDelivr đều có.
  //
  // decode() ảnh dựng từ Blob URL trước khi coi là "xong": onload chỉ báo
  // đã tải xong BYTE, chưa chắc đã GIẢI MÃ xong thành bitmap sẵn sàng vẽ -
  // ảnh SVG nặng (Canva xuất ra) decode có thể mất cả giây, gây khựng 1
  // nhịp đúng lúc SlideShow thật sự vẽ ra dù coi như đã "tải xong".
  // decode() đợi ĐÚNG bước đó, nên preload xong là vẽ ra tức thì.
  const PRELOAD_GATE_COUNT = 5;
  const [preloadedCount, setPreloadedCount] = useState(0);
  const gateCount = Math.min(PRELOAD_GATE_COUNT, slideImages.length);

  useEffect(() => {
    setPreloadedCount(0);
    if (!isTeacherOrAdmin || slideImages.length === 0) return;
    let cancelled = false;
    const markLoaded = () => {
      if (!cancelled) setPreloadedCount((c) => c + 1);
    };

    const preloadOne = async (url: string, priority: 'high' | 'low') => {
      const pathKey = getSlidePathKey(url);
      try {
        // loadSlideBlob tự lo hết: dùng lại Blob đã có (vd quay lại đúng
        // buổi học này sau khi ra Trang chủ), HOẶC dùng chung kết quả nếu
        // đang có 1 lượt tải khác dở dang cho ĐÚNG ảnh này (2 effect chạy
        // gần như đồng thời cho cùng 1 lần vào buổi học - đã gặp thực tế),
        // chỉ thật sự fetch() khi chưa ai tải - xem utils/slideBlobCache.ts.
        const blobUrl = await loadSlideBlob(lessonKey, pathKey, async () => {
          // Ảnh công khai trên GitHub (CORS mở) - để trình duyệt tự cache HTTP.
          const res = await fetch(url, {
            priority,
          } as RequestInit & { priority?: 'high' | 'low' | 'auto' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        });
        if (typeof Image === 'function') {
          const img = new Image();
          img.src = blobUrl;
          if (typeof img.decode === 'function') {
            await img.decode().catch(() => {});
          }
        }
      } catch {
        // Lỗi mạng/CORS - bỏ qua, không giữ Blob cho pathKey này. SlideShow
        // sẽ tự nhận URL gốc (slideDisplayImages rơi về url gốc khi
        // không có Blob) và tự tải bằng <img src> như trước khi có tối ưu
        // này - vẫn xem được, chỉ không còn hưởng lợi tránh tải 2 lần.
      } finally {
        markLoaded();
      }
    };

    // Giới hạn số ảnh tải+decode CÙNG LÚC (worker pool, không bắn hết N ảnh
    // 1 lượt như trước) - đã gặp thực tế: 18 ảnh PNG nặng (3-6MB/ảnh) cùng
    // fetch()+blob()+decode() đồng thời (không streaming nhẹ nhàng như
    // <img src> nữa, mà phải đệm NGUYÊN blob vào bộ nhớ rồi giải mã) làm
    // "đơ" hẳn tab (renderer không phản hồi nhiều giây) trên máy yếu/nhiều
    // slide. PRELOAD_CONCURRENCY nhỏ vẫn đủ nhanh (ảnh ưu tiên "high" luôn
    // được xếp trước trong hàng đợi nên vẫn về sớm) mà không dồn tải cùng lúc.
    const PRELOAD_CONCURRENCY = 3;
    const queue = slideImages.map((url, i) => ({
      url,
      priority: i < PRELOAD_GATE_COUNT ? ('high' as const) : ('low' as const),
    }));
    let nextIndex = 0;
    const runWorker = async () => {
      while (true) {
        const i = nextIndex++;
        if (i >= queue.length) return;
        await preloadOne(queue[i].url, queue[i].priority);
      }
    };
    const workerCount = Math.min(PRELOAD_CONCURRENCY, queue.length);
    for (let w = 0; w < workerCount; w++) runWorker();

    return () => {
      cancelled = true;
    };
  }, [isTeacherOrAdmin, slideImages, lessonKey]);

  // Danh sách URL thật sự đưa cho SlideShow hiển thị: dùng Blob URL đã tải
  // sẵn (tức thì, không qua mạng) nếu có, rơi về URL gốc cho ảnh nào
  // chưa preload xong kịp (vd trang cuối buổi học nhiều slide) hoặc preload
  // lỗi - SlideShow tự tải nốt bằng <img src> bình thường trong trường hợp
  // đó. Tính lại mỗi lần render (đọc Map module-level, không tốn gì) - tự
  // động đổi dần từ URL gốc sang Blob URL khi từng ảnh preload xong
  // (preloadedCount tăng kéo theo re-render, xem markLoaded ở trên).
  const slideDisplayImages = slideImages.map(
    (url) => getCachedSlideBlob(lessonKey, getSlidePathKey(url)) || url,
  );

  // Đủ PRELOAD_GATE_COUNT trang đầu là bật nút - KHÔNG đợi hết toàn bộ
  // buổi học (xem effect preload phía trên).
  const slideGateReady = hasSlideImages && preloadedCount >= gateCount;
  const slidePreloadPercent =
    gateCount > 0 ? Math.min(100, Math.round((preloadedCount / gateCount) * 100)) : 0;
  // "Đang tải" hiện khi đang dò slideFolder (buổi học chưa có slideCount)
  // HOẶC đã biết danh sách nhưng nhóm trang đầu chưa tải xong.
  const slideButtonBusy = slideProbing || (hasSlideImages && !slideGateReady);

  const toggleContentTab = (tab: 'vocab' | 'grammar') => {
    setActiveContentTab((prev) => (prev === tab ? null : tab));
  };

  // Furigana cho phần ngữ pháp: gõ "[漢字](かんじ)" trong `pattern`/`exampleJapanese`
  // (giống cú pháp dùng ở KaiwaModal.tsx renderFurigana) sẽ hiện thành <ruby>/<rt>.
  const renderFurigana = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, index) => {
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        return (
          <ruby key={index} className="leading-loose">
            {match[1]}
            <rt className="text-[0.6em] text-[#2F7DF6] font-semibold select-none"><span className="inline-block -translate-y-0.5">{match[2]}</span></rt>
          </ruby>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  if (detailsLoading) {
    return (
      <div className="flex justify-center items-center p-12 min-h-screen">
        <div className="w-10 h-10 border-4 border-[#2F7DF6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    // min-h-full shrink-0 (không phải h-full) - cùng lý do như
    // CourseDetail.tsx: tránh nav sticky bị "hết chỗ bám" và biến mất khi
    // cuộn qua khỏi 1 màn hình, vì div này là con flex trực tiếp của
    // #lesson-view-container (App.tsx, overflow-y-auto + flex flex-col).
    // Đi kèm flex-auto (không phải flex-1) ở <main> bên dưới.
    <div className="flex flex-col font-sans h-full min-h-0">
      {/* Header Navigation */}
      {/* Thanh đầu sáng - y hệt InnerNav của web Phá Đảo Tiếng Nhật: nút "<" tròn (về trang khóa học)
          + tên trang quay về (tên khóa) + nút TRANG CHỦ viên thuốc. */}
      <nav className="flex-shrink-0 bg-[#F0F6FF] border-b border-[#D3E4FC] z-50" style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={onBack}
                aria-label="Quay lại khóa học"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none"
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={3} />
              </button>
              <span className="text-base sm:text-lg font-black text-[#1A2A54] uppercase truncate">{course?.title || 'Khóa học'}</span>
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

      {/* Main Content */}
      {/* Không tự cuộn riêng - để #lesson-view-container (bọc ngoài, xem
          App.tsx) là nơi DUY NHẤT cuộn, cuộn toàn trang thay vì chỉ cuộn
          mỗi vùng main này. flex-auto (không phải flex-1): flex-basis auto
          để chiều cao nội dung thật của main truyền lên được div cha ở
          trên (chứa nav sticky) - xem comment ở div cha. */}
      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
      <main className="max-w-4xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-12 flex flex-col gap-5 sm:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-2xl border border-[#D3E4FC] shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2.5 text-[#2F7DF6]">
            <BookOpen className="w-5 h-5" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">{course?.title || 'Khóa học'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase leading-tight text-[#1A2A54] break-words">{lesson?.title || 'Buổi học'}</h1>
        </div>

        {/* NỘI DUNG BUỔI HỌC: Từ vựng/Ngữ pháp - accordion, bấm tiêu đề mới trượt
            ra danh sách, chỉ 1 mục mở tại 1 thời điểm (bố cục giống khối "NỘI
            DUNG BUỔI HỌC" Kanji/Từ vựng của dự án "Xóa mù Kanji"). */}
        {/* shrink-0: main là flex-col cao giới hạn (overflow-y-auto) - item có
            overflow-hidden mặc nhiên có kích thước tối thiểu = 0 theo spec flexbox,
            nên bị flex co bóp nhỏ lại thay vì tràn ra cho main cuộn, nếu không có
            shrink-0 chặn co. */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 border border-[#D3E4FC] shadow-sm shrink-0">
          <h2 className="text-[#1A2A54] font-black mb-4 flex items-center gap-2 text-base md:text-lg uppercase tracking-wide">
            <BookOpen className="w-5 h-5 text-[#2F7DF6]" />
            Nội dung buổi học
          </h2>

          <div className="flex flex-col gap-3">
            {/* Từ vựng */}
            <div className={`rounded-2xl overflow-hidden border bg-white transition-all duration-300 ${activeContentTab === 'vocab' ? 'border-[#2F7DF6]/60 shadow-md' : 'border-[#D3E4FC] hover:border-[#B6D0F7]'}`}>
              <button
                onClick={() => toggleContentTab('vocab')}
                className={`w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 font-bold transition-all duration-300 ${activeContentTab === 'vocab' ? 'bg-[#2F7DF6] text-white' : 'bg-white text-[#1A2A54] hover:bg-[#E3EEFF]'}`}
                aria-expanded={activeContentTab === 'vocab'}
              >
                <span className="flex items-center gap-2 uppercase tracking-wide text-sm">
                  <Languages className="w-4 h-4 shrink-0" />
                  Từ vựng
                  <span className="text-[11px] font-semibold opacity-70 normal-case">({vocabulary.length})</span>
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${activeContentTab === 'vocab' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${activeContentTab === 'vocab' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  {vocabulary.length > 0 ? (
                    <div className="p-3 sm:p-4 bg-[#F0F6FF] border-t border-[#D3E4FC] max-h-96 overflow-y-auto custom-scrollbar">
                      {/* Bảng từ vựng: hàng xen kẽ trắng / #F0F6FF, bấm 1 hàng để nghe phát âm. */}
                      <div className="rounded-xl border border-[#D3E4FC] overflow-hidden bg-white">
                        <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[#E3EEFF] text-[11px] font-black uppercase tracking-wider text-[#5B6B85]">
                          <span className="w-6 shrink-0">#</span>
                          <span className="flex-1 min-w-0 grid grid-cols-2 gap-x-4">
                            <span>Từ vựng</span>
                            <span>Nghĩa</span>
                          </span>
                          {!IS_IOS && <span className="w-4 shrink-0" />}
                        </div>
                        {vocabulary.map((v, i) => {
                          const isPlaying = playingVocabId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => playVocabAudio(v)}
                              disabled={IS_IOS}
                              title={IS_IOS ? undefined : 'Bấm để nghe phát âm'}
                              className={`w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left transition-colors ${i > 0 ? 'border-t border-[#E3EEFF]' : ''} ${
                                isPlaying
                                  ? 'bg-[#E3EEFF] shadow-[inset_3px_0_0_#2F7DF6]'
                                  : `${i % 2 === 0 ? 'bg-white' : 'bg-[#F0F6FF]'} ${IS_IOS ? 'cursor-default' : 'hover:bg-[#E3EEFF]'}`
                              }`}
                            >
                              <span className="w-6 shrink-0 text-[11px] font-bold text-[#8B9BB8] tabular-nums">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              {/* flex-wrap + break-words: từ dài tự động đẩy cách đọc xuống dòng
                                  riêng thay vì đè/tràn ra ngoài - từ ngắn thì 2 phần vẫn nằm chung 1 hàng.
                                  Điện thoại: nghĩa nằm dưới từ; từ sm: 2 cột Từ vựng | Nghĩa. */}
                              <span className="flex-1 min-w-0 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 sm:items-center">
                                <span className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
                                  <span className="font-jp text-lg font-bold text-[#1A2A54] break-words">{v.word}</span>
                                  {v.reading && v.reading !== v.word && (
                                    <span className="font-jp text-base font-bold text-[#2F7DF6] break-words">{v.reading}</span>
                                  )}
                                </span>
                                <span className="text-sm text-[#5B6B85] font-semibold break-words">{v.meaning}</span>
                              </span>
                              {/* Tắt hẳn icon loa trên iOS - giọng máy không phát ra tiếng
                                  trên iPhone thật (xem IS_IOS đầu file), hiện icon vẫn bấm
                                  được sẽ gây hiểu lầm là app lỗi. */}
                              {!IS_IOS && (
                                <Volume2
                                  className={`w-4 h-4 shrink-0 ${isPlaying ? 'text-[#2F7DF6] animate-pulse' : 'text-[#B6D0F7]'}`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 bg-[#F0F6FF] border-t border-[#D3E4FC]">
                      <div className="rounded-2xl border border-dashed border-[#B6D0F7] bg-white py-8 text-center text-sm text-[#6B7A96] font-medium">
                        Chưa có dữ liệu từ vựng.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Ngữ pháp */}
            <div className={`rounded-2xl overflow-hidden border bg-white transition-all duration-300 ${activeContentTab === 'grammar' ? 'border-[#2F7DF6]/60 shadow-md' : 'border-[#D3E4FC] hover:border-[#B6D0F7]'}`}>
              <button
                onClick={() => toggleContentTab('grammar')}
                className={`w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 font-bold transition-all duration-300 ${activeContentTab === 'grammar' ? 'bg-[#2F7DF6] text-white' : 'bg-white text-[#1A2A54] hover:bg-[#E3EEFF]'}`}
                aria-expanded={activeContentTab === 'grammar'}
              >
                <span className="flex items-center gap-2 uppercase tracking-wide text-sm">
                  <ListChecks className="w-4 h-4 shrink-0" />
                  Ngữ pháp
                  <span className="text-[11px] font-semibold opacity-70 normal-case">({grammar.length})</span>
                </span>
                <ChevronDown className={`w-5 h-5 shrink-0 transition-transform duration-300 ${activeContentTab === 'grammar' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${activeContentTab === 'grammar' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  {grammar.length > 0 ? (
                    <div className="p-3 sm:p-4 bg-[#F0F6FF] border-t border-[#D3E4FC] flex flex-col gap-2.5 max-h-96 overflow-y-auto custom-scrollbar">
                      {grammar.map((g, i) => (
                        <div key={g.id} className="rounded-xl border border-[#D3E4FC] bg-white hover:border-[#B6D0F7] shadow-sm p-4 flex flex-col gap-1.5 transition-colors">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F7DF6] bg-[#E3EEFF] px-2 py-0.5 rounded-md w-fit">
                            Mẫu {i + 1}
                          </span>
                          <p className="font-jp text-base md:text-lg font-bold text-[#1E5FD9]">{renderFurigana(g.pattern)}</p>
                          <p className="text-sm text-[#5B6B85] font-semibold">{g.meaning}</p>
                          {g.exampleJapanese && (
                            <div className="mt-1.5 pt-2.5 border-t border-[#E3EEFF] flex flex-col gap-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2F7DF6] bg-[#E3EEFF] px-2 py-0.5 rounded-md w-fit mb-1">
                                Ví dụ
                              </span>
                              <p className="font-jp text-base md:text-lg text-[#1A2A54] font-bold">{renderFurigana(g.exampleJapanese)}</p>
                              {g.exampleVietnamese && (
                                <p className="text-sm text-[#5B6B85] font-semibold">{g.exampleVietnamese}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 sm:p-4 bg-[#F0F6FF] border-t border-[#D3E4FC]">
                      <div className="rounded-2xl border border-dashed border-[#B6D0F7] bg-white py-8 text-center text-sm text-[#6B7A96] font-medium">
                        Chưa có dữ liệu ngữ pháp.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nút công cụ: Slide (chỉ giáo viên/admin) / Flashcard / Tài liệu.
            Flashcard: logic/giao diện y hệt FlashcardModal của dự án "Xóa mù
            Kanji" (xem FlashcardModal.tsx), chỉ đổi nguồn dữ liệu sang
            VocabWord của kaiwa. */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 md:p-6 border border-[#D3E4FC] shadow-sm shrink-0">
          {/* flex + flex-1 (thay grid cố định số cột) - buổi học KHÔNG có phần nào (vd chưa
              có tài liệu) thì ẨN LUÔN nút đó (thay vì hiện mờ/disabled như trước), các nút còn
              lại tự co dãn lấp đầy hàng. Slide vẫn cần disabled (không ẩn) khi đang tải/gate
              chưa xong - CHỈ ẩn khi đã xác định chắc buổi học không có slide (hết probing,
              không lỗi, không có ảnh). */}
          <div className="flex flex-wrap gap-3">
            {isTeacherOrAdmin && (slideProbing || hasSlideImages || slideLoadError) && (
              <button
                onClick={() => setTeacherSlideOpen(true)}
                disabled={!hasSlideImages || !slideGateReady}
                className="flex-1 min-w-[110px] bg-[#2F7DF6] hover:bg-[#1E5FD9] p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md disabled:opacity-40 disabled:pointer-events-none disabled:hover:translate-y-0"
              >
                {slideButtonBusy ? (
                  <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <MonitorPlay className="w-6 h-6 text-white" />
                )}
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {slideProbing
                    ? 'Đang tải...'
                    : hasSlideImages && !slideGateReady
                      ? `Slide... ${slidePreloadPercent}%`
                      : 'Slide'}
                </span>
              </button>
            )}

            {vocabulary.length > 0 && (
              <button
                onClick={() => setIsFlashcardOpen(true)}
                className="flex-1 min-w-[110px] bg-[#2F7DF6] hover:bg-[#1E5FD9] p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <Layers className="w-6 h-6 text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Flashcard</span>
              </button>
            )}

            {hasLessonFile && (
              <button
                onClick={openLessonFile}
                className="flex-1 min-w-[110px] bg-[#E3EEFF] hover:bg-[#D3E4FC] p-3 py-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:-translate-y-1"
              >
                <ExternalLink className="w-6 h-6 text-[#2F7DF6]" />
                <span className="text-xs font-bold text-[#2F7DF6] uppercase tracking-wider">Tài liệu</span>
              </button>
            )}

          </div>
          {isTeacherOrAdmin && slideLoadError && (
            <p className="text-xs text-red-500 mt-3">
              Không tải được slide: {slideLoadError}
            </p>
          )}
          {(() => {
            const missing = [
              vocabulary.length === 0 && 'từ vựng để luyện tập',
              !hasLessonFile && 'tài liệu',
              isTeacherOrAdmin && !hasSlideImages && !slideProbing && !slideLoadError && 'slide trình chiếu',
            ].filter(Boolean) as string[];
            if (missing.length === 0) return null;
            return (
              <p className="text-xs text-[#6B7A96] mt-3">
                Buổi học này chưa có {missing.join(', ')}.
              </p>
            );
          })()}
        </div>
      </main>
      </div>

      {/* Slide trình chiếu cho giáo viên - ảnh, crossfade khi trước/sau, trang
          1 hiện rõ dần lúc vừa mở (xem SlideShow.tsx) */}
      {teacherSlideOpen && hasSlideImages && (
        <SlideShow
          images={slideDisplayImages}
          title={lesson?.title}
          onClose={() => {
            setTeacherSlideOpen(false);
            // Đóng Slide thì ẩn luôn Bảng/Ghi chú (nếu đang mở) - nội dung
            // (canvas/text) vẫn giữ nguyên vì Blackboard/NotePad không bị
            // unmount ở đây, chỉ ẩn qua isOpen.
            setIsBoardOpen(false);
            setIsNoteOpen(false);
          }}
          isBoardOpen={isBoardOpen}
          onToggleBoard={() => setIsBoardOpen((v) => !v)}
          isNoteOpen={isNoteOpen}
          onToggleNote={() => setIsNoteOpen((v) => !v)}
        />
      )}

      {/* Bảng đen/Ghi chú - render Ở ĐÂY (không phải trong SlideShow) để
          canvas/nội dung không mất khi đóng/mở lại Slide - xem comment ở
          chỗ khai báo state isBoardOpen/isNoteOpen phía trên. key={lessonKey}
          bắt buộc remount (xoá sạch canvas/nội dung) khi sang buổi học khác. */}
      {isTeacherOrAdmin && (
        <>
          <Blackboard key={`board-${lessonKey}`} isOpen={isBoardOpen} onClose={() => setIsBoardOpen(false)} />
          <NotePad key={`note-${lessonKey}`} isOpen={isNoteOpen} onClose={() => setIsNoteOpen(false)} text={noteText} setText={setNoteText} />
        </>
      )}

      {/* Flashcard ôn từ vựng */}
      <FlashcardModal
        isOpen={isFlashcardOpen}
        onClose={() => setIsFlashcardOpen(false)}
        vocabulary={vocabulary}
      />

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-[#1A2A54]/40 z-[100] flex items-center justify-center p-4 overscroll-none">
          <div className="bg-white border border-[#D3E4FC] rounded-2xl max-w-sm w-full p-6 sm:p-8 shadow-2xl flex flex-col text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-black uppercase text-[#1A2A54] mb-2">Thoát buổi học</h3>
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
