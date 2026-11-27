import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Howl } from 'howler';
import { X, Languages, Crosshair, Volume2, VolumeX, Eye, EyeOff, Lightbulb } from 'lucide-react';
import { Furi } from './KaiwaFuri.jsx';
import HinhTuVung from './HinhTuVung.jsx';
import { fetchKaiwaAudioUrl, forgetKaiwaAudioUrl, kaiwaErrorMessage } from '../../utils/kaiwaApi';

// Cờ "đã hiện thông báo âm thanh 1 lần".
let hasWarnedAudioGlobal = false;

// NHÃN ĐOẠN HỘI THOẠI luôn 1 dòng ngắn gọn (user 26/11): bỏ ghi chú đuôi trong ngoặc, rút tiền tố ("Cụm liên quan:" -> "Liên quan:"...), "Tình huống 1" -> "TH1" khi nhãn dài, rồi cắt ở dấu ngắt tự nhiên (hoặc "…").
const NHAN_MAX = 34;
const nhanDai = (s) => [...s].length;
export function rutGonNhan(goc) {
    let t = String(goc || '').trim();
    t = t.replace(/\s*[（(][^()（）]*[)）]\s*$/, '').replace(/\s*\[[^\]]*\]\s*$/, '').trim();
    t = t.replace(/^Cụm liên quan:\s*/, 'Liên quan: ').replace(/^Hay đi kèm cụm này:\s*/, 'Đi kèm: ').replace(/^Cách đáp thường dùng:\s*/, 'Cách đáp: ');
    // nhãn dài (user 26/11): BỎ HẲN tiền tố "Tình huống N:" / "Hội thoại N:" (không viết TH1 / HT1), chỉ giữ phần mô tả; nhãn ngắn vẫn giữ đủ
    if (nhanDai(t) > 28) t = t.replace(/^(?:Tình huống|Hội thoại)\s*\d+\s*:\s*/, '');
    // dấu 」 thừa ở cuối (dữ liệu gốc có chỗ đóng ngoặc dư)
    if ((t.match(/」/g) || []).length > (t.match(/「/g) || []).length) t = t.replace(/」+$/, '').trim();
    if (nhanDai(t) > NHAN_MAX) {
        const chars = [...t];
        const dau = chars.slice(0, NHAN_MAX - 1).join('');
        const cut = Math.max(dau.lastIndexOf('、'), dau.lastIndexOf('，'), dau.lastIndexOf(', '), dau.lastIndexOf(' – '), dau.lastIndexOf('／'), dau.lastIndexOf(' / '));
        t = (cut >= 12 ? dau.slice(0, cut) : dau.replace(/[\s,、，–-]+$/, '')) + '…';
    }
    return t;
}

// 2 NÚT CẠNH TÊN MỖI CÂU THOẠI (user 26/11: bỏ avatar vì tốn diện tích; icon THẲNG HÀNG với chữ "Người A"): LOA = tắt/bật tiếng, MẮT = ẩn/hiện chữ. Cùng hàng với tên, phía trên bong bóng (A: tên rồi icon, bên trái; B: icon rồi tên, bên phải);
// bấm ở câu nào cũng áp dụng cho TẤT CẢ câu của người nói đó (state mutedSp / hiddenSp theo người nói); hai nút độc lập nhau.
function NutNguoiNoi({ s, muted, hidden, onMute, onHide }) {
    const nut = (tat) => `p-1 -my-0.5 sm:p-0.5 sm:my-0 flex items-center justify-center bg-transparent border-0 transition-colors shrink-0 ${tat ? 'text-rose-500' : 'text-[#7C8CA6] hover:text-[#2F7DF6]'}`;
    return (
        <span className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button type="button" onClick={onMute} aria-pressed={!!muted} aria-label={muted ? `Bật lại tiếng Người ${s}` : `Tắt tiếng Người ${s}`} style={{ WebkitTapHighlightColor: 'transparent' }} className={nut(!!muted)}>
                {muted ? <VolumeX className="w-[18px] h-[18px] sm:w-5 sm:h-5" strokeWidth={2.25} /> : <Volume2 className="w-[18px] h-[18px] sm:w-5 sm:h-5" strokeWidth={2.25} />}
            </button>
            <button type="button" onClick={onHide} aria-pressed={!!hidden} aria-label={hidden ? `Hiện chữ Người ${s}` : `Ẩn chữ Người ${s}`} style={{ WebkitTapHighlightColor: 'transparent' }} className={nut(!!hidden)}>
                {hidden ? <EyeOff className="w-[18px] h-[18px] sm:w-5 sm:h-5" strokeWidth={2.25} /> : <Eye className="w-[18px] h-[18px] sm:w-5 sm:h-5" strokeWidth={2.25} />}
            </button>
        </span>
    );
}

