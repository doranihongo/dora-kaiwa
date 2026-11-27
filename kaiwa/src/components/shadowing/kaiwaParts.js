// CÁCH CHIA "PHẦN" CỦA TỪNG CUỐN SÁCH KAIWA + TẢI DỮ LIỆU (dùng chung cho trang sách KaiwaPage.jsx và cửa sổ bài KaiwaModal.jsx).
//
// 26/11/2026 user bảo chia lại cho "khoa học": trước đây 111 phần đặt tên 6 kiểu khác nhau (Phần N, hàng kana, chữ A-Z, mã "P2 B③"...) chép nguyên mục lục sách in.
// Giờ MỌI cuốn đều theo một khung: Cuốn -> PHẦN (đặt tên theo chủ đề / việc muốn nói, ~8-28 bài/phần) -> Bài. NỘI DUNG TỪNG BÀI KHÔNG ĐỔI, chỉ gom lại.
//
// Mỗi phần: { title, lessonCount } = lấy liền kề theo THỨ TỰ trong file JSON (cuốn nào gộp nhóm cũ thì cộng số bài các nhóm cũ lại);
//           { title, ids: [số id gốc...] } = chọn từng bài theo id (chỉ cuốn 210: file gốc xếp theo hàng kana, không phải thứ tự học) -> dữ liệu được XẾP LẠI
//           theo từng phần và ĐÁNH SỐ LẠI tên bài 1..N (xem buildCourse). Bài không nằm trong phần nào rơi vào "Phần bổ sung" cuối cùng.
// Thêm cuốn mới: thêm 1 mục vào PARTS_CONFIG (không có thì tự chia 10 bài/phần).

// ---- 210 câu ngắn: gán từng bài vào 1 phần theo CHỨC NĂNG ----
// Mỗi ký tự = mã phần của bài ở vị trí gốc 0..209 (id gốc = vị trí + 1), viết từng chục cho dễ đối chiếu với file JSON. Do mình phân loại theo nghĩa - muốn đổi chỗ 1 bài thì đổi đúng ký tự đó.
//   G đồng ý/phụ họa   B hỏi han/xác nhận   A ngạc nhiên   C vui/khen   F nhận xét/đánh giá   E buồn/mệt/lo
//   D bực bội/bất mãn  P chê bai/phê phán   H từ chối/phản đối   I giải thích/xin lỗi   J nhờ vả/xã giao   K an ủi/động viên
const MA_210 = [
    'DEGFFAAKPP', //   0-  9
    'CCIHGAFFDK', //  10- 19
    'FFBHDIIFDC', //  20- 29
    'JJCEGJJGJD', //  30- 39
    'EPDIFAHCHD', //  40- 49
    'ECEHJJDECI', //  50- 59
    'FFGCDJHJKE', //  60- 69
    'BKJIIAPBBF', //  70- 79
    'FCPBJPFJHH', //  80- 89
    'CPCFHBJGJG', //  90- 99
    'HFKGGHGIGF', // 100-109
    'HAAKKFCEPG', // 110-119
    'JHEBPEGKKF', // 120-129
    'BBGFFFECEP', // 130-139
    'HBBEBDBEBF', // 140-149
    'IAIIDPEJAD', // 150-159
    'DFPEICFHCK', // 160-169
    'AJHKJKIDCP', // 170-179
    'PPCFPHKDDE', // 180-189
    'CEGFCCHKCK', // 190-199
    'PKPFFEGPJI', // 200-209
].join('');
// Thứ tự các phần của cuốn 210 (từ phản ứng đơn giản tới phức tạp) + tên hiển thị
const PHAN_210 = [
    // Tên phần để NGẮN (user 26/11: "tiêu đề danh sách các phần dài quá"): tối đa ~20 ký tự, 1-2 ý chính
    ['G', 'Đồng ý, phụ họa'],
    ['B', 'Hỏi han, xác nhận'],
    ['A', 'Ngạc nhiên'],
    ['C', 'Vui mừng, khen ngợi'],
    ['F', 'Nhận xét, đánh giá'],
    ['E', 'Buồn, mệt, lo lắng'],
    ['D', 'Bực bội, bất mãn'],
    ['P', 'Chê bai, trách móc'],
    ['H', 'Từ chối, phản đối'],
    ['I', 'Giải thích, xin lỗi'],
    ['J', 'Nhờ vả, xã giao'],
    ['K', 'An ủi, động viên'],
];
const phan210 = PHAN_210.map(([ma, title]) => ({
    title,
    ids: [...MA_210].map((c, i) => (c === ma ? i + 1 : 0)).filter(Boolean),
}));

