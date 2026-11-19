import { useEffect } from 'react';

// Khóa cuộn nền dùng chung cho MỌI overlay/popup toàn màn hình của kaiwa
// (khóa học, buổi học, các công cụ học, bảng tài khoản, popup xác nhận...).
// Port từ hooks/useBodyScrollLock.js của web Phá Đảo Tiếng Nhật.
//
// Vì sao phải ĐẾM số lượt khóa (lockCount) thay vì mỗi nơi tự set/unset style
// của <body> theo trạng thái riêng của nó (cách cũ: App.tsx, Home.tsx,
// KaiwaModal, DictationModal, YoutubeShadowingModal, FlashcardModal,
// Blackboard, NotePad, accountPanel.js đều tự ghi/xóa style body): nhiều
// nơi cùng ghi đè 1 thuộc tính thì cái chạy sau cùng "thắng" - 1 popup đóng
// lại có thể vô tình gỡ mất khóa mà overlay khác (vẫn đang mở) vừa đặt, hoặc
// ngược lại để sót khóa khiến trang không cuộn được nữa. Đếm lockCount thì:
// chỉ lượt khóa ĐẦU TIÊN đặt style, chỉ lượt gỡ CUỐI CÙNG mới xóa style - kể
// cả khi nhiều popup mở chồng lên nhau hay đổi trạng thái cùng 1 lượt render
// (React luôn chạy hết mọi cleanup rồi mới chạy effect mới trong 1 lần commit).
//
// Dùng position:fixed (không chỉ overflow:hidden) vì overflow:hidden suông
// không chặn được cuộn nền trên Safari iOS.
//
// KHÔNG chặn touchmove bằng JS (preventDefault) ở bất cứ đâu: việc đó từng
// làm trang chủ không vuốt được trên iPhone khi mở từ icon màn hình chính
// (xem ghi chú ở public/js/common.js). Chống "kéo dội" (rubber-band) đã có
// overscroll-behavior ở CSS (index.css) - đủ dùng, không cần JS.
let lockCount = 0;
let savedScrollY = 0;

export default function useBodyScrollLock(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      const { body, documentElement } = document;
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      // Chặn cuộn "trôi" theo quán tính lọt xuống nền phía sau.
      documentElement.style.overscrollBehavior = 'none';
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        const { body, documentElement } = document;
        body.style.position = '';
        body.style.top = '';
        body.style.width = '';
        body.style.overflow = '';
        documentElement.style.overscrollBehavior = '';
        window.scrollTo(0, savedScrollY);
      }
    };
  }, [isOpen]);
}