const KaiwaPracticeView = ({ lesson, level, total, currentIndex, onBack, onNext, onPrev }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isAudioLoading, setIsAudioLoading] = React.useState(false);
    const [showTranslation, setShowTranslation] = React.useState(false);
    // tắt tiếng / ẩn chữ THEO TỪNG NGƯỜI NÓI, độc lập nhau (thay cho "Tập vai A/B" + "Ẩn lời thoại" cũ): { A: true, B: false... }
    const [mutedSp, setMutedSp] = React.useState({});
    const [hiddenSp, setHiddenSp] = React.useState({});
    // LUẬT (user 26/11): KHÔNG thể tắt tiếng cả 2 người. Đang tắt người này mà tắt thêm người kia thì người này tự được BẬT lại (luôn còn ít nhất 1 người có tiếng). Nút mắt (ẩn chữ) không bị ràng buộc.
    const nguoiNoi = React.useMemo(() => {
        const ds = [];
        for (const c of (lesson.conversations || [{ dialogues: lesson.dialogues }])) for (const d of (c.dialogues || [])) if (d.speaker && !ds.includes(d.speaker)) ds.push(d.speaker);
        return ds;
    }, [lesson]);
    const doiTatTieng = React.useCallback((s) => {
        setMutedSp((p) => {
            if (p[s]) return { ...p, [s]: false };
            const moi = { ...p, [s]: true };
            if (nguoiNoi.length > 1 && nguoiNoi.every((x) => moi[x])) { for (const x of nguoiNoi) if (x !== s) moi[x] = false; }
            return moi;
        });
    }, [nguoiNoi]);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [playbackRate, setPlaybackRate] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showFurigana, setShowFurigana] = React.useState(false);
    const [isAutoScroll, setIsAutoScroll] = React.useState(true); 
    const [activeIndex, setActiveIndex] = React.useState(-1);  
    const [showAudioWarning, setShowAudioWarning] = React.useState(false);
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);
    // Nút bật/tắt Furigana / Dịch / Tự cuộn GIỐNG trang shadowing video (PodcastPage "chip"): viên thuốc có icon + chữ, bấm là bật/tắt ngay, nút sáng màu khi đang bật (user 26/11: chuyển lên thanh trên).
    const chip = (on, tone = 'blue') => `flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
        on ? (tone === 'green' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-[#E3EEFF] border-[#2F7DF6] text-[#2F7DF6]') : 'bg-white border-[#D3E4FC] text-[#5B6B85] hover:border-[#93C5FD]'
    }`;
    const triggerAudioWarning = () => {
        if (!hasWarnedAudioGlobal) {
            setShowAudioWarning(true);
            hasWarnedAudioGlobal = true; // Đánh dấu là đã hiện
        }
    };
    const closeAudioWarning = (e) => {
        if (e) e.stopPropagation();
        setShowAudioWarning(false);
    };
    
    const lineRefs = React.useRef([]);
    const soundRef = React.useRef(null); 
    const timerRef = React.useRef(null); 
    const scrollRef = React.useRef(null);
    const stopAtTimeRef = React.useRef(null);
    const isMutedRef = React.useRef(false);
    // TẮT TIẾNG THEO NGƯỜI NÓI (user 26/11: "bấm tắt loa người A/B mà vẫn phát audio"): chốt chắc 4 điểm
    // (1) tắt NGAY trước khi bắt đầu phát (trước đây chỉ vòng lặp mỗi khung hình mới tắt -> đầu câu của người bị tắt lọt ~0,1 s khi bấm vào câu / bấm phát)
    // (2) luôn đọc mutedSp MỚI NHẤT (ref), (3) đang đứng trong câu của người KHÔNG tắt thì luôn có tiếng, (4) đệm trước 0,12 s / sau 0,08 s quanh câu bị tắt.
    const mutedSpRef = React.useRef({});
    mutedSpRef.current = mutedSp;
    const canTatTieng = (t) => {
        const ms = mutedSpRef.current;
        if (!Object.values(ms).some(Boolean)) return false;
        let trong = null;
        let sat = false;
        for (const c of (lesson.conversations || [{ dialogues: lesson.dialogues }])) {
            for (const l of (c.dialogues || [])) {
                if (l.startTime === undefined || l.endTime === undefined) continue;
                if (t >= l.startTime && t <= l.endTime) trong = l;
                if (ms[l.speaker] && t + 0.12 >= l.startTime && t <= l.endTime + 0.08) sat = true;
            }
        }
        return trong ? !!ms[trong.speaker] : sat;
    };
    // mute() của Howler + ép thẳng thẻ <audio> (chế độ html5) cho chắc trên mọi trình duyệt
    const datTatTieng = (howl, tat) => {
        if (!howl) return;
        howl.mute(tat);
        try { (howl._sounds || []).forEach((s) => { if (s && s._node) s._node.muted = tat; }); } catch { /* bỏ qua */ }
    };
    // --- HÀM TẢI VÀ PHÁT AUDIO THỦ CÔNG (LAZY LOAD) ---
    // Bài chưa nối file nghe (vd cuốn "200 cụm ngắn", 25/11: dữ liệu vào trước, âm thanh nối sau) -> không có audioPath:
    // chỉ xem chữ, nút phát bị khóa + hiện dòng báo, tuyệt đối không gọi Howl (tránh lỗi đọc .startsWith của undefined).
    const hasAudio = !!lesson.audioPath;
    const lessonRef = React.useRef(lesson);
    lessonRef.current = lesson;
    const initAndPlayAudio = async (startTime = 0) => {
        if (!hasAudio) return;
        if (isAudioLoading) return; // Chống spam click khi đang tải
        setIsAudioLoading(true);
        // URL file nghe = liên kết ký số từ VPS (chỉ tài khoản có quyền) - xem utils/kaiwaApi.ts
        const lessonLuc = lesson;
        let audioSrc;
        try {
            audioSrc = await fetchKaiwaAudioUrl(lesson.audioPath);
        } catch (e) {
            if (lessonRef.current !== lessonLuc) return; // đã chuyển bài trong lúc chờ
            setIsAudioLoading(false);
            alert(kaiwaErrorMessage(e));
            return;
        }
        if (lessonRef.current !== lessonLuc) return; // đã chuyển bài trong lúc chờ: không tạo Howl của bài cũ

        isMutedRef.current = false; // Howl mới chưa bị tắt tiếng
        const howlInstance = new Howl({
            src: [audioSrc],
            html5: true, 
            preload: true,
            onload: function() {
                // FIX LỖI DÍNH ÂM THANH
                if (soundRef.current !== howlInstance) {
                    howlInstance.unload(); 
                    return; 
                }

                setDuration(this.duration());
                setIsAudioLoading(false); 
                
                this.rate(playbackRate); 

                // Tua đến đúng chỗ nếu bấm vào câu thoại
                if (startTime > 0) {
                    this.seek(startTime);
                    setCurrentTime(startTime);
                }
                
                { const tat = canTatTieng(startTime > 0 ? startTime : 0); datTatTieng(this, tat); isMutedRef.current = tat; } // tắt tiếng ĐÚNG ngay từ mili-giây đầu
                this.play();
                setIsPlaying(true);
                triggerAudioWarning();
            },
            onloaderror: function() {
                if (soundRef.current !== howlInstance) return;
                setIsAudioLoading(false);
                // bỏ liên kết + Howl hỏng để lần bấm sau tải lại từ đầu
                forgetKaiwaAudioUrl(lesson.audioPath);
                soundRef.current = null;
                howlInstance.unload();
                alert("Lỗi tải âm thanh!");
            },
            onend: function() {
                if (soundRef.current !== howlInstance) return;
                
                // TỰ ĐỘNG LẶP LẠI: Tua về 0 và tiếp tục phát
                this.seek(0);
                setCurrentTime(0);
                { const tat = canTatTieng(0); datTatTieng(this, tat); isMutedRef.current = tat; }
                this.play();
            }
        });

        // Gán instance vừa tạo vào biến toàn cục để theo dõi
        soundRef.current = howlInstance;
    };
    
    // --- 1. CHỈ DỌN DẸP KHI CHUYỂN BÀI MỚI ---
    React.useEffect(() => {
        if (soundRef.current) {
            soundRef.current.unload();
            soundRef.current = null; // Đưa về null để báo là chưa tải file
        }
        setIsPlaying(false);
        setCurrentTime(0);
        setActiveIndex(-1);
        setIsAudioLoading(false);

        if (scrollRef.current) scrollRef.current.scrollTop = 0;

        return () => {
            if (soundRef.current) {
                soundRef.current.unload();
                soundRef.current = null;
            }
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
        };
    }, [lesson]);

    // --- 2. CẬP NHẬT TỐC ĐỘ PHÁT ---
    React.useEffect(() => {
        if (soundRef.current) { 
            soundRef.current.rate(playbackRate); 
        }
    }, [playbackRate]);

    // --- 3. VÒNG LẶP 60FPS: TRACKING THỜI GIAN & TẮT ÂM THANH CHUẨN XÁC ---
    React.useEffect(() => {
        const convs = lesson.conversations || [{ dialogues: lesson.dialogues }];
        const flatLines = [];
        let viTri = 0; // vị trí câu TRÊN MÀN HÌNH (đếm cả câu không có mốc âm thanh, vd câu đĩa CD không đọc) để tô sáng / cuộn đúng câu
        convs.forEach(conv => {
            conv.dialogues.forEach(line => {
                const i = viTri++;
                if (line.startTime !== undefined && line.endTime !== undefined) {
                    flatLines.push({ startTime: line.startTime, endTime: line.endTime, viTri: i });
                }
            });
        });

        const step = () => {
            if (soundRef.current && isPlaying && !isDragging) {
                const seekTime = soundRef.current.seek();
                
                // Đề phòng Howler trả về mảng khi đang loading
                if (typeof seekTime === 'number') {
                    setCurrentTime(seekTime);

                    if (stopAtTimeRef.current !== null && seekTime >= stopAtTimeRef.current) {
                        soundRef.current.pause();
                        setIsPlaying(false);
                        stopAtTimeRef.current = null; // Xóa mốc thời gian
                        return; // Dừng vòng lặp hiện tại
                    } 
                    
                    let foundIndex = -1;
                    // Quét để tìm câu đang nói (UI sáng)
                    for (let i = 0; i < flatLines.length; i++) {
                        const line = flatLines[i];
                        if (seekTime >= line.startTime && seekTime <= line.endTime) {
                            foundIndex = line.viTri;
                        }
                    }

                    // Tự động cuộn UI
                    if (foundIndex !== activeIndex) {
                        setActiveIndex(foundIndex);
                        if (foundIndex !== -1 && isAutoScroll && lineRefs.current[foundIndex]) {
                            lineRefs.current[foundIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }

                    // Tắt tiếng triệt để (Đã tối ưu cho HTML5 Audio)
                    const shouldMute = canTatTieng(seekTime);
                    if (shouldMute !== isMutedRef.current) {
                        datTatTieng(soundRef.current, shouldMute);
                        isMutedRef.current = shouldMute;
                    }
                }
            } else if (soundRef.current && !isPlaying) {
                // Nhả âm lượng khi ấn Pause
                if (isMutedRef.current) {
                    soundRef.current.mute(false);
                    isMutedRef.current = false;
                }
            }
            
            timerRef.current = requestAnimationFrame(step);
        };

        if (isPlaying) {
            timerRef.current = requestAnimationFrame(step);
        }

        return () => {
            if (timerRef.current) cancelAnimationFrame(timerRef.current);
        };
    }, [isPlaying, mutedSp, isAutoScroll, activeIndex, isDragging, lesson]);

    // --- CÁC HÀM TIỆN ÍCH CHO TRÌNH PHÁT ---
    const toggleAudio = () => {
        if (isAudioLoading) return;
        
        // CHƯA TẢI FILE -> Gọi hàm tải và tự động phát
        if (!soundRef.current) {
            initAndPlayAudio(0);
            return;
        }

        // ĐÃ TẢI FILE -> Phát/Dừng bình thường
        if (isPlaying) {
            soundRef.current.pause();
            setIsPlaying(false);
        } else {
            stopAtTimeRef.current = null; 
            { const tat = canTatTieng(Number(soundRef.current.seek()) || 0); datTatTieng(soundRef.current, tat); isMutedRef.current = tat; }
            soundRef.current.play();
            setIsPlaying(true);
            triggerAudioWarning();
        }
    };
    
    const formatTime = (time) => {
        if (isNaN(time)) return "0:00";
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSeek = (e) => {
        if (isAudioLoading) return; // Thêm chặn ở đây
        const time = Number(e.target.value);
        setCurrentTime(time);
        if (soundRef.current) { 
            soundRef.current.seek(time); 
        }
    };

    const cyclePlaybackRate = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        setPlaybackRate(rates[nextIdx]);
    };

    // Bề rộng ước lượng (đơn vị em của chữ Nhật) để bong bóng KHÔNG bị tính hẹp hơn câu: ô ruby (furigana rộng hơn chữ Hán)
    // làm trình duyệt tính bề rộng "vừa nội dung" thiếu vài px -> chữ cuối câu ngắn bị đẩy xuống dòng sớm.
    // Chữ Hán/kana/dấu câu toàn chữ rộng = 1em; ký tự ASCII ~0.6em; ô ruby rộng = max(chữ gốc, furigana * tỉ lệ cỡ chữ).
    const jaWidthEm = (text, isShow, rtRatio) => {
        if (!text) return 0;
        const plain = (s) => [...s].reduce((w, ch) => w + (/[\x00-\x7f]/.test(ch) ? 0.6 : 1), 0);
        let total = 0;
        text.replace(/_/g, '').split(/(\[[^\[\]]+\]\([^)]+\))/g).forEach((part) => {
            const m = part.match(/^\[([^\[\]]+)\]\(([^)]+)\)$/);
            if (m) total += Math.max(plain(m[1]), isShow ? [...m[2]].length * rtRatio : 0);
            else total += plain(part);
        });
        return total + 1;   // +1em dự phòng (ước lượng thiên về RỘNG hơn thực tế để không bao giờ bị hẹp)
    };
    // Furigana vẽ bằng KaiwaFuri.jsx - CÙNG QUY TẮC các trang khác (user 26/11): chữ đọc không làm cao dòng, dài hơn chữ Hán thì CO NGANG (không giảm cỡ chữ),
    // dòng không có furigana giãn dòng thường (1.625); dòng CÓ furigana (đang bật) tự cao thêm vì chữ đọc nằm trong dòng của nó, không chạm dòng trên. kieu: 'thoai' | 'tieude' | 'giaithich'. Màu xám, nét thường.
    const renderFurigana = (text, isShow, kieu = 'thoai') => <Furi text={text} show={isShow} kieu={kieu} />;
