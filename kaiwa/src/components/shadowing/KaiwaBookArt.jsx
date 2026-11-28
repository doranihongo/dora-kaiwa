// HÌNH MINH HOẠ CHO 11 CUỐN SÁCH KAIWA (/kaiwa/giaotrinh/) - vẽ bằng SVG, CÙNG KIỂU minh hoạ các thẻ ở TRANG CHỦ (LandingPage.jsx: NguPhapIllustration, DocHieuIllustration...):
// khung 220x170, thẻ/bong bóng trắng viền xanh nhạt #D3E4FC/#BFD7FB, nét bo tròn, chữ Nhật đậm, bóng elip mờ dưới chân.
// Thay cho bìa sách vẽ sẵn VocabBookArt (user 26/11/2026: "ảnh sách bỏ đi, vẽ hình minh hoạ kiểu như trang chủ, đẹp vào").
// User 26/11 (lần 2): KHÔNG làm hình chuyển động; mỗi hình chỉ giữ vài chi tiết chính, không dày đặc, mọi phần tử cách mép khung/viền >= ~8 đơn vị (không chạm viền).
// Mỗi cuốn một chủ đề + một màu nhấn riêng:
//   hàng ngày = buổi sáng + chào hỏi (vàng/xanh) | tự nhiên = rút gọn văn nói (xanh ngọc) | mối quan hệ = 3 người nối nhau (tím) | 200 câu = phản ứng nhanh (cam)
//   210 câu = cảm thán (hồng) | 700 câu N5 = chồng sách + mầm non (xanh lá) | 125 mẫu = ghép mẫu câu (chàm) | 180 cảm xúc = 3 gương mặt (vàng) | 180 quen thuộc = cuộn giấy + dấu ấn đỏ (đỏ).

import { memo } from 'react';

const JP = "'Klee One', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', sans-serif";

// Đường viền bong bóng thoại có ĐUÔI ở đáy: (x,y,w,h) khung, r bo góc, tx = x chân đuôi, side 'L'/'R' = đuôi chếch trái/phải.
const bubbleD = (x, y, w, h, r, tx, side = 'L', th = 11) => {
    const by = y + h;
    const ax = tx + (side === 'L' ? -9 : 9);
    return `M${x + r} ${y}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${by - r}a${r} ${r} 0 0 1 ${-r} ${r}H${tx + 7}L${ax} ${by + th}L${tx - 7} ${by}H${x + r}a${r} ${r} 0 0 1 ${-r} ${-r}V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
};
const Bub = ({ x, y, w, h, tx, side, fill = 'white', stroke = '#BFD7FB', r = 12 }) => (
    <path d={bubbleD(x, y, w, h, r, tx, side)} fill={fill} stroke={stroke} strokeWidth={stroke === 'none' ? 0 : 2} strokeLinejoin="round" />
);
const Txt = ({ x, y, size = 16, fill = '#1A2A54', children, weight = 900 }) => (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} fontFamily={JP}>{children}</text>
);
const Sparkle = ({ x, y, s = 6, fill }) => <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} fill={fill} />;

// 1. KAIWA HÀNG NGÀY: buổi sáng - mặt trời + 2 câu chào
function HangNgay() {
    const rays = [0, 45, 90, 135, 180, 225, 270, 315];
    return (<>
        <circle cx="110" cy="84" r="68" fill="#EAF2FF" />
        {rays.map((a) => <line key={a} x1="176" y1="21" x2="176" y2="16" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 176 38)`} />)}
        <circle cx="176" cy="38" r="14" fill="#FDE68A" stroke="#FACC15" strokeWidth="2" />
        <Bub x={20} y={46} w={112} h={40} r={14} tx={48} side="L" />
        <Txt x={76} y={73} size={19}>おはよう！</Txt>
        <Bub x={88} y={98} w={112} h={38} r={14} tx={168} side="R" fill="#2F7DF6" stroke="none" />
        <Txt x={144} y={123} size={17} fill="white">ありがとう</Txt>
    </>);
}

