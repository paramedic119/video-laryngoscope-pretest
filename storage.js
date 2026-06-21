/*
 * storage.js — 学習記録の保存（ブラウザ内 localStorage）
 * 問題本体（questions.js）は一切いじらず、問題ID をキーに別管理する。
 * 保存内容: 問題ごとの { box, due, right, wrong, seen, last } と、連続日数・今日の学習。
 * 公開関数: card / record / todayCount / streak / progress / dueIds / reset
 */
const VLRStore = (function () {
  "use strict";

  const KEY = "vlr_pretest_v1";
  let state = null;

  function fresh() {
    return {
      version: 1,
      cards: {},                                 // { "7": {box,due,right,wrong,seen,last}, ... }
      streak: { count: 0, last: null, best: 0 }, // 連続学習日数
      day: { date: null, ids: {} },              // 今日学習した問題ID（重複なし）
    };
  }

  function load() {
    if (state) return state;
    try {
      const raw = localStorage.getItem(KEY);
      state = raw ? JSON.parse(raw) : fresh();
    } catch (e) { state = fresh(); }
    if (!state || typeof state !== "object" || !state.cards) state = fresh();
    if (!state.streak) state.streak = { count: 0, last: null, best: 0 };
    if (!state.day) state.day = { date: null, ids: {} };
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { /* 容量超過などは無視 */ }
  }

  function card(id) { return load().cards[String(id)] || null; }

  function ensure(id) {
    const s = load();
    const k = String(id);
    if (!s.cards[k]) s.cards[k] = { box: 0, due: null, right: 0, wrong: 0, seen: 0, last: null };
    return s.cards[k];
  }

  // 自己採点を記録（grade: "o" 覚えてた / "m" あいまい / "x" 忘れた）
  function record(id, grade) {
    const s = load();
    const c = ensure(id);
    const t = VLRSrs.todayStr();
    const nx = VLRSrs.next(c, grade, t);
    c.box = nx.box;
    c.due = nx.due;
    c.seen += 1;
    c.last = t;
    if (grade === "o") c.right += 1;
    else if (grade === "x") c.wrong += 1;

    // 今日の学習（重複なしの問題数）
    if (s.day.date !== t) s.day = { date: t, ids: {} };
    s.day.ids[String(id)] = true;

    // 連続学習日数
    const st = s.streak;
    if (st.last !== t) {
      st.count = (st.last && VLRSrs.diffDays(st.last, t) === 1) ? st.count + 1 : 1;
      st.last = t;
      if (st.count > st.best) st.best = st.count;
    }

    save();
    return c;
  }

  function todayCount() {
    const s = load();
    if (s.day.date !== VLRSrs.todayStr()) return 0;
    return Object.keys(s.day.ids).length;
  }

  function streak() {
    const s = load();
    if (!s.streak.last) return 0;
    const d = VLRSrs.diffDays(s.streak.last, VLRSrs.todayStr());
    return d > 1 ? 0 : s.streak.count; // 1日でも空けば連続は途切れ
  }

  // 全問に対する集計（progress バー・カウント表示用）
  // questions: QUESTIONS 配列
  function progress(questions) {
    const t = VLRSrs.todayStr();
    let sumBox = 0, mastered = 0, learning = 0, fresh = 0, due = 0;
    questions.forEach(function (q) {
      const c = card(q.id);
      const box = c ? c.box : 0;
      sumBox += Math.min(box, VLRSrs.MAX_BOX);
      if (box >= VLRSrs.MASTER_BOX) mastered++;
      else if (box >= 1) learning++;
      else fresh++;
      if (VLRSrs.isDue(c, t)) due++;
    });
    const total = questions.length;
    let pct = total ? Math.round((sumBox / (total * VLRSrs.MAX_BOX)) * 100) : 0;
    if (pct === 0 && sumBox > 0) pct = 1; // 学習を始めたらバーを少しでも進める

    return { total: total, pct: pct, mastered: mastered, learning: learning, fresh: fresh, due: due };
  }

  function reset() { state = fresh(); save(); }

  return { load, save, card, record, todayCount, streak, progress, reset, KEY };
})();