// THÊM HOẶC THAY THẾ HÀM CŨ BẰNG HÀM NÀY
    const renderMarkedText = (text, isShowFuri) => {
        if (!text) return null;
        
        // Tách câu thành các mảng dựa trên dấu _ _
        const parts = text.split(/(_[^_]+_)/g);
        
        return parts.map((part, index) => {
            // Nếu đoạn text được bọc bởi _ _
            if (part.startsWith('_') && part.endsWith('_')) {
                const innerText = part.slice(1, -1);
                return (
                    // Đổi màu chữ ở đây
                    <span key={index} className="text-[#2F7DF6]">
                        {renderFurigana(innerText, isShowFuri)}
                    </span>
                );
            }
            // Những phần chữ thường thì render bình thường
            return <React.Fragment key={index}>{renderFurigana(part, isShowFuri)}</React.Fragment>;
        });
    };
    let globalLineIndex = 0;
    // Cuốn 700 câu cơ bản N5 (user 26/11, chỉ cuốn này): không có người nói -> mọi câu căn TRÁI và ĐÁNH SỐ THỨ TỰ 1. 2. 3. ... trong bài
    const laBai700 = level === '700caugiaotiepcoban';

    // --- GIAO DIỆN ---
    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            <div className="px-3 sm:px-4 py-3 gap-2 bg-[#F0F6FF] border-b border-[#D3E4FC] flex items-center justify-between sticky top-0 z-10 shadow-sm relative">
                {/* Nút tròn chỉ icon mũi tên - Y HỆT kiểu nút "<" dùng chung ở renderParts/renderList
                    (KaiwaModal.jsx) và các popup khác, thay cho nút chữ "QUAY LẠI" trước đây. */}
                <button onClick={onBack} aria-label="Quay lại" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors relative z-10 outline-none">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="flex-1 min-w-0 overflow-hidden flex items-center justify-center gap-1.5 sm:gap-2" role="group" aria-label="Tuỳ chọn hiển thị">
                    <button type="button" onClick={() => setShowFurigana(!showFurigana)} aria-pressed={showFurigana} aria-label="Furigana" className={chip(showFurigana)}><span aria-hidden="true" className="w-3.5 h-3.5 flex items-center justify-center -translate-y-px text-[14px] font-medium leading-none" style={{ fontFamily: "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', sans-serif" }}>ふ</span><span className="hidden min-[340px]:inline sm:hidden">Furi</span><span className="hidden sm:inline">Furigana</span></button>
                    <button type="button" onClick={() => setShowTranslation(!showTranslation)} aria-pressed={showTranslation} aria-label="Dịch" className={chip(showTranslation)}><Languages className="w-3.5 h-3.5" /><span className="hidden min-[340px]:inline">Dịch</span></button>
                    <button type="button" onClick={() => setIsAutoScroll(!isAutoScroll)} aria-pressed={isAutoScroll} aria-label="Tự cuộn" className={chip(isAutoScroll)}><Crosshair className="w-3.5 h-3.5" /><span className="hidden min-[340px]:inline sm:hidden">Cuộn</span><span className="hidden sm:inline">Tự cuộn</span></button>
                </div>
                {/* onClick={onBack} (KHÔNG phải onClose) - ở màn nghe này, bấm X CHỈ thoát về đúng
                    màn trước đó (danh sách bài), không thoát hẳn ra ngoài như các màn khác - tránh
                    lỡ tay thoát hết khi đang nghe/luyện tập. */}
                <button onClick={onBack} aria-label="Đóng" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all relative z-10 shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-12 sm:pb-14 custom-scrollbar">
                <div className="mb-6">
                    {/* titleF = tiêu đề có furigana [漢字](かな) (thêm 26/11 bằng scripts/kaiwa-furigana, theo nút Furigana ở thanh trên); bài chưa có thì hiện tiêu đề gốc */}
                    <h2 className="text-3xl font-bold text-zinc-900 mb-2 font-sans" style={{ lineHeight: 1.25 }}>{(lesson.tieuDeF || lesson.titleF) ? renderFurigana(lesson.tieuDeF || lesson.titleF, showFurigana, 'tieude') : (lesson.tieuDe || lesson.title)}</h2>
                    {/* cuốn 125 mẫu: tiêu đề chỉ là TỪ/MẪU CHÍNH (tieuDe/tieuDeF do kaiwaParts rút từ title) + `nghia` = ý nghĩa của mẫu, KHÔNG phải câu ví dụ (user 26/11) */}
                    <p className="text-sm sm:text-base font-medium text-zinc-700 italic">{lesson.nghia || lesson.translation}</p>
                </div>

                {/* ảnh minh hoạ của từ (cuốn tượng thanh, 27/11): cùng khung ảnh của màn chi tiết Từ vựng; bài không có ảnh / không có quyền thì tự ẩn */}
                {lesson.hinh && <div className="mb-6"><HinhTuVung key={lesson.hinh} tep={lesson.hinh} /></div>}

                {lesson.explanation && (
                    <div className="bg-[#F0F6FF] border-l-4 border-[#2F7DF6] p-3 sm:p-4 rounded-r-xl mb-6">
                        <div className="text-sm text-[#1A2A54] font-medium">
                            <span className="flex items-center gap-1 text-[10px] font-black text-[#2F7DF6] uppercase tracking-widest mb-1"><Lightbulb className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />Giải thích</span>
                            
                            {/* DÙNG JAVASCRIPT CHUYỂN ĐỔI TRỰC TIẾP THÀNH THẺ <br/> */}
                            {/* explanationF = phần giải thích có furigana (chỉ chữ Nhật được chú âm), theo nút Furigana */}
                            {String(lesson.explanationF || lesson.explanation)
                                .replace(/\\n/g, '\n')
                                .split('\n')
                                .map((line, index) => (
                                    // MỖI DÒNG 1 khối: dòng không có furigana giãn thường (1.625); dòng có furigana (đang bật) tự cao thêm (cụm furigana nằm trong dòng, xem KaiwaFuri.jsx)
                                    <div key={index} style={{ lineHeight: 1.625 }}>
                                        {lesson.explanationF ? renderFurigana(line, showFurigana, 'giaithich') : line}
                                        {line === '' ? ' ' : null}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                <div className="space-y-12"> 
                    {(lesson.conversations || [{ dialogues: lesson.dialogues }]).map((conv, convIdx, arr) => (
                        <div key={convIdx} className="space-y-4 relative">
                            {arr.length > 1 && (
                                <div className="flex items-center gap-3 sm:gap-4 mb-6 mt-2">
                                    <div className="h-px bg-[#D3E4FC] flex-1 min-w-[12px]"></div>
                                    {/* nhãn đoạn luôn 1 DÒNG (user 26/11): rút gọn bằng rutGonNhan (Tình huống 1 -> TH1 khi dài), tràn thì cắt "…" chứ không xuống dòng */}
                                    <span className="min-w-0 max-w-[86%] whitespace-nowrap overflow-hidden text-ellipsis text-xs sm:text-[13px] font-semibold text-[#435270] bg-white px-3 py-1 rounded-full border border-[#D3E4FC] shadow-sm">
                                        {conv.context ? rutGonNhan(conv.context) : `Đoạn hội thoại ${convIdx + 1}`}
                                    </span>
                                    <div className="h-px bg-[#D3E4FC] flex-1 min-w-[12px]"></div>
                                </div>
                            )}

                            {conv.dialogues.map((line, idx) => {
                                const currentFlatIndex = globalLineIndex++; 
                                const isActive = activeIndex === currentFlatIndex; 
                                
                                const isHidden = !!hiddenSp[line.speaker]; // ẩn chữ riêng từng người nói (nút mắt) 
                                
                                // cuốn 700 câu: mọi câu căn TRÁI (kiểu khung người A); cuốn tượng thanh: khối chỉ có 1 câu (Ví dụ / Mở rộng) cũng căn TRÁI (user 27/11); còn lại: A trái, B phải như cũ
                                const isA = line.speaker === 'A' || laBai700 || (level === 'tuongthanhtuonghinh' && conv.dialogues.length === 1);
                                
                                let boxClass = isA
                                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-sm'
                                    : 'bg-zinc-50 border-blue-200 text-zinc-900 rounded-2xl rounded-tr-sm';

                                if (isActive) {
                                    boxClass = isA 
                                        ? 'bg-green-50 border-[2px] border-green-500 rounded-2xl rounded-tl-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                                        : 'bg-green-50 border-[2px] border-green-500 text-zinc-900 rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]';
                                }

                                return (
                                    <div 
                                        key={`${convIdx}-${idx}`} 
                                        ref={(el) => (lineRefs.current[currentFlatIndex] = el)}
                                        className={`flex w-full items-start gap-2 sm:gap-3 ${isA ? 'flex-row' : 'flex-row-reverse'} transition-all duration-300`}
                                    >
                                        {laBai700 && <span className="shrink-0 w-6 sm:w-7 mt-3 sm:mt-4 text-sm sm:text-base font-bold text-zinc-500 tabular-nums">{currentFlatIndex + 1}.</span>}
                                        <div className={`flex flex-col min-w-0 flex-1 ${isA ? 'items-start' : 'items-end'}`}>
                                        {line.speaker ? (
                                        <div className={`flex items-center gap-2 mb-1 px-1 ${isA ? 'flex-row' : 'flex-row-reverse'}`}>
                                            <span className={`text-xs sm:text-[13px] font-black uppercase tracking-wide transition-colors ${isActive ? 'text-green-600' : 'text-zinc-700'}`}>
                                                Người {line.speaker}
                                            </span>
                                            {line.speaker ? (
                                                <NutNguoiNoi
                                                    s={line.speaker}
                                                    muted={mutedSp[line.speaker]}
                                                    hidden={hiddenSp[line.speaker]}
                                                    onMute={() => doiTatTieng(line.speaker)}
                                                    onHide={() => setHiddenSp((p) => ({ ...p, [line.speaker]: !p[line.speaker] }))}
                                                />
                                            ) : null}
                                        </div>
                                        ) : null}
                                        <div 
            onClick={(e) => {
                if (line.startTime === undefined) return;
                
                // THÊM DÒNG NÀY ĐỂ CHẶN CLICK KHI ĐANG LOAD FILE (Chống chồng âm thanh)
                if (isAudioLoading) return;
                
                // CHƯA TẢI FILE -> Đặt mốc thời gian dừng rồi gọi hàm tải
                if (!soundRef.current) {
                    stopAtTimeRef.current = line.endTime;
                    initAndPlayAudio(line.startTime);
                    return;
                }

                // ĐÃ TẢI FILE -> Seek và phát như cũ
                soundRef.current.seek(line.startTime);
                setCurrentTime(line.startTime);
                
                if (isPlaying && stopAtTimeRef.current === null) {
                    stopAtTimeRef.current = null;
                } else {
                    stopAtTimeRef.current = line.endTime;
                    if (!isPlaying) {
                        { const tat = canTatTieng(line.startTime); datTatTieng(soundRef.current, tat); isMutedRef.current = tat; }
                        soundRef.current.play();
                        setIsPlaying(true);
                        triggerAudioWarning();
                    }
                }
            }}
            /* min-w: đủ rộng để cả câu Nhật nằm trên 1 dòng (nếu vừa trong max-w) - xem jaWidthEm; --nb/--ns = px ở cỡ chữ 16px / 18px (cộng padding + viền) */
            style={isHidden ? undefined : { '--nb': `${Math.ceil(jaWidthEm(line.ja, showFurigana, 0) * 16 + 40)}px`, '--ns': `${Math.ceil(jaWidthEm(line.ja, showFurigana, 0) * 18 + 44)}px` }}
            className={`${laBai700 ? 'max-w-full min-w-[min(var(--nb),100%)] sm:min-w-[min(var(--ns),100%)]' : 'max-w-[80%] md:max-w-[65%] min-w-[min(var(--nb),80%)] sm:min-w-[min(var(--ns),80%)] md:min-w-[min(var(--ns),65%)]'} p-3 sm:p-4 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98] ${boxClass}`}
        >
                                          {/* cuốn 700: bối cảnh tiếng Việt ở DÒNG TRÊN, câu tiếng Nhật ở dòng dưới (trường boiCanh, user 26/11) */}
                                            {line.boiCanh ? <span className="block mb-1 text-[13px] sm:text-sm font-medium leading-snug text-zinc-500">({line.boiCanh})</span> : null}
                                          <p style={{ lineHeight: 1.625 }} className={`text-base sm:text-lg font-bold font-sans transition-all duration-300 ${isHidden ? 'filter blur-[4px] opacity-40 select-none' : ''}`}>
    {isHidden ? "（あなたが話す番です）" : renderMarkedText(line.ja, showFurigana)}
</p>
                                            {showTranslation && (
                                                <p className={`text-sm sm:text-base mt-2 font-medium border-t pt-2 transition-colors ${isActive ? 'text-green-700 border-green-200' : 'text-zinc-500 border-zinc-200'}`}>
                                                    {line.vi}
                                                </p>
                                            )}
                                        </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* THANH PLAYER AUDIO Ở DƯỚI - tông xanh đồng bộ theme chính thay vì đen/zinc cũ */}
            <div className="w-full shrink-0 bg-white border-t border-[#D3E4FC] px-4 py-3 sm:py-2 flex flex-col gap-2 sm:gap-1 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
                {!hasAudio && (
                    <p className="text-center text-[11px] font-bold text-[#8B9BB8]">Bài này chưa có file nghe</p>
                )}
                <div className="flex items-center gap-3 w-full">
                    <span className="text-[10px] font-bold text-[#5B6B85] w-8 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range" min={0} max={duration || 100} value={currentTime}
                        onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
                        onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
                        onChange={handleSeek}
                        className="flex-1 h-1.5 accent-[#2F7DF6] bg-[#E3EEFF] rounded-full appearance-none cursor-pointer"
                    />
                    <span className="text-[10px] font-bold text-[#5B6B85] w-8">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center justify-between w-full">
                    <button onClick={cyclePlaybackRate} className="w-12 py-1.5 sm:py-[5px] text-[10px] font-black text-[#2F7DF6] bg-[#F0F6FF] rounded-md hover:bg-[#E3EEFF] transition-colors active:scale-95 text-center">
                        {playbackRate}x
                    </button>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button onClick={onPrev} disabled={currentIndex === 0} className={`p-2 sm:p-[7px] rounded-full transition-all active:scale-90 ${currentIndex === 0 ? 'text-[#D3E4FC]' : 'text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF]'}`}>
                            <svg width="20" height="20" className="sm:w-[19px] sm:h-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.max(0, cur - 3)); setCurrentTime(Math.max(0, cur - 3)); } }} className="p-2 sm:p-[7px] text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF] rounded-full transition-all active:scale-90" aria-label="Lùi 3 giây">
                            <svg width="18" height="18" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button
                            onClick={toggleAudio}
                            disabled={isAudioLoading || !hasAudio}
                            className={`w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-md mx-1 ${(isAudioLoading || !hasAudio) ? 'bg-[#93A3BE] text-white cursor-not-allowed' : 'bg-[#2F7DF6] text-white hover:bg-[#1E5FD9] active:scale-90'}`}
                        >
                            {isAudioLoading ? (
                                // THÊM MỚI: Hiệu ứng 3 dấu chấm nảy gợn sóng
                                <div className="flex space-x-1 justify-center items-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                </div>
                            ) : isPlaying ? (
                                <svg width="18" height="18" className="sm:w-[17px] sm:h-[17px]" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-1 sm:w-[17px] sm:h-[17px]"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                            )}
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.min(duration, cur + 3)); setCurrentTime(Math.min(duration, cur + 3)); } }} className="p-2 sm:p-[7px] text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF] rounded-full transition-all active:scale-90" aria-label="Tiến 3 giây">
                            <svg width="18" height="18" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        <button onClick={onNext} disabled={currentIndex === total - 1} className={`p-2 sm:p-[7px] rounded-full transition-all active:scale-90 ${currentIndex === total - 1 ? 'text-[#D3E4FC]' : 'text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF]'}`}>
                            <svg width="20" height="20" className="sm:w-[19px] sm:h-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                    {/* NÚT HƯỚNG DẪN (?) BÊN GÓC PHẢI - tông xanh đồng bộ theme chính */}
                    <div className="w-12 flex justify-end">
                        <button
                            onClick={() => setIsGuideOpen(true)}
                            className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-[#2F7DF6] hover:bg-[#E3EEFF] transition-all active:scale-90"
                            aria-label="Hướng dẫn nhanh"
                        >
                            <svg width="20" height="20" className="sm:w-[19px] sm:h-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
                                {/* KHUNG THÔNG BÁO ÂM THANH */}
           {showAudioWarning && (
                <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-[90%] max-w-[340px] bg-gray-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 border border-gray-700">
                    <div className="flex flex-col">
                        
                        {/* Tiêu đề: Căn giữa (thêm text-center) */}
                        <span className="text-center text-[11px] font-black text-amber-400 uppercase tracking-widest mb-1">
                            Lưu ý âm thanh
                        </span>
                        
                        {/* Nội dung: Căn lề trái (thêm text-left) */}
                        <span className="text-left text-[13px] leading-relaxed font-medium text-gray-200 mt-2 mb-4">
                            Nếu không nghe thấy tiếng, hãy đảm bảo máy đã tắt <b className="text-white">Chế độ Im lặng</b> và thử <b className="text-white">tăng âm lượng</b> lên nhé!
                        </span>
                        
                        {/* Nút bấm */}
                        <button onClick={closeAudioWarning} className="w-full py-2.5 bg-white text-gray-900 text-[11px] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all shadow-sm">
                            Đã hiểu
                        </button>

                    </div>
                    {/* Tam giác nhỏ trỏ xuống dưới */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900/95"></div>
                </div>
            )}
{/* MODAL HƯỚNG DẪN KAIWA (GỌN NHẸ) - vẽ qua PORTAL ra document.body: nếu để trong thẻ bài thì lớp nền tối bị CẮT theo khung thẻ (user 26/11 thấy nền bên ngoài khung không tối), giờ phủ kín cả màn hình như các popup khác */}
            {isGuideOpen && createPortal(
                <div
                    className="fixed inset-0 z-[700] flex items-center justify-center bg-gray-900/20 backdrop-blur-[6px] p-4 animate-in fade-in duration-200"
                    onClick={() => setIsGuideOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-[#D3E4FC] cursor-default"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-[#D3E4FC] bg-[#F0F6FF] flex justify-between items-center shrink-0">
                            <h3 className="font-black text-sm text-[#1A2A54] uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#2F7DF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Hướng dẫn nhanh
                            </h3>
                            <button onClick={() => setIsGuideOpen(false)} aria-label="Đóng" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
                        </div>

                        {/* Content (Đã bỏ overflow-y-auto và flex-1 để ôm sát nội dung) */}
                        <div className="p-4 space-y-3">

                            {/* 1. Xử lý sự cố âm thanh */}
                            <div className="bg-[#F0F6FF] border border-[#D3E4FC] p-3 rounded-2xl">
                                <h4 className="text-xs font-black text-[#1A2A54] uppercase mb-1 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-[#2F7DF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                    Lưu ý Âm thanh
                                </h4>
                                <p className="text-[13px] text-[#5B6B85] font-medium leading-snug">
                                    Không nghe thấy tiếng? Hãy kiểm tra xem điện thoại có đang bật <b>"Chế độ Im lặng"</b> (Gạt rung) không, nếu có thì hãy tắt nó đi và thử <b>tăng âm lượng</b> nhé.
                                </p>
                            </div>

                            {/* 2. Tính năng Luyện tập (Đã xóa tiêu đề và các mục dư thừa) */}
                            <div>
                                <ul className="space-y-2">
                                    <li className="flex gap-2.5 items-start p-2.5 bg-white border border-[#D3E4FC] rounded-xl shadow-sm hover:border-[#93C5FD] transition-colors">
                                        <div className="w-12 h-8 rounded-lg bg-[#DCEAFE] text-[#2F7DF6] flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-[#1A2A54] mb-0.5 leading-tight">Phát lại một câu</span>
                                            <span className="block text-xs text-[#5B6B85] font-medium leading-snug">Bấm trực tiếp vào <b>câu thoại</b>, hệ thống sẽ tự tua và đọc lại.</span>
                                        </div>
                                    </li>
                                    {/* chỉ hiện khi bài có người nói (cuốn 700 câu không có nút loa / mắt) */}
                                    {nguoiNoi.length > 0 && (
                                        <li className="flex gap-2.5 items-start p-2.5 bg-white border border-[#D3E4FC] rounded-xl shadow-sm hover:border-[#93C5FD] transition-colors">
                                            <div className="w-12 h-8 rounded-lg bg-[#DCEAFE] text-[#2F7DF6] flex items-center justify-center shrink-0 gap-2">
                                                <Volume2 className="w-4 h-4" strokeWidth={2.5} />
                                                <Eye className="w-4 h-4" strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <span className="block text-sm font-bold text-[#1A2A54] mb-0.5 leading-tight">Tắt tiếng / ẩn chữ từng người</span>
                                                <span className="block text-xs text-[#5B6B85] font-medium leading-snug">Bấm icon <b>loa</b> cạnh tên <b>Người A / B</b> để tắt tiếng người đó, icon <b>mắt</b> để ẩn chữ. Không thể tắt tiếng cả hai người cùng lúc.</span>
                                            </div>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-[#D3E4FC] bg-white shrink-0">
                            <button
                                onClick={() => setIsGuideOpen(false)}
                                className="w-full py-3 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest"
                            >
                                Đã rõ, Đóng lại
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}

export default KaiwaPracticeView;
