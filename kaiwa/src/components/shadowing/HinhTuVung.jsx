import { useEffect, useState } from 'react';
import { fetchKaiwaImage } from '../../utils/kaiwaApi';

// Ảnh minh hoạ của bài (WebP 720x480, lấy từ VPS) ở đầu màn chi tiết, KHÔNG viền. Điện thoại / máy tính bảng: rộng tối đa 400px;
// máy tính (có chuột): 300px. Khung giữ chỗ 3:2 để màn không nhảy bố cục khi ảnh về; không lấy được ảnh thì ẩn cả khung.
// tep = trường `hinh` của bài trong file JSON.
const laMayTinh = () => { try { return window.matchMedia('(hover:hover) and (pointer:fine)').matches; } catch { return false; } };

export default function HinhTuVung({ tep }) {
    const [mayTinh] = useState(laMayTinh);
    const [src, setSrc] = useState(null);
    const [loi, setLoi] = useState(false);
    useEffect(() => {
        let off = false;
        setSrc(null); setLoi(false);
        fetchKaiwaImage(tep).then((u) => { if (off) return; if (u) setSrc(u); else setLoi(true); });
        return () => { off = true; };
    }, [tep]);
    if (loi) return null;
    return (
        <div className="flex justify-center">
            <div className={`w-full ${mayTinh ? 'max-w-[300px]' : 'max-w-[400px]'} aspect-[3/2] overflow-hidden rounded-2xl bg-[#E3EEFF]`}>
                {src && <img key={src} src={src} alt="" width={720} height={480} decoding="async" className="block w-full h-auto" />}
            </div>
        </div>
    );
}