export const PARTS_CONFIG = {
    // 42 bài: sách in chia 5 phần theo ĐỘ KHÓ tăng dần (dòng "Độ khó: n/5" ở bài đầu mỗi phần). User 26/11: ghi gọn "Phần 1 ... Phần 5" (không ghi độ khó)
    '42baisotrungcap': [
        { title: 'Phần 1', lessonCount: 10 },
        { title: 'Phần 2', lessonCount: 9 },
        { title: 'Phần 3', lessonCount: 8 },
        { title: 'Phần 4', lessonCount: 8 },
        { title: 'Phần 5', lessonCount: 7 },
    ],
    'nameraka': [
        { title: 'Biến âm trong văn nói', lessonCount: 6 },
        { title: 'Hình thái hội thoại', lessonCount: 6 },
        { title: 'Mục đích hội thoại', lessonCount: 11 },
    ],
    '22baitrungthuongcap': [
        { title: 'Gia đình, người yêu', lessonCount: 5 },
        { title: 'Bạn bè', lessonCount: 5 },
        { title: 'Người quen, hàng xóm', lessonCount: 5 },
        { title: 'Dịch vụ hằng ngày', lessonCount: 5 }, // sách: "bác sĩ, nhân viên cửa hàng..." - nội dung thật: bác sĩ, nha khoa, nhà hàng, cửa hàng, bưu điện, thư viện, ngân hàng
        { title: 'Đồng nghiệp', lessonCount: 5 },
        { title: 'Cấp trên, cấp dưới', lessonCount: 5 },
        { title: 'Đối tác, nhà tuyển dụng', lessonCount: 3 }, // sách: "người ngoài công ty và nhà tuyển dụng (người phỏng vấn)" - bài 2-3 là khách hàng/nhà cung cấp (giao hàng, giá, báo giá, điện thoại)
        { title: 'Hội thoại dài, bài phát biểu', lessonCount: 8 },
    ],
    // 200 câu ngắn dùng ngay (超ミニフレーズ200): 10 phần theo chức năng của sách in (giữ nguyên)
    '200cumsieungan': [
        { title: 'Ngạc nhiên và nghi vấn', lessonCount: 13 },
        { title: 'Hỏi và xác nhận', lessonCount: 8 },
        { title: 'Cảm tưởng và cảm xúc', lessonCount: 30 },
        { title: 'Giải thích', lessonCount: 8 },
        { title: 'Đánh giá và phán đoán', lessonCount: 24 },
        { title: 'Nhờ vả và yêu cầu', lessonCount: 9 },
        { title: 'Ý chí và thái độ', lessonCount: 26 },
        { title: 'Lời khuyên và lo lắng', lessonCount: 12 },
        { title: 'Phụ họa trong hội thoại', lessonCount: 16 },
        { title: 'Câu cố định hằng ngày', lessonCount: 54 },
    ],
    // 210 câu ngắn dùng được luôn (超ミニフレーズ210): sách in xếp theo hàng kana -> chia lại theo CHỨC NĂNG (giống cuốn 200)
    '210cumsieungan': phan210,
    '700caugiaotiepcoban': [
        { title: 'Bước đầu', lessonCount: 3 },
        { title: 'Chức năng giao tiếp', lessonCount: 15 },
        { title: 'Ngữ pháp', lessonCount: 30 },
        { title: 'Tình huống', lessonCount: 33 },
        { title: 'Chủ đề', lessonCount: 10 },
    ],
    // 125 mẫu câu mở rộng: 26 nhóm nhỏ của sách in (P1 ①-⑥, P2 A①-C③, P3 ①②) gộp còn 8 phần
    '125maucaumorong': [
        { title: 'Các dạng nối', lessonCount: 9 },           // P1 ①②③ = 4+2+3
        { title: 'Rút gọn, ko-so-a-do', lessonCount: 14 },       // P1 ④⑤⑥ = 4+2+8
        { title: 'Hùa theo, mở đầu, bổ sung', lessonCount: 19 },     // P2 A①②③ = 6+8+5
        { title: 'Tiếp lời, ngập ngừng', lessonCount: 16 }, // P2 A④⑤⑥⑦ = 4+4+5+3
        { title: 'Tình huống xấu, bỏ cuộc', lessonCount: 13 },  // P2 B①②③④ = 2+4+4+3
        { title: 'Bất mãn, ngạc nhiên', lessonCount: 14 },        // P2 B⑤⑥⑦⑧ = 3+2+6+3
        { title: 'Khen, động viên, giục', lessonCount: 14 },           // P2 C①②③ = 7+5+2
        // P3 ① (20 bài: 感じ, ちょっと, だめ, どうも, お願いします, ごめん... - từ khẩu ngữ hay gặp) + P3 ② (6 bài: 何, なんだ, なんで, なんと, なんて, 何とか). User 26/11 hỏi "từ đa năng, cụm có 何 là sao" -> tách 2 phần, đặt tên dễ hiểu
        { title: 'Từ hay gặp trong hội thoại', lessonCount: 20 },
        { title: 'Cách nói với 何', lessonCount: 6 },
    ],
    // 180 cách diễn đạt cảm xúc: 19 nhóm A-S của sách in gộp còn 8 phần
    '180bieudatcamxuc': [
        { title: 'Vui mừng, ngạc nhiên', lessonCount: 22 },   // A+B = 12+10
        { title: 'Cảm ơn, hy vọng, ước muốn', lessonCount: 24 },        // C+D+E = 10+6+8
        { title: 'Hứng thú, ý chí, yên tâm', lessonCount: 26 }, // F+G+H = 6+10+10
        { title: 'Lo lắng, khó khăn', lessonCount: 18 },        // I+J = 8+10
        { title: 'Khó chịu, tức giận', lessonCount: 24 },     // K+L = 12+12
        { title: 'Thất vọng, hối hận', lessonCount: 20 },    // M+N = 10+10
        { title: 'Bất mãn, bỏ cuộc', lessonCount: 18 },      // O+P = 10+8
        { title: 'Nhầm lẫn, nghi ngờ, coi nhẹ', lessonCount: 28 }, // Q+R+S = 10+8+10
    ],
    // 180 cách nói quen thuộc: 26 nhóm A-Z của sách in gộp còn 9 phần
    '180cachnoiquenthuoc': [
        { title: 'Thuận lợi, hiệu quả', lessonCount: 18 }, // A-D = 6+4+6+2
        { title: 'Yên tâm, chu đáo, xoay sở', lessonCount: 20 },          // E-I = 4+4+4+6+2
        { title: 'Đánh giá con người', lessonCount: 20 },                  // J
        { title: 'Bận rộn, căng thẳng, thái độ', lessonCount: 24 },     // K-O = 6+4+6+2+6
        { title: 'Bị chỉ trích, ngạo mạn', lessonCount: 20 },      // P+Q = 8+12
        { title: 'Không hợp, gặp rắc rối', lessonCount: 22 },             // R-T = 8+4+10
        { title: 'Xấu hổ, chịu đựng', lessonCount: 20 },                   // U+V = 12+8
        { title: 'Sợ hãi, tai họa', lessonCount: 18 },           // W-Y = 4+6+8
        { title: 'Các cách nói khác', lessonCount: 18 },                            // Z
    ],
    // 185 từ tượng thanh, tượng hình (オノマトペ基本表現180, sách ghi 180 nhưng có 185 mục): 4 Part / 53 nhóm của sách in gộp còn 12 phần, giữ nguyên thứ tự sách
    'tuongthanhtuonghinh': [
        { title: 'Đi cùng động từ', lessonCount: 24 },          // P1: nói, khóc, nhìn, uống, cười, xoay, ngủ, mưa
        { title: 'Cách làm, tốc độ', lessonCount: 25 },         // P2 ①-⑦
        { title: 'Âm thanh, chuyển động', lessonCount: 14 },    // P2 ⑧-⑪
        { title: 'Bề mặt, chất liệu', lessonCount: 13 },        // P3 ①-③
        { title: 'Hình dáng, kích cỡ', lessonCount: 15 },       // P3 ④-⑧
        { title: 'Số lượng, nhiệt độ', lessonCount: 13 },       // P3 ⑨-⑭
        { title: 'Món ăn, không khí', lessonCount: 13 },        // P3 ⑮-⑱
        { title: 'Tình trạng cơ thể', lessonCount: 12 },        // P3 ⑲
        { title: 'Rõ ràng, mức độ', lessonCount: 11 },          // P3 ⑳-㉒
        { title: 'Vui, hồi hộp, xúc động', lessonCount: 14 },   // P4 ①-③
        { title: 'Thất vọng, bực bội', lessonCount: 18 },       // P4 ④-⑨
        { title: 'Đổi tâm trạng, giận', lessonCount: 13 },      // P4 ⑩-⑫
    ],
};

