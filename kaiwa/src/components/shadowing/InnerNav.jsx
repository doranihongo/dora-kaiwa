import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { HREF } from '../../utils/route';

// Thanh nav BÊN TRONG 1 cuốn sách (chép từ InnerNav.jsx của web Phá Đảo, chỉ giữ phần trang Kaiwa dùng): nút lùi + tên trang sẽ quay về
// + TRANG CHỦ; ở giữa là nút CHỌN GIÁO TRÌNH (bảng thả xuống) kẹp giữa 2 mũi tên sách trước / sau. Từ lg nằm GIỮA thanh trên (lưới 3 cột);
// dưới lg thành thanh cố định ở ĐÁY màn hình. Thanh fixed nên <main> phải bù padding.
// tab: { key, label, prevHref, nextHref, menuWidth?, menu: [{ key, label, href, active }] }
const NAV_FONT_STYLE = { fontFamily: 'ui-sans-serif, system-ui, sans-serif' };
const NO_TAP = { WebkitTapHighlightColor: 'transparent' };

export default function InnerNav({ backHref, backLabel, tab }) {
    const [openMenu, setOpenMenu] = useState(false);
    const topBarRef = useRef(null);
    const bottomBarRef = useRef(null);
    // Bấm ra ngoài 2 thanh hoặc Esc -> đóng bảng.
    useEffect(() => {
        if (!openMenu) return undefined;
        const inBar = (el) => (topBarRef.current && topBarRef.current.contains(el)) || (bottomBarRef.current && bottomBarRef.current.contains(el));
        const onDown = (e) => { if (!inBar(e.target)) setOpenMenu(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpenMenu(false); };
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [openMenu]);

    // Kéo mục ĐANG XEM vào giữa bảng ngay khi mở (chỉnh scrollTop của riêng bảng, không scrollIntoView vì bảng nằm trong thanh fixed).
    const centerActiveItem = useCallback((el) => {
        if (!el) return;
        const active = el.querySelector('[aria-current="true"]');
        if (!active) return;
        el.scrollTop = Math.max(0, active.offsetTop - el.clientHeight / 2 + active.clientHeight / 2);
    }, []);
    const menuPanel = (up) => (
        <div
            ref={centerActiveItem}
            className={`absolute left-1/2 -translate-x-1/2 z-50 ${tab.menuWidth || 'w-44'} max-h-72 overflow-y-auto no-scrollbar rounded-2xl border border-[#D3E4FC] bg-white py-1 shadow-lg ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
            {tab.menu.map((m) => (
                <a
                    key={m.key}
                    href={m.href}
                    aria-current={m.active ? 'true' : undefined}
                    onClick={() => setOpenMenu(false)}
                    style={NO_TAP}
                    className={`block px-4 py-2.5 text-sm font-semibold ${m.active ? 'bg-[#E3EEFF] text-[#2F7DF6]' : 'text-[#33456B] hover:bg-[#F0F6FF]'}`}
                >{m.label}</a>
            ))}
        </div>
    );

    // Nút mũi tên sách trước / sau. href = null -> mờ, không bấm được. big = ô to ở thanh đáy điện thoại.
    const stepBtn = (href, dir, big) => {
        const Icon = dir < 0 ? ChevronLeft : ChevronRight;
        const label = dir < 0 ? 'Sách trước' : 'Sách sau';
        const cls = big
            ? `relative w-14 h-full flex items-center justify-center transition-colors ${href ? 'text-[#2F7DF6]' : 'text-[#C6D0E0]'}`
            : `w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition-colors ${href ? 'bg-gray-100 hover:bg-gray-200 text-[#2F7DF6]' : 'bg-gray-100 text-[#C6D0E0]'}`;
        const icon = <Icon className={big ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={3} />;
        return href
            ? <a href={href} aria-label={label} style={NO_TAP} className={cls}>{icon}</a>
            : <span aria-hidden="true" className={cls}>{icon}</span>;
    };

    const menuButton = (className) => (
        <button type="button" aria-haspopup="true" aria-expanded={openMenu} onClick={() => setOpenMenu(!openMenu)} style={NO_TAP} className={className}>
            {tab.label}
        </button>
    );

    return (
        <>
            <nav ref={topBarRef} className="fixed top-0 left-0 right-0 z-40 bg-[#F0F6FF] border-b border-[#D3E4FC]" style={NAV_FONT_STYLE}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-14 sm:h-16 gap-2 lg:grid lg:grid-cols-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <a href={backHref} aria-label="Quay lại" style={NO_TAP} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none">
                                <ArrowLeft className="w-5 h-5" strokeWidth={3} />
                            </a>
                            <a href={backHref} aria-label="Quay lại" style={NO_TAP} className="flex items-center text-base sm:text-lg font-black text-blue-800 uppercase whitespace-nowrap">{backLabel}</a>
                        </div>
                        <div className="hidden lg:flex items-center justify-center gap-1.5 min-w-0">
                            {stepBtn(tab.prevHref, -1, false)}
                            <div className="relative">
                                {menuButton(`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 flex items-center ${openMenu ? 'bg-[#E3EEFF] text-[#2F7DF6]' : 'text-[#5B6B85] hover:bg-[#E3EEFF] hover:text-[#2F7DF6]'}`)}
                                {openMenu && menuPanel(false)}
                            </div>
                            {stepBtn(tab.nextHref, 1, false)}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 lg:justify-self-end">
                            <a href={HREF.home} style={NO_TAP} className="inline-flex items-center px-4 h-10 bg-[#DCEAFE] hover:bg-[#BFDBFE] active:scale-95 transition-all rounded-full text-sm font-bold text-[#2F7DF6] shadow-sm whitespace-nowrap">TRANG CHỦ</a>
                        </div>
                    </div>
                </div>
            </nav>

            <nav ref={bottomBarRef} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D3E4FC] pb-[env(safe-area-inset-bottom)]" style={{ boxShadow: '0 -4px 12px rgba(35, 55, 109, 0.08)', ...NAV_FONT_STYLE }}>
                <div className="flex items-center justify-center h-16">
                    {stepBtn(tab.prevHref, -1, true)}
                    <div className="relative h-full w-48">
                        {menuButton(`w-full h-full flex items-center justify-center font-bold text-base transition-colors ${openMenu ? 'text-[#2F7DF6]' : 'text-[#8B9BB8]'}`)}
                        {openMenu && menuPanel(true)}
                    </div>
                    {stepBtn(tab.nextHref, 1, true)}
                </div>
            </nav>
        </>
    );
}
