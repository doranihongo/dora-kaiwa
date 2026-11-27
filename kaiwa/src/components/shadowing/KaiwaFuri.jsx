import React from 'react';

// FURIGANA cho trang chi tiết Kaiwa (user 26/11) - QUY TẮC: "chỉ dãn dòng với dòng CÓ furigana khi bật; dòng không có furigana giãn thường; furigana tuyệt đối không chạm dòng trên".
// - Cụm [chữ đọc / chữ Hán] là inline-block, chữ đọc là khối nằm TRONG DÒNG phía trên chữ Hán (có khe `gap`), nên dòng nào chứa cụm này tự CAO THÊM đúng bằng chiều cao chữ đọc,
//   còn dòng không có cụm nào giữ giãn dòng thường của khung gọi (KHÔNG đặt lineHeight lớn cho cả đoạn). Nhờ vậy chữ đọc luôn nằm trong chính dòng của nó, không đè sang dòng trên.
// - Chữ đọc dài hơn chữ Hán thì CO NGANG (scaleX, tối thiểu FURI_MIN_SCALE) chứ KHÔNG giảm cỡ chữ; margin ngang âm để chữ đọc tràn đều hai bên mà không nới rộng chữ Hán;
//   phần dư chỉ chừa lề khi sát 1 cụm furigana khác (để 2 chữ đọc không đè nhau). Giống FuriText của /kaiwa/video/ và DoraJpText (cùng cách đo bằng canvas).
// - Chữ đọc user-select:none. show=false thì chỉ hiện chữ (không có khối chữ đọc nên dòng không cao thêm).
export const FURI_RE = /\[([^\[\]]+)\]\(([^)]*)\)/g;
export const coFuri = (s) => /\[[^\[\]]+\]\([^)]*\)/.test(String(s || ''));

// Kiểu theo vùng: rtEm = cỡ chữ đọc theo cỡ chữ chính; gap = khe giữa chữ đọc và chữ Hán (em chữ chính); w = độ đậm chữ chính (để đo bề rộng)
export const FURI_KIEU = {
    thoai: { rtEm: 0.74, gap: 0.12, w: 700, mau: '#6b7280' }, // câu thoại (chữ chính 16px/18px đậm)
    tieude: { rtEm: 0.48, gap: 0.1, w: 700, mau: '#6b7280' }, // tiêu đề to 30px
    giaithich: { rtEm: 0.8, gap: 0.1, w: 500, mau: '#6b7280' }, // phần giải thích 14px
};
const FURI_MIN_SCALE = 0.72;

let ctx;
const cache = new Map();
const rong = (t, weight) => {
    const k = `${weight}|${t}`;
    const c = cache.get(k);
    if (c !== undefined) return c;
    if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    let w = [...t].length;
    if (ctx) {
        ctx.font = `${weight} 100px "Noto Sans JP", "Yu Gothic", "Hiragino Sans", Inter, sans-serif`;
        w = ctx.measureText(t).width / 100;
    }
    cache.set(k, w);
    return w;
};

export function Furi({ text, show, kieu = 'thoai' }) {
    if (!text) return null;
    const { rtEm, gap, w, mau } = FURI_KIEU[kieu] || FURI_KIEU.thoai;
    const out = [];
    let last = 0;
    let m;
    FURI_RE.lastIndex = 0;
    while ((m = FURI_RE.exec(text))) {
        if (m.index > last) out.push(text.slice(last, m.index));
        if (show) {
            const baseEm = rong(m[1], w);
            const readEm = rong(m[2], 400) * rtEm;
            let scale = 1;
            let du = 0;
            if (readEm > baseEm && readEm > 0) {
                scale = Math.max(FURI_MIN_SCALE, baseEm / readEm);
                du = Math.max(0, (readEm * scale - baseEm) / 2);
            }
            const tran = Math.max(0, (readEm - baseEm) / 2); // bề tràn mỗi bên khi CHƯA co (bố cục); phần co do transform lo
            const truoc = text[m.index - 1] === ')';
            const sau = text[m.index + m[0].length] === '[';
            const le = du > 0 && (truoc || sau) ? { margin: `0 ${sau ? du.toFixed(3) : 0}em 0 ${truoc ? du.toFixed(3) : 0}em` } : undefined;
            const rt = {
                display: 'block',
                textAlign: 'center',
                fontSize: `${rtEm}em`,
                fontWeight: 400,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                color: mau,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none',
                letterSpacing: 0,
                margin: `0 ${(-tran / rtEm).toFixed(3)}em ${(gap / rtEm).toFixed(3)}em`,
                ...(scale < 1 ? { transform: `scaleX(${scale.toFixed(3)})` } : {}),
            };
            out.push(
                <span key={m.index} style={{ display: 'inline-block', lineHeight: 1.15, whiteSpace: 'nowrap', verticalAlign: 'baseline', ...le }}>
                    <span data-rt="1" style={rt}>{m[2]}</span>{m[1]}
                </span>
            );
        } else out.push(m[1]);
        last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return <>{out}</>;
}
