// Hình vẽ bìa sách cho các thẻ giáo trình ở khu Từ vựng - cùng ngôn ngữ hình phẳng bo tròn với minh hoạ trang chủ
// (Luyện đề / DORA JLPT / Đăng ký gói). Mỗi cuốn: bìa + gáy + mép giấy + dải đánh dấu trang, bảng tên trắng ở trên,
// hình minh hoạ giữa bìa, huy hiệu cấp độ ở góc dưới.
// kind: 'trongtam' (đề thi các năm) | 'minna' | 'tango' | 'mimikara' | 'kanji' (khu Kanji ở /kanji/) | 'nguphap' (khu Ngữ pháp ở /nguphap/) | 'kaiwa' (3 cuốn Luyện Kaiwa ở /kaiwa/). Màu bìa theo màu từng cấp (khớp LEVELS).

export const LEVEL_COVER = {
    n5: ['#10B981', '#047857'],
    n4: ['#0EA5E9', '#0369A1'],
    n3: ['#6366F1', '#4338CA'],
    n2: ['#F97316', '#C2410C'],
    n1: ['#F43F5E', '#BE123C'],
    bothu: ['#65A30D', '#3F6212'], // giáo trình "Bộ thủ" ở /kanji/ (đứng trước N5): xanh chanh riêng, không trùng cấp nào (tím #A855F7, vàng đồng, nâu, hồng sen user đều không chọn)
};

const TITLE = { trongtam: 'JLPT', minna: 'みんな', tango: '単語', mimikara: '耳から', kanji: '漢字', bothu: '部首', nguphap: '文法', dokkai: '読解', choukai: '聴解', kaiwa: '会話', chinhta: '書取' };
const JP = "'Klee One','Noto Sans JP','Yu Gothic',sans-serif";

