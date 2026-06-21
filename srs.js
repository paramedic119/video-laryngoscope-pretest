/*
 * srs.js — 間隔反復（ライトナー5箱方式）の純粋ロジック
 * 画面にもデータ保存にも依存しない「計算だけ」のファイル。
 * box(箱) 0 = 未学習、1〜5 = 学習中〜マスター。箱が大きいほど次に出るまでの間隔が長い。
 *   覚えてた(o) … 1つ上の箱へ（最大5）。間隔をあけて再出題。
 *   あいまい(m) … 箱はそのまま。明日また出す。
 *   忘れた(x)   … 箱1に戻す。明日また出す。
 */
const VLRSrs = (function () {
  "use strict";

  // 箱ごとの「次に出すまでの日数」
  const INTERVAL = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const MASTER_BOX = 4; // box4以上を「マスター」とみなす
  const MAX_BOX = 5;

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function ymd(date) { return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()); }
  function todayStr() { return ymd(new Date()); }
  function parse(s) { const p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(dateStr, n) { const d = parse(dateStr); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

  // 自己採点を受けて、次の箱と次回出題日を返す（card は変更しない）
  // grade: "o"=覚えてた / "m"=あいまい / "x"=忘れた
  function next(card, grade, today) {
    const box = (card && card.box) || 0;
    let nb, interval;
    if (grade === "o") {
      nb = Math.min(MAX_BOX, box + 1);
      if (nb < 1) nb = 1;
      interval = INTERVAL[nb];
    } else if (grade === "m") {
      nb = Math.max(1, box); // 箱は下げない（最低1）
      interval = 1;          // 明日また
    } else { // "x"
      nb = 1;                // 箱1に戻す
      interval = 1;          // 明日また
    }
    return { box: nb, due: addDays(today, interval) };
  }

  // 復習の期限が来ているか（未学習＝まだ箱0は「復習」ではなく「未学習」として別扱い）
  function isDue(card, today) {
    if (!card || !card.box || !card.due) return false;
    return card.due <= today;
  }

  function isMastered(card) { return !!card && card.box >= MASTER_BOX; }

  return { INTERVAL, MASTER_BOX, MAX_BOX, todayStr, addDays, diffDays, next, isDue, isMastered };
})();