// 2. KAIWA TỰ NHIÊN: văn nói rút gọn 食べている -> 食べてる (1 khung, 2 thẻ chữ, 1 mũi tên, 1 dấu tích)
function TuNhien() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#E6FAF6" />
        <rect x="22" y="20" width="176" height="130" rx="16" fill="white" stroke="#99E6DC" strokeWidth="2" />
        <rect x="23" y="21" width="174" height="28" rx="15" fill="#CCFBF1" />
        <Txt x={110} y={41} size={12.5} fill="#0F766E">話し言葉</Txt>
        <rect x="40" y="62" width="140" height="30" rx="10" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="2" />
        <Txt x={110} y={83} size={15} fill="#94A3B8" weight={700}>食べている</Txt>
        <path d="M110 97v12M103 103l7 8 7-8" fill="none" stroke="#14B8A6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="40" y="116" width="140" height="30" rx="10" fill="#DCFCE7" stroke="#22C55E" strokeWidth="2" />
        <Txt x={104} y={137} size={15} fill="#15803D">食べてる</Txt>
        <circle cx="158" cy="131" r="9" fill="#22C55E" />
        <path d="M153.5 131.5l3 3 5.5-6.5" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>);
}

// 3. KAIWA THEO MỐI QUAN HỆ: 3 người (cấp trên / gia đình / bạn bè) nối nhau bằng nét đứt
function QuanHe() {
    const Avatar = ({ cx, cy, color, pale }) => (<>
        <circle cx={cx} cy={cy} r="24" fill={pale} stroke="white" strokeWidth="3" />
        <circle cx={cx} cy={cy - 6} r="8" fill={color} />
        <path d={`M${cx - 14} ${cy + 17}a14 14 0 0 1 28 0z`} fill={color} />
    </>);
    const pill = (x, y, label) => (<>
        <rect x={x} y={y} width="46" height="18" rx="9" fill="white" stroke="#DDD6FE" strokeWidth="1.8" />
        <Txt x={x + 23} y={y + 13} size={11} fill="#6D28D9">{label}</Txt>
    </>);
    return (<>
        <circle cx="110" cy="84" r="68" fill="#F3EEFF" />
        <path d="M110 46L58 106M110 46L162 106M58 106H162" fill="none" stroke="#C4B5FD" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
        <Avatar cx={110} cy={44} color="#8B5CF6" pale="#DDD6FE" />
        <Avatar cx={58} cy={106} color="#EC4899" pale="#FBCFE8" />
        <Avatar cx={162} cy={106} color="#14B8A6" pale="#99F6E4" />
        {pill(142, 35, '上司')}
        {pill(35, 134, '家族')}
        {pill(139, 134, '友達')}
    </>);
}

// 4. 200 CÂU NGẮN DÙNG NGAY: 3 phản ứng ngắn + tia chớp "dùng ngay"
function Cau200() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#FFF4E0" />
        <Bub x={20} y={24} w={76} h={32} r={12} tx={42} side="L" stroke="#FCD9A8" />
        <Txt x={58} y={47} size={17}>えっ？</Txt>
        <Bub x={86} y={68} w={104} h={32} r={12} tx={166} side="R" fill="#2F7DF6" stroke="none" />
        <Txt x={138} y={91} size={16} fill="white">なるほど</Txt>
        <Bub x={28} y={112} w={86} h={32} r={12} tx={52} side="L" stroke="#FCD9A8" />
        <Txt x={71} y={135} size={16}>いいね！</Txt>
        <circle cx="176" cy="34" r="17" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
        <path d="M180 21L168 36h8l-4 12 13-17h-8z" fill="#F59E0B" strokeLinejoin="round" />
    </>);
}