// badge (tuỳ chọn): chữ ở huy hiệu góc dưới thay cho tên cấp (VD sách Kaiwa ghi số bài "42" vì mỗi cuốn trải qua nhiều cấp).
export default function VocabBookArt({ kind, level, className = '', badge = null }) {
    const [main, dark] = LEVEL_COVER[level] || LEVEL_COVER.n3;
    const gid = `bk-${kind}-${level}`;

    let motif;
    switch (kind) {
        case 'minna':
            motif = <g transform="translate(88 98)">
                {[0, 72, 144, 216, 288].map((a) => (
                    <path key={a} d="M0 -3 C-13 -12 -11 -29 0 -31 C11 -29 13 -12 0 -3 Z" fill="white" transform={`rotate(${a})`} />
                ))}
                {[0, 72, 144, 216, 288].map((a) => (
                    <path key={a} d="M0 -8 L0 -22" stroke={main} strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${a})`} />
                ))}
                <circle r="6" fill="#FDE68A" />
            </g>;
            break;
        case 'tango':
            motif = <g>
                <g transform="rotate(-9 78 98)">
                    <rect x="58" y="76" width="40" height="46" rx="8" fill="white" fillOpacity="0.55" />
                </g>
                <g transform="rotate(7 98 98)">
                    <rect x="78" y="74" width="42" height="48" rx="8" fill="white" />
                    <rect x="86" y="84" width="26" height="6" rx="3" fill={main} fillOpacity="0.8" />
                    <rect x="86" y="96" width="18" height="5" rx="2.5" fill={main} fillOpacity="0.35" />
                    <circle cx="106" cy="112" r="5.5" fill="#16A34A" />
                    <path d="M103.2 112l2 2 3.6-4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            </g>;
            break;
        case 'kanji':
            // Ô tập viết chữ Hán (米字格): khung trắng có đường chữ thập + chéo, chữ 字 màu bìa ở giữa.
            motif = <g>
                <rect x="60" y="72" width="56" height="56" rx="9" fill="white" />
                <path d="M88 76v48M64 100h48M68 80l40 40M108 80l-40 40" stroke={main} strokeOpacity="0.28" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
                <text x="88" y="114" textAnchor="middle" fontSize="40" fontWeight="900" fill={main} fontFamily={JP}>字</text>
            </g>;
            break;
        case 'bothu':
            // Bộ thủ: cùng ô tập viết 米字格 như bìa Kanji nhưng chữ ở giữa là bộ 氵 (thủy) - chữ bộ thủ quen thuộc nhất.
            motif = <g>
                <rect x="60" y="72" width="56" height="56" rx="9" fill="white" />
                <path d="M88 76v48M64 100h48M68 80l40 40M108 80l-40 40" stroke={main} strokeOpacity="0.28" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
                <text x="88" y="115" textAnchor="middle" fontSize="42" fontWeight="900" fill={main} fontFamily={JP}>氵</text>
            </g>;
            break;
        case 'nguphap':
            // Mẫu câu: 2 mảnh ghép chữ nhật nối với nhau bằng trợ từ は trong vòng tròn, dưới là dải câu ví dụ.
            motif = <g>
                <rect x="55" y="74" width="20" height="28" rx="6" fill="white" />
                <rect x="101" y="74" width="20" height="28" rx="6" fill="white" />
                <circle cx="88" cy="88" r="15" fill="#FDE68A" />
                <text x="88" y="95" textAnchor="middle" fontSize="20" fontWeight="900" fill={dark} fontFamily={JP}>は</text>
                <rect x="55" y="110" width="66" height="7" rx="3.5" fill="white" fillOpacity="0.85" />
                <rect x="55" y="122" width="44" height="6" rx="3" fill="white" fillOpacity="0.5" />
            </g>;
            break;
        case 'choukai':
            // Nghe hiểu: tai nghe + sóng âm trên nền trắng.
            motif = <g>
                <circle cx="88" cy="100" r="29" fill="white" />
                <path d="M68 104v-6a20 20 0 0 1 40 0v6" fill="none" stroke={main} strokeWidth="5" strokeLinecap="round" />
                <rect x="63" y="102" width="9" height="16" rx="4.5" fill={main} />
                <rect x="104" y="102" width="9" height="16" rx="4.5" fill={main} />
                <path d="M80 110v4M88 106v12M96 109v6" stroke="#FBBF24" strokeWidth="3.5" strokeLinecap="round" />
            </g>;
            break;
        case 'dokkai':
            // Đoạn văn: tờ giấy có các dòng chữ, một dòng được tô vàng như đang gạch ý chính.
            motif = <g>
                <rect x="58" y="72" width="60" height="56" rx="9" fill="white" />
                <rect x="66" y="82" width="44" height="5" rx="2.5" fill={main} fillOpacity="0.35" />
                <rect x="66" y="93" width="44" height="7" rx="3.5" fill="#FDE68A" />
                <rect x="66" y="105" width="44" height="5" rx="2.5" fill={main} fillOpacity="0.35" />
                <rect x="66" y="115" width="28" height="5" rx="2.5" fill={main} fillOpacity="0.35" />
            </g>;
            break;
        case 'chinhta':
            // Nghe chính tả: tai nghe + tờ giấy chép, một dòng tô vàng, bút chì nghiêng.
            motif = <g>
                <rect x="58" y="76" width="54" height="52" rx="9" fill="white" />
                <path d="M66 86h38M66 96h38" stroke={main} strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
                <rect x="66" y="104" width="30" height="7" rx="3.5" fill="#FDE68A" />
                <path d="M66 119h22" stroke={main} strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round" />
                <path d="M60 78v-6a24 24 0 0 1 48 0v6" transform="translate(4 4)" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
                <rect x="60" y="76" width="8" height="14" rx="4" fill="#FFFFFF" />
                <rect x="108" y="76" width="8" height="14" rx="4" fill="#FFFFFF" />
                <path d="M104 124l16-22 5 4-16 22-7 3z" fill="#F59E0B" />
                <path d="M104 124l-1 7 7-3z" fill="#1A2A54" />
            </g>;
            break;
        case 'kaiwa':
            // Hội thoại: 2 bong bóng thoại so le - trắng (3 chấm) ở trên, vàng (2 dòng chữ) đè lên phía dưới.
            motif = <g>
                <rect x="56" y="72" width="48" height="30" rx="9" fill="white" />
                <path d="M64 101L61 112L75 101Z" fill="white" />
                {[68, 80, 92].map((cx) => <circle key={cx} cx={cx} cy="87" r="3.4" fill={main} />)}
                <rect x="70" y="98" width="48" height="26" rx="9" fill="#FDE68A" />
                <path d="M79 123L75 131L89 123Z" fill="#FDE68A" />
                <rect x="78" y="106" width="32" height="4.5" rx="2.25" fill={dark} fillOpacity="0.55" />
                <rect x="78" y="114" width="20" height="4.5" rx="2.25" fill={dark} fillOpacity="0.3" />
            </g>;
            break;
        case 'mimikara':
            motif = <g>
                <path d="M62 102v-8a26 26 0 0 1 52 0v8" fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" />
                <rect x="55" y="98" width="15" height="26" rx="7.5" fill="white" />
                <rect x="106" y="98" width="15" height="26" rx="7.5" fill="white" />
                <path d="M81 98q7 -6 14 0M77 90q11 -10 22 0" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="3" strokeLinecap="round" />
            </g>;
            break;
        default:
            motif = <g>
                <rect x="60" y="74" width="56" height="52" rx="9" fill="white" />
                {[88, 102, 116].map((cy, i) => (
                    <g key={cy}>
                        <circle cx="72" cy={cy} r="4.5" fill={i === 1 ? '#DC2626' : '#16A34A'} />
                        <rect x="82" y={cy - 2.8} width={i === 2 ? 22 : 28} height="5.6" rx="2.8" fill={i === 1 ? '#FEE2E2' : '#DCFCE7'} />
                    </g>
                ))}
            </g>;
    }

    return (
        <svg viewBox="0 0 170 170" className={className} aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
                    <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
            </defs>
            <ellipse cx="86" cy="161" rx="54" ry="5" fill="#1A2A54" opacity="0.12" />
            {/* mép giấy bên phải + đáy */}
            <rect x="44" y="18" width="100" height="140" rx="8" fill="white" stroke="#D3E4FC" strokeWidth="2" />
            <path d="M136 28v120M130 28v120" stroke="#E3EEFF" strokeWidth="2" strokeLinecap="round" />
            {/* dải đánh dấu trang */}
            <path d="M108 150v18l6 -5 6 5v-18z" fill="#FBBF24" />
            {/* bìa + gáy */}
            <rect x="30" y="10" width="104" height="142" rx="8" fill={main} />
            <rect x="30" y="10" width="104" height="142" rx="8" fill={`url(#${gid})`} />
            <path d="M38 10h8v142h-8a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8z" fill={dark} />
            <path d="M50 14v134" stroke="white" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            {/* bảng tên */}
            <rect x="58" y="24" width="68" height="36" rx="9" fill="white" />
            <text x="92" y="48" textAnchor="middle" fontSize={kind === 'trongtam' ? 20 : 19} fontWeight="900" letterSpacing={kind === 'trongtam' ? 1.5 : 0} fill={main} fontFamily={JP}>{TITLE[kind]}</text>
            {motif}
            {/* huy hiệu cấp độ */}
            <circle cx="114" cy="136" r="12" fill="white" />
            <text x="114" y="140" textAnchor="middle" fontSize="11" fontWeight="900" fill={dark} fontFamily="system-ui,sans-serif">{badge || (kind === 'bothu' ? '130' : level.toUpperCase())}</text>
        </svg>
    );
}

// CHỒNG 3 QUYỂN SÁCH (nhìn ngang gáy) cho thẻ chọn cấp ở khu Từ vựng: 3 quyển xếp lệch nhau, màu theo cấp (đậm -> nhạt từ dưới lên),
// quyển trên cùng có nhãn trắng ghi cấp. Rê chuột (chỉ thiết bị có chuột) thì các quyển xoè nhẹ ra như đang rút sách.
const STACK_MOVE = '[transform-box:fill-box] origin-center transition-transform duration-300 ease-out';
export function BookStackArt({ level, className = '' }) {
    const [main, dark] = LEVEL_COVER[level] || LEVEL_COVER.n3;
    const book = (x, y, w, fill, key, label, tint = 0.08) => (
        <g key={key}>
            <rect x={x} y={y} width={w} height="26" rx="6" fill={fill} />
            <rect x={x} y={y} width={w} height="26" rx="6" fill="#fff" fillOpacity={tint} />
            <path d={`M${x + 12} ${y + 3}v20M${x + 18} ${y + 3}v20`} stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
            <rect x={x + w - 15} y={y + 4} width="10" height="18" rx="3" fill="#fff" />
            <path d={`M${x + w - 13} ${y + 9}h6M${x + w - 13} ${y + 13}h6M${x + w - 13} ${y + 17}h6`} stroke="#D3E4FC" strokeWidth="1.4" strokeLinecap="round" />
            {label && <>
                <rect x={x + 26} y={y + 6} width={w - 48} height="14" rx="5" fill="#fff" />
                <text x={x + 26 + (w - 48) / 2} y={y + 17} textAnchor="middle" fontSize="11" fontWeight="900" fill={dark} fontFamily="system-ui,sans-serif">{label}</text>
            </>}
        </g>
    );
    return (
        <svg viewBox="0 0 130 112" className={className} aria-hidden="true" focusable="false">
            <ellipse cx="65" cy="104" rx="52" ry="5" fill="#1A2A54" opacity="0.12" />
            <g className={`${STACK_MOVE} group-hover:translate-x-1`}>{book(14, 74, 100, dark, 'b3')}</g>
            <g className={`${STACK_MOVE} group-hover:-translate-x-1.5 group-hover:-translate-y-0.5`}>{book(22, 46, 94, main, 'b2')}</g>
            <g className={`${STACK_MOVE} group-hover:translate-x-1 group-hover:-translate-y-1.5`}>{book(10, 18, 98, main, 'b1', level.toUpperCase(), 0.22)}</g>
        </svg>
    );
}
