import { useState } from 'react';
import SiteNav from '../components/SiteNav';
import DictationModal from '../components/DictationModal';
import VocabBookArt from '../components/art/VocabBookArt.jsx';
import { DICTATION_BOOKS } from '../components/dictation/books';

// Trang "Nghe chính tả" (#/nghechinhta) - TRANG THẬT có thanh công cụ SiteNav, dựng theo đúng mẫu trang
// "Sách Kaiwa" (/kaiwa/sach/) của web Phá Đảo Tiếng Nhật: tiêu đề lớn + các thẻ "cuốn sách" (bìa vẽ sẵn VocabBookArt
// bên trái, chữ bên phải). Bấm 1 thẻ mở DictationModal (popup luyện tập tông sáng, phủ kín màn hình) với prop
// initialCategory để popup nhảy THẲNG vào danh sách bài của bộ đó - không bắt chọn bộ lần 2 trong popup.
// Nút đóng popup chỉ đặt lại state của trang (openBookId = null), không đổi route.
export default function DictationPage() {
  const [openBookId, setOpenBookId] = useState<string | null>(null);

  return (
    <div className="min-h-dvh bg-[#F0F6FF] relative overflow-x-hidden">
      <SiteNav active="nghechinhta" />

      {/* pt-16: chừa chỗ thanh trên cố định. pb-20 lg:pb-0: chừa chỗ thanh tab dưới (chỉ điện thoại). */}
      <main className="pt-16 pb-20 lg:pb-0">
        <section className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-10 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pt-14 sm:pb-24">
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] uppercase text-[#1A2A54]">Nghe chính tả</h1>
            <p className="mt-2 sm:mt-4 text-[#5B6B85] text-sm sm:text-lg max-w-2xl mx-auto">Nghe và chép lại, đục lỗ.</p>
          </div>

          {/* Thẻ y hệt thẻ sách của trang Sách Kaiwa: 2 cột từ sm, điện thoại 1 cột. */}
          <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5" aria-label="Chọn bộ Nghe chính tả">
            {DICTATION_BOOKS.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => setOpenBookId(book.id)}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className="group bg-white p-4 sm:p-6 rounded-2xl border border-[#D3E4FC] shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex items-center gap-3 sm:gap-6 w-full text-left"
              >
                <span className="w-20 h-20 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:-rotate-3">
                  <VocabBookArt kind="chinhta" level={book.level} className="w-full h-full overflow-visible drop-shadow-lg" />
                </span>
                <span className="min-w-0 flex flex-col text-left">
                  <h3 className="text-lg sm:text-2xl font-black text-[#1A2A54] uppercase leading-tight whitespace-nowrap">{book.title}</h3>
                  <span className="mt-1 text-sm sm:text-base font-semibold text-[#5B6B85]">{book.caption}</span>
                  <span className="mt-1.5 text-[13px] sm:text-sm font-bold text-[#6B7A96] whitespace-nowrap">{book.parts} phần</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Luôn gắn sẵn (isOpen=false thì không vẽ gì) để popup giữ lại dữ liệu đã tải giữa các lần mở. */}
      <DictationModal
        isOpen={!!openBookId}
        initialCategory={openBookId}
        onClose={() => setOpenBookId(null)}
      />
    </div>
  );
}