// 5. 210 CÂU NGẮN DÙNG NGAY: cảm thán (やった！ / それはないよ / 悪いね。)
function Cau210() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#FDEFF6" />
        <Bub x={106} y={22} w={90} h={32} r={12} tx={174} side="R" stroke="#F9C5DB" />
        <Txt x={151} y={45} size={17}>やった！</Txt>
        <Bub x={22} y={64} w={102} h={32} r={12} tx={46} side="L" fill="#EC4899" stroke="none" />
        <Txt x={73} y={86} size={14} fill="white">それはないよ</Txt>
        <Bub x={80} y={108} w={100} h={32} r={12} tx={156} side="R" stroke="#F9C5DB" />
        <Txt x={130} y={130} size={16}>悪いね。</Txt>
        <Sparkle x={40} y={34} s={8} fill="#F9A8D4" />
        <Sparkle x={198} y={86} s={6} fill="#FBCFE8" />
    </>);
}

// 6. 700 CÂU CƠ BẢN N5: chồng 3 cuốn sách + mầm non (người mới bắt đầu) + lời chào
function Cb700() {
    return (<>
        <circle cx="110" cy="88" r="68" fill="#EAFBF1" />
        <rect x="44" y="120" width="132" height="28" rx="7" fill="#2F7DF6" />
        <rect x="44" y="130" width="132" height="3" fill="white" opacity=".35" />
        <rect x="54" y="120" width="6" height="28" fill="#1E5FD9" />
        <rect x="58" y="96" width="104" height="24" rx="7" fill="#22C55E" />
        <rect x="58" y="105" width="104" height="3" fill="white" opacity=".35" />
        <rect x="68" y="96" width="6" height="24" fill="#16A34A" />
        <rect x="72" y="74" width="76" height="22" rx="7" fill="#FACC15" />
        <rect x="72" y="82" width="76" height="3" fill="white" opacity=".45" />
        <path d="M110 74V56" stroke="#16A34A" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M110 60C98 58 91 48 95 40C105 40 111 48 110 60Z" fill="#4ADE80" />
        <path d="M110 56C122 54 129 44 125 36C115 36 109 44 110 56Z" fill="#22C55E" />
        <Bub x={12} y={22} w={72} h={30} r={12} tx={42} side="L" stroke="#A7E8C0" />
        <Txt x={48} y={42} size={12}>こんにちは</Txt>
    </>);
}

// 7. 125 MẪU MỞ RỘNG: ghép các mẫu 〜って + 〜から + 〜か -> câu hoàn chỉnh có phần tô vàng
function Mau125() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#ECEFFF" />
        <rect x="20" y="24" width="180" height="124" rx="16" fill="white" stroke="#C7D2FE" strokeWidth="2" />
        <rect x="34" y="38" width="46" height="26" rx="8" fill="white" stroke="#A5B4FC" strokeWidth="2" />
        <Txt x={57} y={56} size={12.5} fill="#4F46E5">〜って</Txt>
        <Txt x={89} y={56} size={16} fill="#A5B4FC">+</Txt>
        <rect x="98" y="38" width="46" height="26" rx="8" fill="#E0E7FF" stroke="#818CF8" strokeWidth="2" />
        <Txt x={121} y={56} size={12.5} fill="#4F46E5">〜から</Txt>
        <Txt x={153} y={56} size={16} fill="#A5B4FC">+</Txt>
        <rect x="160" y="38" width="32" height="26" rx="8" fill="#4F46E5" />
        <Txt x={176} y={56} size={12.5} fill="white">〜か</Txt>
        <path d="M110 70v10M104 75l6 7 6-7" fill="none" stroke="#818CF8" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="30" y="92" width="160" height="42" rx="12" fill="#F5F7FF" stroke="#C7D2FE" strokeWidth="2" />
        <rect x="94" y="103" width="21" height="16" rx="4" fill="#FEF08A" />
        {/* 3 đoạn chữ, mỗi đoạn có điểm bắt đầu RIÊNG (9.5/chữ) để vạch tô vàng luôn trùng đúng chữ "かと" dù phông khác nhau */}
        <text x="38" y="115" fontSize="9.5" fontWeight="800" fill="#312E81" fontFamily={JP}>これ、間違い</text>
        <text x="95" y="115" fontSize="9.5" fontWeight="800" fill="#312E81" fontFamily={JP}>かと</text>
        <text x="114" y="115" fontSize="9.5" fontWeight="800" fill="#312E81" fontFamily={JP}>思うんですけど</text>
    </>);
}

