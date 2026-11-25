import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Howl } from 'howler';
import { DATA_BASE } from '../../utils/dataBase';

// Cờ "đã hiện thông báo âm thanh 1 lần" (bản gốc khai báo ở KaiwaModal.jsx nhưng không thấy được từ file này).
let hasWarnedAudioGlobal = false;

const KaiwaPracticeView = ({ lesson, total, currentIndex, onBack, onNext, onPrev, onTick }) => {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [isAudioLoading, setIsAudioLoading] = React.useState(false);
    const [showTranslation, setShowTranslation] = React.useState(false);
    const [roleplayMode, setRoleplayMode] = React.useState('all'); 
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);
    const [playbackRate, setPlaybackRate] = React.useState(1);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showFurigana, setShowFurigana] = React.useState(false);
    const [isAutoScroll, setIsAutoScroll] = React.useState(true); 
    const [activeIndex, setActiveIndex] = React.useState(-1);  
    const [showAudioWarning, setShowAudioWarning] = React.useState(false);
    const [hideText, setHideText] = React.useState(false);
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);
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
    // ================= BỘ ĐẾM GIỜ LÀM NHIỆM VỤ =================
    React.useEffect(() => {
        let interval;
        if (isPlaying) {
            // Nếu đang phát nhạc, cứ đúng 1 giây (1000ms) lại gõ cửa cha 1 lần
            interval = setInterval(() => {
                if (onTick) onTick();
            }, 1000);
        }
        return () => clearInterval(interval); // Dừng đếm khi tắt nhạc
    }, [isPlaying, onTick]);
    // ===========================================================

    // --- HÀM TẢI VÀ PHÁT AUDIO THỦ CÔNG (LAZY LOAD) ---
    // --- HÀM TẢI VÀ PHÁT AUDIO THỦ CÔNG (LAZY LOAD) ---
    const initAndPlayAudio = (startTime = 0) => {
        if (isAudioLoading) return; // Chống spam click khi đang tải
        setIsAudioLoading(true);

        // lesson.audioPath trong file JSON (public/data/sachkaiwa/*.json) lưu dạng TƯƠNG ĐỐI
        // "./data/filenghesachkaiwa/..." - ghép với DATA_BASE (gốc web: "" hoặc "/dora-kaiwa" khi chạy ở
        // GitHub Pages dạng project page) để luôn ra đường dẫn đúng bất kể đang ở trang nào.
        // (Dự án Dora) Giữ cách phát của các công cụ âm thanh khác trong app: Web Audio (html5: false) +
        // volume 1.5 - nghe to hơn và mute()/seek() chính xác theo từng câu thoại.
        const audioSrc = /^https?:\/\//.test(lesson.audioPath) ? lesson.audioPath : `${DATA_BASE}/${lesson.audioPath.replace(/^\.\//, '')}`;
        const howlInstance = new Howl({
            src: [audioSrc],
            html5: false,
            volume: 1.5,
            preload: true,
            onload: function() {
                // FIX LỖI DÍNH ÂM THANH
                if (soundRef.current !== howlInstance) {
                    howlInstance.unload();
                    return;
                }

                this.volume(1.5);
                setDuration(this.duration());
                setIsAudioLoading(false); 
                
                this.rate(playbackRate); 

                // Tua đến đúng chỗ nếu bấm vào câu thoại
                if (startTime > 0) {
                    this.seek(startTime);
                    setCurrentTime(startTime);
                }
                
                this.play();
                setIsPlaying(true);
                triggerAudioWarning();
            },
            onloaderror: function() {
                if (soundRef.current !== howlInstance) return;
                setIsAudioLoading(false);
                alert("Lỗi tải âm thanh!");
            },
            onend: function() {
                if (soundRef.current !== howlInstance) return;
                
                // TỰ ĐỘNG LẶP LẠI: Tua về 0 và tiếp tục phát
                this.seek(0);
                setCurrentTime(0);
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
        convs.forEach(conv => {
            conv.dialogues.forEach(line => {
                if (line.startTime !== undefined && line.endTime !== undefined) {
                    flatLines.push(line);
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
                    let currentSpeaker = null;

                    // Quét để tìm câu đang nói và xử lý chặn họng
                    for (let i = 0; i < flatLines.length; i++) {
                        const line = flatLines[i];
                        
                        // Tìm UI đang sáng
                        if (seekTime >= line.startTime && seekTime <= line.endTime) {
                            foundIndex = i;
                        }

                        // Tìm nhân vật để Mute (Trừ hao cực nhẹ 0.05s vì Howler ngắt tức thì)
                        const lookaheadTime = seekTime + 0.05;
                        const isMutedCharacter = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                                 (roleplayMode === 'hideB' && line.speaker === 'B');
                        
                        if (isMutedCharacter && lookaheadTime >= line.startTime && seekTime <= line.endTime) {
                            currentSpeaker = line.speaker;
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
                    const shouldMute = !!currentSpeaker; // Ép kiểu về true/false
                    if (shouldMute !== isMutedRef.current) {
                        soundRef.current.mute(shouldMute); // Dùng mute() thay vì volume()
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
    }, [isPlaying, roleplayMode, isAutoScroll, activeIndex, isDragging, lesson]);

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

    const renderFurigana = (text, isShow) => {
        if (!text) return null;
        const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
        return parts.map((part, index) => {
            const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (match) {
                return (
                    <ruby key={index} className="leading-loose">
                        {match[1]}
                        {isShow && <rt className="text-[11px] sm:text-xs text-indigo-500 font-bold select-none"><span className="sm:inline-block sm:-translate-y-0.5">{match[2]}</span></rt>}
                    </ruby>
                );
            }
            return <span key={index}>{part}</span>;
        });
    };
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
                    <span key={index} className="text-orange-800">
                        {renderFurigana(innerText, isShowFuri)}
                    </span>
                );
            }
            // Những phần chữ thường thì render bình thường
            return <React.Fragment key={index}>{renderFurigana(part, isShowFuri)}</React.Fragment>;
        });
    };
    let globalLineIndex = 0;

    // --- GIAO DIỆN ---
    return (
        <div className="flex flex-col h-full bg-white overflow-hidden relative">
            <div className="px-4 py-3 bg-[#F0F6FF] border-b border-[#D3E4FC] flex items-center justify-between sticky top-0 z-10 shadow-sm relative">
                {/* Nút tròn chỉ icon mũi tên - Y HỆT kiểu nút "<" dùng chung ở renderParts/renderList
                    (KaiwaModal.jsx) và các popup khác, thay cho nút chữ "QUAY LẠI" trước đây. */}
                <button onClick={onBack} aria-label="Quay lại" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors relative z-10 outline-none">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span className="absolute left-1/2 -translate-x-1/2 text-[10px] font-black text-[#5B6B85] tracking-widest bg-white px-3 py-1 rounded-full border border-[#D3E4FC]">
                    {currentIndex + 1} / {total}
                </span>
                {/* onClick={onBack} (KHÔNG phải onClose) - ở màn nghe này, bấm X CHỈ thoát về đúng
                    màn trước đó (danh sách bài), không thoát hẳn ra ngoài như các màn khác - tránh
                    lỡ tay thoát hết khi đang nghe/luyện tập. */}
                <button onClick={onBack} aria-label="Đóng" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all relative z-10 shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8 custom-scrollbar">
                <div className="mb-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-2 leading-tight font-sans">{lesson.title}</h2>
                    <p className="text-sm sm:text-base font-medium text-zinc-500 italic">{lesson.translation}</p>
                </div>

                {lesson.explanation && (
                    <div className="bg-[#F0F6FF] border-l-4 border-[#2F7DF6] p-3 sm:p-4 rounded-r-xl mb-6">
                        <p className="text-sm text-[#1A2A54] leading-relaxed font-medium">
                            <span className="text-[10px] font-black text-[#2F7DF6] uppercase tracking-widest block mb-1">💡 Giải thích</span>
                            
                            {/* DÙNG JAVASCRIPT CHUYỂN ĐỔI TRỰC TIẾP THÀNH THẺ <br/> */}
                            {String(lesson.explanation)
                                .replace(/\\n/g, '\n') 
                                .split('\n')
                                .map((line, index) => (
                                    <React.Fragment key={index}>
                                        {line}
                                        <br />
                                    </React.Fragment>
                                ))}
                                
                        </p>
                    </div>
                )}

                <div className="flex flex-wrap gap-3 justify-between items-center mb-6 pb-4 border-b border-[#D3E4FC]">
                    <div className="flex bg-[#F0F6FF] p-1 rounded-xl">
                        <button onClick={() => setRoleplayMode('all')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'all' ? 'bg-white shadow-sm text-[#1A2A54]' : 'text-[#5B6B85] hover:text-[#1A2A54]'}`}>Nghe hết</button>
                        <button onClick={() => setRoleplayMode('hideA')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'hideA' ? 'bg-[#2F7DF6] text-white shadow-md' : 'text-[#5B6B85] hover:text-[#1A2A54]'}`}>Tập vai A</button>
                        <button onClick={() => setRoleplayMode('hideB')} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all ${roleplayMode === 'hideB' ? 'bg-[#2F7DF6] text-white shadow-md' : 'text-[#5B6B85] hover:text-[#1A2A54]'}`}>Tập vai B</button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {/* THÊM MỚI: Nút Ẩn lời thoại (Chỉ hiện khi chọn Tập vai A hoặc B) */}
                        {roleplayMode !== 'all' && (
                            <label className="flex items-center gap-2 cursor-pointer bg-[#DCEAFE] px-3 py-1.5 sm:py-2 rounded-lg border border-[#93C5FD] hover:bg-[#BFDBFE] transition-colors animate-in zoom-in-95 duration-200">
                                <span className="text-[10px] sm:text-xs font-bold text-[#1E5FD9] uppercase">Ẩn lời thoại</span>
                                <input type="checkbox" checked={hideText} onChange={() => setHideText(!hideText)} className="accent-[#2F7DF6] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                            </label>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer bg-[#F0F6FF] px-3 py-1.5 sm:py-2 rounded-lg border border-[#D3E4FC] hover:bg-[#E3EEFF] transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-[#5B6B85] uppercase">Tự cuộn</span>

                            <input type="checkbox" checked={isAutoScroll} onChange={() => setIsAutoScroll(!isAutoScroll)} className="accent-[#2F7DF6] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-[#F0F6FF] px-3 py-1.5 sm:py-2 rounded-lg border border-[#D3E4FC] hover:bg-[#E3EEFF] transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-[#5B6B85] uppercase">Furigana</span>
                            <input type="checkbox" checked={showFurigana} onChange={() => setShowFurigana(!showFurigana)} className="accent-[#2F7DF6] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-[#F0F6FF] px-3 py-1.5 sm:py-2 rounded-lg border border-[#D3E4FC] hover:bg-[#E3EEFF] transition-colors">
                            <span className="text-[10px] sm:text-xs font-bold text-[#5B6B85] uppercase">Dịch</span>
                            <input type="checkbox" checked={showTranslation} onChange={() => setShowTranslation(!showTranslation)} className="accent-[#2F7DF6] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm"/>
                        </label>
                    </div>
                </div>

                <div className="space-y-8"> 
                    {(lesson.conversations || [{ dialogues: lesson.dialogues }]).map((conv, convIdx, arr) => (
                        <div key={convIdx} className="space-y-4 relative">
                            {arr.length > 1 && (
                                <div className="flex items-center gap-4 mb-6 mt-2">
                                    <div className="h-px bg-[#D3E4FC] flex-1"></div>
                                    <span className="text-[10px] font-black text-[#5B6B85] uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-[#D3E4FC] shadow-sm">
                                        {conv.context ? conv.context : `Đoạn hội thoại ${convIdx + 1}`}
                                    </span>
                                    <div className="h-px bg-[#D3E4FC] flex-1"></div>
                                </div>
                            )}

                            {conv.dialogues.map((line, idx) => {
                                const currentFlatIndex = globalLineIndex++; 
                                const isActive = activeIndex === currentFlatIndex; 
                                
                                // THAY ĐỔI: Chỉ ẩn khi đang chọn vai ĐỒNG THỜI bật tính năng ẩn chữ
                                const isMutedRole = (roleplayMode === 'hideA' && line.speaker === 'A') || 
                                                    (roleplayMode === 'hideB' && line.speaker === 'B');
                                const isHidden = isMutedRole && hideText; 
                                
                                const isA = line.speaker === 'A';
                                
                                let boxClass = isA
                                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 rounded-2xl rounded-tl-sm'
                                    : 'bg-zinc-50 border-blue-800 text-zinc-900 rounded-2xl rounded-tr-sm border-2 shadow-md';

                                if (isActive) {
                                    boxClass = isA 
                                        ? 'bg-green-50 border-[2px] border-green-500 rounded-2xl rounded-tl-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]' 
                                        : 'bg-green-50 border-[2px] border-green-500 text-zinc-900 rounded-2xl rounded-tr-sm shadow-[0_0_15px_rgba(34,197,94,0.2)]';
                                }

                                return (
                                    <div 
                                        key={`${convIdx}-${idx}`} 
                                        ref={(el) => (lineRefs.current[currentFlatIndex] = el)}
                                        className={`flex flex-col w-full ${isA ? 'items-start' : 'items-end'} transition-all duration-300`}
                                    >
                                        <span className={`text-[9px] font-black uppercase tracking-widest mb-1 px-1 transition-colors ${isActive ? 'text-green-600' : 'text-zinc-400'}`}>
                                            Người {line.speaker}
                                        </span>
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
                        soundRef.current.play();
                        setIsPlaying(true);
                        triggerAudioWarning();
                    }
                }
            }}
            className={`max-w-[80%] md:max-w-[65%] p-3 sm:p-4 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-md active:scale-[0.98] ${boxClass}`}
        >
                                          <p className={`text-base sm:text-lg font-bold leading-relaxed font-sans transition-all duration-300 ${isHidden ? 'filter blur-[4px] opacity-40 select-none' : ''}`}>
    {isHidden ? "（あなたが話す番です）" : renderMarkedText(line.ja, showFurigana)}
</p>
                                            {showTranslation && (
                                                <p className={`text-sm sm:text-base mt-2 font-medium border-t pt-2 transition-colors ${isActive ? 'text-green-700 border-green-200' : 'text-zinc-500 border-zinc-200'}`}>
                                                    {line.vi}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* THANH PLAYER AUDIO Ở DƯỚI - tông xanh đồng bộ theme chính thay vì đen/zinc cũ */}
            <div className="w-full shrink-0 bg-white border-t border-[#D3E4FC] px-4 py-3 flex flex-col gap-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-20">
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
                    <button onClick={cyclePlaybackRate} className="w-12 py-1.5 text-[10px] font-black text-[#2F7DF6] bg-[#F0F6FF] rounded-md hover:bg-[#E3EEFF] transition-colors active:scale-95 text-center">
                        {playbackRate}x
                    </button>
                    <div className="flex items-center gap-1 sm:gap-3">
                        <button onClick={onPrev} disabled={currentIndex === 0} className={`p-2 rounded-full transition-all active:scale-90 ${currentIndex === 0 ? 'text-[#D3E4FC]' : 'text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF]'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.max(0, cur - 3)); setCurrentTime(Math.max(0, cur - 3)); } }} className="p-2 text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF] rounded-full transition-all active:scale-90" aria-label="Lùi 3 giây">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button
                            onClick={toggleAudio}
                            disabled={isAudioLoading}
                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md mx-1 ${isAudioLoading ? 'bg-[#93A3BE] cursor-not-allowed' : 'bg-[#2F7DF6] text-white hover:bg-[#1E5FD9] active:scale-90'}`}
                        >
                            {isAudioLoading ? (
                                // THÊM MỚI: Hiệu ứng 3 dấu chấm nảy gợn sóng
                                <div className="flex space-x-1 justify-center items-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                </div>
                            ) : isPlaying ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><polygon points="6 4 19 12 6 20 6 4"></polygon></svg>
                            )}
                        </button>
                        <button onClick={() => { if(soundRef.current) { const cur = soundRef.current.seek(); soundRef.current.seek(Math.min(duration, cur + 3)); setCurrentTime(Math.min(duration, cur + 3)); } }} className="p-2 text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF] rounded-full transition-all active:scale-90" aria-label="Tiến 3 giây">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                        </button>
                        <button onClick={onNext} disabled={currentIndex === total - 1} className={`p-2 rounded-full transition-all active:scale-90 ${currentIndex === total - 1 ? 'text-[#D3E4FC]' : 'text-[#5B6B85] hover:text-[#2F7DF6] hover:bg-[#E3EEFF]'}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>
                    {/* NÚT HƯỚNG DẪN (?) BÊN GÓC PHẢI - tông xanh đồng bộ theme chính */}
                    <div className="w-12 flex justify-end">
                        <button
                            onClick={() => setIsGuideOpen(true)}
                            className="w-9 h-9 flex items-center justify-center rounded-full text-[#2F7DF6] hover:bg-[#E3EEFF] transition-all active:scale-90"
                            aria-label="Hướng dẫn nhanh"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
{/* MODAL HƯỚNG DẪN KAIWA (GỌN NHẸ) */}
            {isGuideOpen && (
                <div 
                    className="fixed inset-0 z-[700] flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" 
                    onClick={() => setIsGuideOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl shadow-2xl w-full max-w-[380px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-[#D3E4FC] cursor-default"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-[#D3E4FC] bg-[#F0F6FF] flex justify-between items-center shrink-0">
                            <h3 className="font-black text-sm text-[#1A2A54] uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-4 h-4 text-[#2F7DF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Hướng dẫn nhanh
                            </h3>
                            <button onClick={() => setIsGuideOpen(false)} aria-label="Đóng" className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E3EEFF] text-[#8B9BB8] hover:bg-red-50 hover:text-red-600 transition-all shadow-sm outline-none"><X className="w-6 h-6" strokeWidth={2.5} /></button>
                        </div>

                        {/* Content (Đã bỏ overflow-y-auto và flex-1 để ôm sát nội dung) */}
                        <div className="p-5 space-y-5">

                            {/* 1. Xử lý sự cố âm thanh */}
                            <div className="bg-[#F0F6FF] border border-[#D3E4FC] p-4 rounded-2xl">
                                <h4 className="text-xs font-black text-[#1A2A54] uppercase mb-2 flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-[#2F7DF6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                    Lưu ý Âm thanh
                                </h4>
                                <p className="text-sm text-[#5B6B85] font-medium leading-relaxed">
                                    Không nghe thấy tiếng? Hãy kiểm tra xem điện thoại có đang bật <b>"Chế độ Im lặng"</b> (Gạt rung) không, nếu có thì hãy tắt nó đi và thử <b>tăng âm lượng</b> nhé.
                                </p>
                            </div>

                            {/* 2. Tính năng Luyện tập (Đã xóa tiêu đề và các mục dư thừa) */}
                            <div>
                                <ul className="space-y-3">
                                    <li className="flex gap-3 items-start p-3 bg-white border border-[#D3E4FC] rounded-xl shadow-sm hover:border-[#93C5FD] transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-[#DCEAFE] text-[#2F7DF6] flex items-center justify-center shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-[#1A2A54] mb-0.5 leading-tight">Phát lại một câu</span>
                                            <span className="block text-xs text-[#5B6B85] font-medium leading-relaxed">Bấm trực tiếp vào <b>câu thoại</b>, hệ thống sẽ tự tua và đọc lại.</span>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-[#D3E4FC] bg-white shrink-0">
                            <button
                                onClick={() => setIsGuideOpen(false)}
                                className="w-full py-3.5 bg-[#2F7DF6] hover:bg-[#1E5FD9] text-white text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 uppercase tracking-widest"
                            >
                                Đã rõ, Đóng lại
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default KaiwaPracticeView;
