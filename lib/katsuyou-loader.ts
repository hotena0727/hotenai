import type { KatsuyouRow } from "@/app/types/katsuyou";

const KATSUYOU_ROWS: KatsuyouRow[] = [
  { pos: "i_adj", jp: "高い", kr: "비싸다", reading: "たかい" },
  { pos: "i_adj", jp: "安い", kr: "싸다", reading: "やすい" },
  { pos: "i_adj", jp: "暑い", kr: "덥다", reading: "あつい" },
  { pos: "i_adj", jp: "寒い", kr: "춥다", reading: "さむい" },
  { pos: "i_adj", jp: "忙しい", kr: "바쁘다", reading: "いそがしい" },
  { pos: "i_adj", jp: "楽しい", kr: "즐겁다", reading: "たのしい" },

  { pos: "na_adj", jp: "静か", kr: "조용하다", reading: "しずか" },
  { pos: "na_adj", jp: "便利", kr: "편리하다", reading: "べんり" },
  { pos: "na_adj", jp: "元気", kr: "건강하다, 활기차다", reading: "げんき" },
  { pos: "na_adj", jp: "有名", kr: "유명하다", reading: "ゆうめい" },
  { pos: "na_adj", jp: "大丈夫", kr: "괜찮다", reading: "だいじょうぶ" },
  { pos: "na_adj", jp: "簡単", kr: "간단하다", reading: "かんたん" },

  { pos: "verb", jp: "食べる", kr: "먹다", reading: "たべる" },
  { pos: "verb", jp: "飲む", kr: "마시다", reading: "のむ" },
  { pos: "verb", jp: "行く", kr: "가다", reading: "いく" },
  { pos: "verb", jp: "来る", kr: "오다", reading: "くる" },
  { pos: "verb", jp: "見る", kr: "보다", reading: "みる" },
  { pos: "verb", jp: "聞く", kr: "듣다, 묻다", reading: "きく" },
  { pos: "verb", jp: "話す", kr: "말하다", reading: "はなす" },
  { pos: "verb", jp: "読む", kr: "읽다", reading: "よむ" },
  { pos: "verb", jp: "書く", kr: "쓰다", reading: "かく" },
  { pos: "verb", jp: "買う", kr: "사다", reading: "かう" },
];

export async function loadKatsuyouRows(): Promise<KatsuyouRow[]> {
  return KATSUYOU_ROWS;
}