// Đơn vị đếm hiển thị (số trong danh sách phần, popup bài, thẻ sách): cuốn 200, 210 và hai cuốn 180 ghi "13 câu", cuốn 125 ghi "6 mẫu" (user 26/11), cuốn tượng thanh ghi "từ"; các cuốn khác "bài".
const DON_VI = { '200cumsieungan': 'câu', '210cumsieungan': 'câu', '180bieudatcamxuc': 'câu', '180cachnoiquenthuoc': 'câu', '125maucaumorong': 'mẫu', 'tuongthanhtuonghinh': 'từ' };
export const donViOf = (level) => DON_VI[level] || 'bài';

// QUYỀN CỦA KHÁCH (user 26/11; khach = chưa đăng nhập / chưa có gói / hết hạn): mỗi giáo trình chỉ bấm được PHẦN ĐẦU TIÊN để xem danh sách bài; trong danh sách đó chỉ xem chi tiết + nghe 3 BÀI ĐẦU, còn lại khóa -> popup WebPlanModal.
// Chỉ khóa GIAO DIỆN (như các phần khác của web, dữ liệu JSON Kaiwa vẫn công khai). Thành viên / admin: không khóa gì.
export const KHACH_BAI_MO = 3;
// GIÁO TRÌNH MIỄN PHÍ (user 26/11: "mở free cả cuốn 700 câu N5"): khách xem TOÀN BỘ phần và bài, không khóa gì (KaiwaPage + KaiwaModal bỏ qua luật khách cho các cuốn này).
export const GIAO_TRINH_MIEN_PHI = ['700caugiaotiepcoban'];
export const KHACH_PHAN_MO = 1; // khách chỉ bấm được 1 phần đầu tiên của mỗi giáo trình
// Từ bài thứ mấy (đếm từ 0 TRONG PHẦN) bị khóa với khách: phần đầu = KHACH_BAI_MO; phần khác khóa cả phần (0); không phải khách = không khóa (Infinity).
export const khoaTuBai = (khach, partIdx) => (!khach ? Infinity : partIdx === 0 ? KHACH_BAI_MO : 0);

