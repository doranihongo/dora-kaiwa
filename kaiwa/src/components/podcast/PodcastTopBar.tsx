import { ChevronLeft } from 'lucide-react';
import UserAccountMenu from '../UserAccountMenu';
import { DATA_BASE } from '../../utils/dataBase';
import { HREF } from '../../utils/route';

// Thanh trên RÚT GỌN cho màn xem video / trang danh sách phát của trang Video shadowing: cùng khung + màu với thanh trên của
// SiteNav (cố định, cao h-16, nền #F0F6FF, viền dưới #D3E4FC) nhưng chỉ có nút "<" (về MÀN TRƯỚC, không phải trang chủ) + logo
// bên trái, TRANG CHỦ + tài khoản bên phải - KHÔNG có các tab chuyển trang ở giữa và KHÔNG có thanh tab dưới trên điện thoại
// (như KanjiNav hideTopMenu + hideMobileTabs bên web Phá Đảo). Màn xem video phủ kín nên thanh tab dưới không che trình phát.
const NAV_FONT_STYLE = { fontFamily: 'ui-sans-serif, system-ui, sans-serif' } as const;
const NO_TAP = { WebkitTapHighlightColor: 'transparent' } as const;

export default function PodcastTopBar({ onBack }: { onBack: () => void }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#F0F6FF] border-b border-[#D3E4FC]" style={NAV_FONT_STYLE}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Về trang trước"
              style={NO_TAP}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#E3EEFF] hover:bg-[#D3E4FC] text-[#2F7DF6] transition-colors outline-none"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={3} />
            </button>
            <a href={HREF.home} aria-label="DORA KAIWA" style={NO_TAP} className="flex items-center min-w-0">
              <img src={`${DATA_BASE}/logo-dora.webp`} className="relative -top-1.5 h-7 w-auto object-contain flex-shrink-0" alt="DORA" />
            </a>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={HREF.home}
              style={NO_TAP}
              className="inline-flex items-center px-4 h-10 bg-[#DCEAFE] hover:bg-[#BFDBFE] active:scale-95 transition-all rounded-full text-sm font-bold text-[#2F7DF6] shadow-sm flex-shrink-0 whitespace-nowrap"
            >
              TRANG CHỦ
            </a>
            <UserAccountMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
