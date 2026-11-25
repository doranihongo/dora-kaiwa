import { ChevronLeft } from 'lucide-react';
import UserAccountMenu from './UserAccountMenu';
import { DATA_BASE } from '../utils/dataBase';
import { HREF } from '../utils/route';

// =====================================================================================
// THANH CÔNG CỤ DÙNG CHUNG của web - cùng thiết kế với KanjiNav.jsx của web Phá Đảo Tiếng Nhật
// (phiên bản "centerTabs" mà /kaiwa/sach/ và /kaiwa/video/ bên đó dùng):
//   - MÁY TÍNH (từ lg = 1024px): thanh cố định trên cùng, nền #F0F6FF, viền dưới #D3E4FC, chia 3 cột đều
//     nhau: trái = nút "<" + logo, giữa = các tab dạng viên thuốc, phải = nút TRANG CHỦ + avatar tài khoản.
//   - ĐIỆN THOẠI / iPad dọc (dưới lg): thanh trên gọn (nút "<", logo, TRANG CHỦ, avatar) + THANH TAB DƯỚI
//     cố định ở đáy màn hình (nền trắng, kẻ dọc giữa các tab, chừa vùng an toàn iPhone).
// Trang dùng thanh này phải để chỗ: <main className="pt-16 pb-20 lg:pb-0">.
// Các màn toàn màn hình (popup luyện tập, buổi học...) có z-index cao hơn z-40 nên tự che thanh này,
// không cần logic ẩn/hiện riêng.
// =====================================================================================

// Ép font hệ thống để thanh giống hệt nhau ở mọi trang (như NAV_FONT_STYLE bên KanjiNav).
const NAV_FONT_STYLE = { fontFamily: 'ui-sans-serif, system-ui, sans-serif' } as const;
const NO_TAP = { WebkitTapHighlightColor: 'transparent' } as const;

export type NavTabKey = 'shadowing' | 'nghechinhta' | 'podcast';

export const NAV_TABS: { key: NavTabKey; label: string; href: string }[] = [
  { key: 'shadowing', label: 'Sách kaiwa', href: HREF.shadowing },
  { key: 'nghechinhta', label: 'Nghe chính tả', href: HREF.nghechinhta },
  { key: 'podcast', label: 'Video shadowing', href: HREF.podcast },
];

export default function SiteNav({ active = null }: { active?: NavTabKey | null }) {
  // Trang chủ không có tab nào sáng + không có nút "<" / TRANG CHỦ (đang ở đó rồi).
  const isHome = active === null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-[#F0F6FF] border-b border-[#D3E4FC]" style={NAV_FONT_STYLE}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2 lg:grid lg:grid-cols-3">
            {/* Trái: nút "<" (về trang chủ) + logo DORA - cả hai đều là thẻ <a> bấm được. */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {!isHome && (
                <a
                  href={HREF.home}
                  aria-label="Về trang chủ"
                  style={NO_TAP}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none"
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={3} />
                </a>
              )}
              <a href={HREF.home} aria-label="DORA KAIWA" style={NO_TAP} className="flex items-center min-w-0">
                <img src={`${DATA_BASE}/logo-dora.webp`} className="relative -top-1.5 h-7 w-auto object-contain flex-shrink-0" alt="DORA" />
              </a>
            </div>

            {/* Giữa (chỉ máy tính): các tab công cụ học. */}
            <div className="hidden lg:flex items-center justify-center gap-1">
              {NAV_TABS.map((t) => (
                <a
                  key={t.key}
                  href={t.href}
                  aria-current={active === t.key ? 'page' : undefined}
                  style={NO_TAP}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                    active === t.key ? 'bg-[#E3EEFF] text-[#2F7DF6]' : 'text-[#5B6B85] hover:bg-[#E3EEFF] hover:text-[#2F7DF6]'
                  }`}
                >
                  {t.label}
                </a>
              ))}
            </div>

            {/* Phải: trang chủ có avatar tài khoản; trang con chỉ có nút TRANG CHỦ (avatar CHỈ ở trang chủ). */}
            <div className="flex items-center gap-2 flex-shrink-0 lg:justify-self-end">
              {isHome ? (
                <UserAccountMenu />
              ) : (
                <a
                  href={HREF.home}
                  style={NO_TAP}
                  className="inline-flex items-center px-4 h-10 bg-[#DCEAFE] hover:bg-[#BFDBFE] active:scale-95 transition-all rounded-full text-sm font-bold text-[#2F7DF6] shadow-sm flex-shrink-0 whitespace-nowrap"
                >
                  TRANG CHỦ
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* THANH TAB DƯỚI - chỉ điện thoại + iPad dọc (dưới lg). Kẻ dọc ngắn (h-7) căn giữa trước mỗi tab trừ tab đầu. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#D3E4FC] pb-[env(safe-area-inset-bottom)]"
        style={{ boxShadow: '0 -4px 12px rgba(35, 55, 109, 0.08)', ...NAV_FONT_STYLE }}
      >
        <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${NAV_TABS.length}, minmax(0, 1fr))` }}>
          {NAV_TABS.map((t, index) => (
            <a
              key={t.key}
              href={t.href}
              aria-current={active === t.key ? 'page' : undefined}
              style={NO_TAP}
              className={`relative flex items-center justify-center px-2 text-sm font-bold whitespace-nowrap transition-colors ${
                active === t.key ? 'text-[#2F7DF6]' : 'text-[#8B9BB8]'
              }`}
            >
              {index > 0 && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-px bg-gray-200" />}
              {t.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