// 8. 180 CÁCH DIỄN ĐẠT CẢM XÚC: 3 gương mặt vui / ngạc nhiên / giận
function CamXuc() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#FFF7DB" />
        <circle cx="74" cy="88" r="34" fill="#FDE047" stroke="#F59E0B" strokeWidth="2.5" />
        <ellipse cx="62" cy="80" rx="3.8" ry="5.2" fill="#78350F" />
        <ellipse cx="86" cy="80" rx="3.8" ry="5.2" fill="#78350F" />
        <circle cx="54" cy="96" r="5.5" fill="#FB923C" opacity=".45" />
        <circle cx="94" cy="96" r="5.5" fill="#FB923C" opacity=".45" />
        <path d="M58 98Q74 116 90 98Z" fill="#78350F" stroke="#78350F" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="158" cy="50" r="22" fill="#BAE6FD" stroke="#0EA5E9" strokeWidth="2.5" />
        <path d="M146 39q4-4 8 0M162 39q4-4 8 0" fill="none" stroke="#0C4A6E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="150" cy="49" r="2.8" fill="#0C4A6E" />
        <circle cx="166" cy="49" r="2.8" fill="#0C4A6E" />
        <ellipse cx="158" cy="62" rx="4.5" ry="6" fill="#0C4A6E" />
        <circle cx="158" cy="118" r="22" fill="#FCA5A5" stroke="#EF4444" strokeWidth="2.5" />
        <path d="M147 108l10 5M169 108l-10 5" fill="none" stroke="#7F1D1D" strokeWidth="3" strokeLinecap="round" />
        <circle cx="151" cy="118" r="2.6" fill="#7F1D1D" />
        <circle cx="165" cy="118" r="2.6" fill="#7F1D1D" />
        <path d="M148 131Q158 123 168 131" fill="none" stroke="#7F1D1D" strokeWidth="3" strokeLinecap="round" />
    </>);
}

// 9. 180 CÁCH NÓI QUEN THUỘC: cuộn giấy có thành ngữ 朝飯前 + dấu ấn đỏ
function QuenThuoc() {
    return (<>
        <circle cx="110" cy="88" r="68" fill="#FDEDEC" />
        <rect x="36" y="38" width="148" height="96" rx="4" fill="#FFFDF5" stroke="#E9D8A6" strokeWidth="2" />
        <rect x="26" y="32" width="16" height="108" rx="8" fill="#F3DFA2" stroke="#D9B954" strokeWidth="2" />
        <rect x="178" y="32" width="16" height="108" rx="8" fill="#F3DFA2" stroke="#D9B954" strokeWidth="2" />
        <Txt x={108} y={66} size={10} fill="#8B9BB8" weight={700}>あさめしまえ</Txt>
        <Txt x={108} y={102} size={34} fill="#1A2A54">朝飯前</Txt>
        <g transform="rotate(-7 158 118)">
            <rect x="145" y="105" width="26" height="26" rx="4" fill="#EF4444" />
            <Txt x={158} y={125} size={17} fill="white">慣</Txt>
        </g>
    </>);
}