// TÊN BÀI Ở POPUP DANH SÁCH BÀI (user 26/11): câu / từ / mẫu ngữ pháp trong sách giữ NGUYÊN tiếng Nhật; bài mà tên chỉ là TÊN CHỦ ĐỀ hoặc TÊN MẪU NGỮ PHÁP thì hiện TIẾNG VIỆT NGẮN GỌN (-> `tenDS`), không ngoặc đơn, ngữ pháp ghi Ý NGHĨA (vd 〜たい -> "Muốn ~").
// Chỉ ảnh hưởng danh sách; trang chi tiết vẫn tiêu đề tiếng Nhật + dòng dịch như cũ. Cuốn không có trong bảng thì giữ nguyên mọi tên (200/210/180/180 toàn câu/từ; 42/22/nameraka tên đã là tiếng Việt); riêng cuốn 125 tên bài = MẪU CHÍNH tiếng Nhật rút từ title (xem buildCourse).
// 700 câu cơ bản N5: đủ 91 tên theo thứ tự bài (Phần 1 bài 1-3, Phần 2 bài 4-18, Phần 3 ngữ pháp bài 19-48, Phần 4 tình huống bài 49-81, Phần 5 chủ đề bài 82-91). Tên viết tay cho gọn, KHÔNG lấy nguyên dòng dịch của sách.
const TEN_DS = {
    '700caugiaotiepcoban': ['Chào hỏi', 'Cuộc sống hàng ngày', 'Khẩn cấp', 'Chào hỏi theo tình huống', 'Tự giới thiệu', 'Cảm ơn, xin lỗi', 'Nhờ vả', 'Mời rủ', 'Nhận lời, từ chối', 'Đặt câu hỏi', 'Đề xuất', 'Đề nghị giúp đỡ', 'Hỏi thăm, lo lắng', 'Động viên', 'Nói cảm tưởng', 'Bất mãn, phàn nàn', 'Đặt chỗ', 'Nói mong muốn', 'A là B', 'Thích, ghét, giỏi, kém', 'Tính từ', 'Diễn tả sự tồn tại', 'Muốn ~', 'Bổ nghĩa cho danh từ', 'Hãy ~ / Đừng ~', 'Mời rủ, đề nghị', 'Động từ mặc, đeo, cởi', 'Đang ~, trạng thái', 'Sau khi ~', 'Lỡ ~, xong hẳn ~', 'Cứ để nguyên ~', 'Vừa ~ vừa ~', 'Cho phép, cấm đoán', 'Đã từng ~', 'Khả năng, cảm nhận', 'Từ để hỏi', 'Làm sẵn, trạng thái kết quả', 'Định ~', 'Điều kiện', 'Nêu lý do', 'Cho và nhận', 'Dù ... nhưng', 'Suy đoán: hình như ~', 'Nghe nói ~', 'Trông có vẻ ~', 'Trở nên ~', 'Bị động, sai khiến', 'Kính ngữ', 'Đi tàu điện', 'Đi xe buýt, taxi', 'Hỏi đường', 'Ở khách sạn', 'Ở nhà hàng, quán cà phê ①', 'Ở nhà hàng, quán cà phê ②', 'Ở cửa hàng bách hóa ①', 'Ở cửa hàng bách hóa ②', 'Ở siêu thị, cửa hàng tiện lợi', 'Ở cửa hàng điện máy', 'Ở hiệu thuốc', 'Ở bệnh viện', 'Bưu điện, ngân hàng, công sở ①', 'Bưu điện, ngân hàng, công sở ②', 'Ở trường đại học ①', 'Ở trường đại học ②', 'Ở công ty ①', 'Ở công ty ②', 'Thăm nhà bạn, thầy cô', 'Với gia đình bản xứ', 'Ở công ty bất động sản', 'Nói chuyện với hàng xóm', 'Điện thoại ①: bạn bè, thầy cô', 'Điện thoại ②: nơi làm việc', 'Điện thoại ③: nơi làm việc', 'Điện thoại ④: đặt giao hàng', 'Điện thoại ⑤: đặt chỗ, hỏi thông tin', 'Đi hẹn hò', 'Ở đồn cảnh sát', 'Lập kế hoạch du lịch', 'Ở công ty du lịch', 'Ở tiệm làm tóc', 'Phỏng vấn làm thêm', 'Thể thao', 'Phim ảnh', 'Gia đình', 'Sức khỏe', 'Sở thích', 'Cuối tuần', 'Thời tiết', 'Nhật Bản', 'Sách', 'Du lịch'],
};

