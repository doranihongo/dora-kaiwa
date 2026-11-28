import { useEffect, useState } from 'react';
import { fetchKaiwaImage } from '../../utils/kaiwaApi';

// Ảnh minh hoạ của bài (WebP 720x480, lấy từ VPS) ở đầu màn chi tiết, KHÔNG viền. Điện thoại / máy tính bảng: rộng tối đa 400px;
// máy tính (có chuột): 300px. Khung giữ chỗ 3:2 để màn không nhảy bố cục khi ảnh về. tep = trường `hinh` của bài trong file JSON.
// Chép từ web Phá Đảo (components/common/HinhTuVung.jsx), gồm 2 bản sửa cho lỗi "mở TỪ ĐẦU TIÊN không thấy ảnh" trên Safari iOS:
//   - Ảnh về xong thì DỰNG LẠI khung 1 lần sau khi popup hiện hẳn.
//   - Lấy ảnh hụt (đăng nhập / mạng chưa sẵn sàng lúc vừa mở trang) thì thử lại vài lần, vẫn giữ khung; hết lượt mới ẩn.
const laMayTinh = () => { try { return window.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch { return false; } };
const HEN_THU_LAI = [600, 1500, 3000, 6000];
const SAU_KHI_POPUP_HIEN = 350; // > 250ms mờ dần của popup

export default function HinhTuVung({ tep }) {
    const [mayTinh] = useState(laMayTinh);
    const [src, setSrc] = useState(null);
    const [loi, setLoi] = useState(false);
    const [lanDung, setLanDung] = useState(0); // đổi key của khung -> trình duyệt tạo lại phần tử và vẽ lại từ đầu

    useEffect(() => {
        let off = false;
        let hen;
        setSrc(null); setLoi(false);
        const tai = (lan) => fetchKaiwaImage(tep).then(async (u) => {
            if (off) return;
            if (!u) {
                if (lan < HEN_THU_LAI.length) hen = setTimeout(() => tai(lan + 1), HEN_THU_LAI[lan]);
                else setLoi(true);
                return;
            }
            try { const anh = new Image(); anh.src = u; await anh.decode(); } catch { /* trình duyệt cũ / giải mã lỗi: vẫn để thẻ img tự hiện */ }
            if (off) return;
            setSrc(u);
            hen = setTimeout(() => { if (!off) setLanDung((v) => v + 1); }, SAU_KHI_POPUP_HIEN);
        });
        tai(0);
        return () => { off = true; clearTimeout(hen); };
    }, [tep]);

    if (loi) return null;
    return (
        <div className="flex justify-center">
            <div key={lanDung} className={`w-full ${mayTinh ? 'max-w-[300px]' : 'max-w-[400px]'} aspect-[3/2] overflow-hidden rounded-2xl bg-[#E3EEFF]`}>
                {src && <img src={src} alt="" width={720} height={480} className="block w-full h-auto" />}
            </div>
        </div>
    );
}