// 10. TỪ TƯỢNG THANH, TƯỢNG HÌNH: tiếng mưa (ザーザー) + tim đập (ドキドキ) + lấp lánh (キラキラ)
function TuongThanh() {
    return (<>
        <circle cx="110" cy="86" r="68" fill="#E6F6FE" />
        <path d="M40 66a17 17 0 0 1-2-34 24 24 0 0 1 44-6 20 20 0 0 1 21 20 17 17 0 0 1-12 20z" fill="white" stroke="#7DD3FC" strokeWidth="2.5" strokeLinejoin="round" />
        <Txt x={64} y={53} size={14} fill="#0369A1">ザーザー</Txt>
        <path d="M47 76l-4 12M67 76l-4 12M87 76l-4 12" fill="none" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M158 112C138 98 122 84 122 66C122 53 131 45 142 45C150 45 155 49 158 55C161 49 166 45 174 45C185 45 194 53 194 66C194 84 178 98 158 112Z" fill="#FB7185" />
        <Txt x={158} y={76} size={13} fill="white">ドキドキ</Txt>
        <rect x="48" y="112" width="96" height="32" rx="16" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
        <Txt x={96} y={134} size={16} fill="#B45309">キラキラ</Txt>
        <Sparkle x={28} y={118} s={9} fill="#FBBF24" />
        <Sparkle x={164} y={134} s={7} fill="#FCD34D" />
    </>);
}

// 11. KAIWA PHỎNG VẤN: người phỏng vấn và ứng viên ngồi đối diện qua bàn, một câu hỏi - một câu đáp (xanh nước biển)
function PhongVan() {
    const Nguoi = ({ cx, color, tie }) => (<>
        <path d={`M${cx - 18} 133a18 20 0 0 1 36 0z`} fill={color} />
        {tie && <path d={`M${cx} 113l4.5 5-4.5 12-4.5-12z`} fill="#F43F5E" />}
        <circle cx={cx} cy={101} r="11.5" fill="#FED7AA" />
        <path d={`M${cx - 12} 100a12 12 0 0 1 24 0c-7 1-13-2-15-6-2 3-5 5-9 6z`} fill="#334155" />
    </>);
    return (<>
        <circle cx="110" cy="86" r="68" fill="#E0F2FE" />
        <Bub x={16} y={18} w={118} h={32} r={13} tx={50} side="L" stroke="#BAE6FD" />
        <Txt x={75} y={39.5} size={14.5}>志望動機は？</Txt>
        <Bub x={124} y={50} w={80} h={29} r={12} tx={170} side="R" fill="#0369A1" stroke="none" />
        <Txt x={164} y={70} size={14} fill="white">はい！</Txt>
        <Nguoi cx={52} color="#475569" />
        <Nguoi cx={168} color="#1E3A8A" tie />
        <rect x="26" y="131" width="168" height="9" rx="4.5" fill="#D97706" />
        <path d="M44 140v12M176 140v12" stroke="#B45309" strokeWidth="5" strokeLinecap="round" />
        <rect x="88" y="111" width="44" height="20" rx="5" fill="white" stroke="#7DD3FC" strokeWidth="2" />
        <Txt x={110} y={125.5} size={12.5} fill="#0369A1">面接</Txt>
    </>);
}

const ARTS = {
    'shadowingmensetsu': PhongVan,
    '42baisotrungcap': HangNgay,
    'nameraka': TuNhien,
    '22baitrungthuongcap': QuanHe,
    '200cumsieungan': Cau200,
    '210cumsieungan': Cau210,
    '700caugiaotiepcoban': Cb700,
    '125maucaumorong': Mau125,
    '180bieudatcamxuc': CamXuc,
    '180cachnoiquenthuoc': QuenThuoc,
    'tuongthanhtuonghinh': TuongThanh,
};

// memo: props chỉ là chuỗi -> KaiwaPage đổi state (mở/đóng popup, đang tải...) không vẽ lại cây SVG (user 26/11: điện thoại thỉnh thoảng lag/treo khi mở đóng popup nhiều).
// Không dùng CSS drop-shadow filter (nặng trên iPhone), đã có elip bóng dưới chân.
const KaiwaBookArt = memo(function KaiwaBookArt({ id, className = '' }) {
    const Art = ARTS[id] || HangNgay;
    return (
        <svg viewBox="0 0 220 170" className={className} aria-hidden="true">
            <ellipse cx="110" cy="161" rx="84" ry="5.5" fill="#DCEAFE" />
            <Art />
        </svg>
    );
});

export default KaiwaBookArt;