const BO_TIEN_TO_PHAN = ['42baisotrungcap', '22baitrungthuongcap'];

const FALLBACK_CHUNK = 10;

// Dựng danh sách phần + dữ liệu (đã xếp lại nếu cuốn dùng ids) từ mảng bài thô của file JSON.
export function buildCourse(level, raw) {
    const config = PARTS_CONFIG[level];
    if (!config) {
        const parts = [];
        for (let i = 0; i < raw.length; i += FALLBACK_CHUNK) {
            parts.push({ title: `Bài ${i + 1} - ${Math.min(i + FALLBACK_CHUNK, raw.length)}`, lessons: raw.slice(i, i + FALLBACK_CHUNK), startIndex: i });
        }
        return { data: raw, parts };
    }
    const dungIds = config.some((p) => p.ids);
    let data = raw;
    const parts = [];
    if (dungIds) {
        // chọn bài theo id gốc, xếp lại theo thứ tự các phần, đánh số lại tên bài 1..N
        const theoId = new Map(raw.map((b) => [parseInt(b.id, 10), b]));
        const dung = new Set();
        const xep = [];
        for (const p of config) {
            const start = xep.length;
            for (const id of p.ids || []) {
                const b = theoId.get(id);
                if (b && !dung.has(id)) { dung.add(id); xep.push(b); }
            }
            if (xep.length > start) parts.push({ title: p.title, startIndex: start, count: xep.length - start });
        }
        const conLai = raw.filter((b) => !dung.has(parseInt(b.id, 10)));
        if (conLai.length) {
            const start = xep.length;
            xep.push(...conLai);
            parts.push({ title: 'Phần bổ sung', startIndex: start, count: conLai.length });
        }
        // titleF (tiêu đề có furigana, thêm 26/11) cũng đánh số lại cho khớp title
        data = xep.map((b, i) => {
            const so = `${i + 1}. `;
            const moi = { ...b, title: String(b.title).replace(/^\d+\.\s*/, so) };
            if (b.titleF) moi.titleF = String(b.titleF).replace(/^\d+\.\s*/, so);
            return moi;
        });
    } else {
        let cur = 0;
        for (const p of config) {
            if (cur >= raw.length) break;
            const n = Math.min(p.lessonCount, raw.length - cur);
            parts.push({ title: p.title, startIndex: cur, count: n });
            cur += p.lessonCount;
        }
        if (cur < raw.length) parts.push({ title: 'Phần bổ sung', startIndex: cur, count: raw.length - cur });
    }
    // Cuốn 125 mẫu mở rộng (user 26/11): title gốc = "N. <câu ví dụ> <MẪU CHÍNH>" -> trang chi tiết chỉ hiện "N. <MẪU CHÍNH>" (tieuDe / tieuDeF có furigana) + dòng nghĩa `nghia`, danh sách ở popup (tenDS) viết TIẾNG NHẬT ngắn gọn = chính mẫu/từ đó, không dịch, không câu ví dụ.
    if (level === '125maucaumorong') {
        const sauDauCachCuoi = (s) => { const x = String(s || ''); const k = x.lastIndexOf(' '); return k < 0 ? x : x.slice(k + 1); };
        // Ở DANH SÁCH cho ngắn: bỏ phần ngoặc đuôi ("いや（嫌）" -> "いや"), nhiều cách nói cách nhau "／" thì lấy lần lượt tới khi đủ ~14 ký tự (luôn có ít nhất 1)
        const rutDS = (mau) => {
            const x = String(mau).replace(/(?<=\S)（[^（）]*）\s*$/, '');
            const parts = x.split('／');
            let out = parts[0];
            for (let k = 1; k < parts.length; k++) { if ([...`${out}／${parts[k]}`].length > 14) break; out += `／${parts[k]}`; }
            return out;
        };
        data = data.map((b) => {
            const so = (String(b.title).match(/^(\d+)\.\s*/) || [])[1] || '';
            const mau = sauDauCachCuoi(b.title);
            const moi = { ...b, tieuDe: `${so}. ${mau}`, tenDS: `${so}. ${rutDS(mau)}` };
            if (b.titleF) moi.tieuDeF = `${so}. ${sauDauCachCuoi(b.titleF)}`;
            return moi;
        });
    }
    const ds = TEN_DS[level];
    if (ds) data = data.map((b, i) => (ds[i] ? { ...b, tenDS: `${i + 1}. ${ds[i]}` } : b));
    // Kaiwa hàng ngày (42) + Kaiwa theo mối quan hệ (22): tên bài trong file là "PHẦN 1 - BÀI 1", "PHẦN 8 - KHIẾU NẠI"... -> ở popup danh sách BỎ tiền tố "PHẦN n - " (user 26/11), vì popup đã nằm trong phần đó rồi.
    if (BO_TIEN_TO_PHAN.includes(level)) {
        data = data.map((b) => {
            const ngan = String(b.title).replace(/^PHẦN\s*\d+\s*[-–]\s*/i, '');
            return ngan !== b.title ? { ...b, tenDS: ngan } : b;
        });
    }
    // Mọi cuốn: ở DANH SÁCH BÀI bỏ dấu chấm tiếng Nhật 。 ở CUỐI câu (user 26/11: "câu ngắn khác hay từ khác ... không cần viết dấu chấm ở cuối câu"). Chỉ bỏ 。 đứng cuối tên,
    // hoặc đứng ngay trước dấu "/" ngăn cách các cách nói ("おお。/おっ。" -> "おお/おっ") hoặc trước chú thích trong ngoặc ("悪いね。 (Cảm ơn)"); 。 nằm GIỮA câu dài giữ nguyên. Trang chi tiết vẫn tiêu đề gốc.
    data = data.map((b) => {
        const goc = b.tenDS || b.title;
        const ngan = String(goc).replace(/。(?=\s*(?:[/／(（]|$))/g, '');
        return ngan !== goc ? { ...b, tenDS: ngan } : b;
    });
    return { data, parts: parts.map((p) => ({ ...p, lessons: data.slice(p.startIndex, p.startIndex + p.count) })) };
}

// Danh sách phần hiển thị NGAY (không cần tải JSON): tên + số bài + khoảng bài. Cuốn dùng ids thì đếm số id; cuốn thường cộng lessonCount.
export function previewParts(level) {
    const config = PARTS_CONFIG[level];
    if (!config) return [];
    let start = 0;
    return config.map((p) => {
        const count = p.ids ? p.ids.length : p.lessonCount;
        const r = { title: p.title, count, from: start + 1, to: start + count };
        start += count;
        return r;
    });
}
// (Tải dữ liệu cuốn + bộ nhớ tạm: xem kaiwaLoader.js - tách riêng để file này KHÔNG có import, vì scripts/khoa-build.mjs nạp nó trực tiếp.)
