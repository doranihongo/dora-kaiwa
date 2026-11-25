// Các bộ dữ liệu Nghe chính tả - id khớp tên file public/data/nghechinhta/<id>.json.
// Trang Nghe chính tả (pages/DictationPage.tsx) hiện mỗi bộ thành 1 thẻ "cuốn sách"; bấm thẻ thì DictationModal
// mở thẳng vào danh sách bài của bộ đó (prop initialCategory = id ở dưới).
// level = khóa màu bìa của VocabBookArt (n5 xanh lá, n4 xanh da trời); parts = số phần trong file JSON (dòng cuối thẻ).
export interface DictationBook {
  id: string;
  title: string;
  caption: string;
  level: 'n5' | 'n4' | 'n3' | 'n2' | 'n1';
  parts: number;
}

export const DICTATION_BOOKS: DictationBook[] = [
  { id: 'tangon5', title: 'Tango N5', caption: 'Từ đơn & ví dụ', level: 'n5', parts: 10 },
  { id: 'tangon4', title: 'Tango N4', caption: 'Từ đơn & ví dụ', level: 'n4', parts: 7 },
  { id: 'minna1', title: 'Minna N5', caption: 'Từ đơn theo bài', level: 'n5', parts: 12 },
  { id: 'minna2', title: 'Minna N4', caption: 'Từ đơn theo bài', level: 'n4', parts: 12 },
];

export const getDictationBook = (id?: string | null) => DICTATION_BOOKS.find((b) => b.id === id);
