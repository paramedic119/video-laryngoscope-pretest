/*
 * app.js — 画面表示と操作
 * モード: 暗記（一覧を読む）／思い出す（1問ずつ想起→○△✕で自己採点）／力試し（ランダム10問テスト）
 * 依存: questions.js(QUESTIONS) / srs.js(VLRSrs) / storage.js(VLRStore)
 */
(function () {
  "use strict";

  /* ====== 状態 ====== */
  var LV_KEY = "vlr_level";
  var mode = "study";                         // study | recall | test
  var level = +(localStorage.getItem(LV_KEY) || 1); // 1初級 2中級 3上級
  var revealAll = false;                      // 暗記モードの「答えを表示」
  var filter = "review";                      // recall: review | all | weak | new | custom
  var recallIds = [], recallIdx = 0, recallRevealed = false, recallDone = 0;
  var customIds = null;                        // 「間違いだけ復習」用
  var test = null;                            // {ids, idx, revealed, results:{id:grade}}

  var QById = {};
  QUESTIONS.forEach(function (q) { QById[q.id] = q; });

  /* ====== ユーティリティ ====== */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }
  function pageLabel(p) { return /^[0-9]+$/.test(p) ? "P." + p : p; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ====== 虫食い文の組み立て（全モード共通） ====== */
  function setBlank(b, on) {
    if (on) { b.classList.add("is-revealed"); b.textContent = b.dataset.term; b.setAttribute("aria-pressed", "true"); }
    else { b.classList.remove("is-revealed"); b.textContent = b.dataset.ph; b.setAttribute("aria-pressed", "false"); }
  }
  function makeBlank(term, revealed) {
    var b = el("button", "blank");
    b.type = "button";
    b.dataset.term = term;
    b.dataset.ph = "□".repeat(Array.from(term).length);
    b.setAttribute("aria-label", "虫食い。タップで答えを表示");
    setBlank(b, !!revealed);
    b.addEventListener("click", function () { setBlank(b, !b.classList.contains("is-revealed")); });
    return b;
  }
  function buildText(q, revealed) {
    var p = el("p", "card__text");
    q.seg.forEach(function (s) {
      if (typeof s === "string") { p.appendChild(document.createTextNode(s)); }
      else if (s.lv <= level) { p.appendChild(makeBlank(s.t, revealed)); }
      else { p.appendChild(document.createTextNode(s.t)); }
    });
    return p;
  }

  /* ====== 進捗パネル ====== */
  function renderProgress() {
    var p = VLRStore.progress(QUESTIONS);
    $("barFill").style.width = p.pct + "%";
    $("progPct").textContent = p.pct + "%";
    $("statMaster").textContent = p.mastered;
    $("statLearning").textContent = p.learning;
    $("statNew").textContent = p.fresh;
    $("chipStreak").textContent = VLRStore.streak();
    $("chipToday").textContent = VLRStore.todayCount();
    $("chipDue").textContent = p.due;
  }

  /* ====== 暗記モード（一覧を読む） ====== */
  function renderStudy() {
    var list = $("studyList");
    list.innerHTML = "";
    var frag = document.createDocumentFragment();
    QUESTIONS.forEach(function (q) {
      var card = el("article", "card");
      card.appendChild(el("div", "card__no", q.id));
      var body = el("div", "card__body");
      body.appendChild(buildText(q, revealAll));
      body.appendChild(el("div", "card__page", "記載：" + pageLabel(q.page)));
      card.appendChild(body);
      frag.appendChild(card);
    });
    list.appendChild(frag);
  }
  function setRevealAll(on) {
    revealAll = on;
    var btn = $("revealToggle");
    btn.textContent = on ? "答えを隠す" : "答えを表示";
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    Array.prototype.forEach.call(document.querySelectorAll("#studyList .blank"), function (b) { setBlank(b, on); });
  }

  /* ====== 思い出すモード（想起→自己採点） ====== */
  function buildQueue() {
    var t = VLRSrs.todayStr();
    if (filter === "custom" && customIds) return customIds.slice();
    if (filter === "review") {
      return QUESTIONS.filter(function (q) { return VLRSrs.isDue(VLRStore.card(q.id), t); })
        .sort(function (a, b) {
          var ca = VLRStore.card(a.id), cb = VLRStore.card(b.id);
          return (ca.due < cb.due ? -1 : ca.due > cb.due ? 1 : ca.box - cb.box);
        }).map(function (q) { return q.id; });
    }
    if (filter === "weak") {
      return QUESTIONS.filter(function (q) { var c = VLRStore.card(q.id); return c && c.wrong > 0; })
        .sort(function (a, b) { return VLRStore.card(b.id).wrong - VLRStore.card(a.id).wrong; })
        .map(function (q) { return q.id; });
    }
    if (filter === "new") {
      return QUESTIONS.filter(function (q) { var c = VLRStore.card(q.id); return !c || c.box === 0; })
        .map(function (q) { return q.id; });
    }
    // all: 復習期限切れ・未学習を先に、残りを後に（軽くシャッフル）
    var first = [], rest = [];
    QUESTIONS.forEach(function (q) {
      var c = VLRStore.card(q.id);
      if (!c || c.box === 0 || VLRSrs.isDue(c, t)) first.push(q.id); else rest.push(q.id);
    });
    return shuffle(first).concat(shuffle(rest));
  }

  function startRecall(keepIndex) {
    recallIds = buildQueue();
    if (!keepIndex) { recallIdx = 0; recallDone = 0; }
    recallRevealed = false;
    renderRecall();
  }

  function renderRecall() {
    var wrap = $("recallStage");
    wrap.innerHTML = "";

    if (recallIds.length === 0) {
      wrap.appendChild(emptyState());
      return;
    }
    if (recallIdx >= recallIds.length) {
      wrap.appendChild(doneState());
      return;
    }

    var q = QById[recallIds[recallIdx]];

    var meta = el("div", "stage__meta");
    meta.appendChild(el("span", null, "問 " + q.id + " ・ 記載 " + pageLabel(q.page)));
    meta.appendChild(el("span", "stage__count", (recallIdx + 1) + " / " + recallIds.length));
    wrap.appendChild(meta);

    var card = el("article", "card card--solo");
    var body = el("div", "card__body");
    body.appendChild(buildText(q, recallRevealed));
    card.appendChild(body);
    wrap.appendChild(card);

    if (!recallRevealed) {
      var hint = el("p", "stage__prompt", "頭の中で答えてから…");
      wrap.appendChild(hint);
      var reveal = el("button", "btn btn--big btn--primary", "答え合わせ");
      reveal.type = "button";
      reveal.addEventListener("click", function () { recallRevealed = true; renderRecall(); });
      wrap.appendChild(reveal);
    } else {
      var prompt = el("p", "stage__prompt", "思い出せた？");
      wrap.appendChild(prompt);
      wrap.appendChild(gradeButtons(q.id, function () {
        recallIdx += 1; recallDone += 1; recallRevealed = false;
        renderProgress();
        renderRecall();
      }));
    }
  }

  function emptyState() {
    var box = el("div", "stage__empty");
    var msg = { review: "今日の復習はありません。よくできています！", weak: "苦手な問題はまだありません。", new: "未学習の問題はありません。全問に挑戦済みです！", all: "問題がありません。" }[filter] || "問題がありません。";
    box.appendChild(el("div", "stage__empty-emoji", "✓"));
    box.appendChild(el("p", "stage__empty-msg", msg));
    var row = el("div", "stage__empty-actions");
    row.appendChild(quickBtn("未学習をやる", function () { setFilter("new"); }));
    row.appendChild(quickBtn("すべて復習", function () { setFilter("all"); }));
    box.appendChild(row);
    return box;
  }

  function doneState() {
    var box = el("div", "stage__empty");
    box.appendChild(el("div", "stage__empty-emoji", "🎉"));
    box.appendChild(el("p", "stage__empty-msg", "おつかれさま！ " + recallDone + "問おえました。"));
    var row = el("div", "stage__empty-actions");
    row.appendChild(quickBtn("もう一度", function () { customIds = null; if (filter === "custom") filter = "review"; setFilter(filter); }));
    row.appendChild(quickBtn("暗記で見直す", function () { switchMode("study"); }));
    box.appendChild(row);
    return box;
  }

  function quickBtn(label, fn) {
    var b = el("button", "btn btn--ghost", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  // ○覚えてた / △あいまい / ✕忘れた の3ボタン
  function gradeButtons(id, after) {
    var row = el("div", "grades");
    [["o", "circle", "覚えてた", "is-good"], ["m", "triangle", "あいまい", "is-mid"], ["x", "cross", "忘れた", "is-bad"]]
      .forEach(function (g) {
        var b = el("button", "grade " + g[3]);
        b.type = "button";
        b.appendChild(el("span", "grade__mark grade__mark--" + g[1]));
        b.appendChild(el("span", "grade__label", g[2]));
        b.addEventListener("click", function () { VLRStore.record(id, g[0]); after(g[0]); });
        row.appendChild(b);
      });
    return row;
  }

  /* ====== 力試しモード（ランダム10問テスト） ====== */
  var TEST_N = 10;

  function renderTest() {
    var wrap = $("testStage");
    wrap.innerHTML = "";

    if (!test) { wrap.appendChild(testIntro()); return; }
    if (test.idx >= test.ids.length) { wrap.appendChild(testResult()); return; }

    var q = QById[test.ids[test.idx]];
    var meta = el("div", "stage__meta");
    meta.appendChild(el("span", null, "問 " + q.id + " ・ 記載 " + pageLabel(q.page)));
    meta.appendChild(el("span", "stage__count", (test.idx + 1) + " / " + test.ids.length));
    wrap.appendChild(meta);

    var card = el("article", "card card--solo");
    var body = el("div", "card__body");
    body.appendChild(buildText(q, test.revealed));
    card.appendChild(body);
    wrap.appendChild(card);

    if (!test.revealed) {
      wrap.appendChild(el("p", "stage__prompt", "答えを思い出して…"));
      var reveal = el("button", "btn btn--big btn--primary", "答え合わせ");
      reveal.type = "button";
      reveal.addEventListener("click", function () { test.revealed = true; renderTest(); });
      wrap.appendChild(reveal);
    } else {
      wrap.appendChild(el("p", "stage__prompt", "思い出せた？"));
      wrap.appendChild(gradeButtons(q.id, function (grade) {
        test.results[q.id] = grade;
        test.idx += 1; test.revealed = false;
        renderProgress();
        renderTest();
      }));
    }
  }

  function testIntro() {
    var box = el("div", "stage__empty");
    box.appendChild(el("div", "stage__empty-emoji", "📝"));
    box.appendChild(el("p", "stage__empty-msg", "ランダムに" + Math.min(TEST_N, QUESTIONS.length) + "問出題します。本番のつもりで力試し！"));
    var b = el("button", "btn btn--big btn--primary", "テストを始める");
    b.type = "button";
    b.addEventListener("click", startTest);
    box.appendChild(b);
    return box;
  }

  function startTest() {
    test = { ids: shuffle(QUESTIONS.map(function (q) { return q.id; })).slice(0, Math.min(TEST_N, QUESTIONS.length)), idx: 0, revealed: false, results: {} };
    renderTest();
  }

  function testResult() {
    var ids = test.ids;
    var correct = ids.filter(function (id) { return test.results[id] === "o"; });
    var wrong = ids.filter(function (id) { return test.results[id] !== "o"; });
    var score = Math.round((correct.length / ids.length) * 100);

    var box = el("div", "stage__empty");
    box.appendChild(el("div", "result__score", correct.length + " / " + ids.length + "問 正解"));
    box.appendChild(el("div", "result__points", score + "点"));

    // ○×の内訳
    var grid = el("div", "result__grid");
    ids.forEach(function (id) {
      var ok = test.results[id] === "o";
      var cell = el("span", "result__pill " + (ok ? "is-good" : "is-bad"), id);
      grid.appendChild(cell);
    });
    box.appendChild(grid);

    var row = el("div", "stage__empty-actions");
    if (wrong.length) {
      row.appendChild(quickBtn("間違えた" + wrong.length + "問だけ復習", function () {
        customIds = wrong.slice();
        test = null;
        filter = "custom";
        switchMode("recall");
      }));
    }
    row.appendChild(quickBtn("別の10問", function () { startTest(); }));
    box.appendChild(row);
    return box;
  }

  /* ====== モード/フィルタ/難易度 切替 ====== */
  function switchMode(m) {
    mode = m;
    ["study", "recall", "test"].forEach(function (k) {
      $("view-" + k).hidden = (k !== m);
      var tab = document.querySelector('.modeitem[data-mode="' + k + '"]');
      if (tab) { tab.classList.toggle("is-active", k === m); tab.setAttribute("aria-selected", k === m ? "true" : "false"); }
    });
    moveThumb($("modeThumb"), ["study", "recall", "test"].indexOf(m));
    // 難易度は 暗記・思い出す で有効（力試しでは隠す）
    $("difficulty").hidden = (m === "test");
    if (m === "study") renderStudy();
    else if (m === "recall") {
      $("filters").hidden = false;
      if (filter === "custom" && customIds) setFilter("custom");
      else { var p = VLRStore.progress(QUESTIONS); setFilter(p.due > 0 ? "review" : "all"); }
    }
    else { $("filters").hidden = true; renderTest(); }
  }

  function setFilter(f) {
    filter = f;
    if (f !== "custom") customIds = null;
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) {
      c.classList.toggle("is-active", c.dataset.filter === f);
    });
    // custom は専用チップが無いので「間違いだけ」を一時表示
    var customChip = $("chipCustom");
    if (customChip) customChip.hidden = (f !== "custom");
    startRecall(false);
  }

  function setLevel(l) {
    level = l;
    localStorage.setItem(LV_KEY, l);
    Array.prototype.forEach.call(document.querySelectorAll("#difficulty .segmented__item"), function (btn) {
      var on = +btn.dataset.level === l;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    moveThumb($("diffThumb"), l - 1);
    if (mode === "study") renderStudy();
    else if (mode === "recall") renderRecall();
    else if (mode === "test") renderTest();
  }

  function moveThumb(thumb, idx) { if (thumb) thumb.style.transform = "translateX(" + (idx * 100) + "%)"; }

  /* ====== 設定（リセット） ====== */
  function resetAll() {
    if (window.confirm("学習記録（進捗・連続日数・苦手）をすべて消して最初からにします。よろしいですか？")) {
      VLRStore.reset();
      renderProgress();
      switchMode(mode);
    }
  }

  /* ====== 初期化 ====== */
  function init() {
    // モードタブ
    Array.prototype.forEach.call(document.querySelectorAll(".modeitem"), function (btn) {
      btn.addEventListener("click", function () { switchMode(btn.dataset.mode); });
    });
    // 難易度
    Array.prototype.forEach.call(document.querySelectorAll("#difficulty .segmented__item"), function (btn) {
      btn.addEventListener("click", function () { setLevel(+btn.dataset.level); });
    });
    // フィルタチップ
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) {
      c.addEventListener("click", function () { setFilter(c.dataset.filter); });
    });
    // 暗記の「答えを表示」
    $("revealToggle").addEventListener("click", function () { setRevealAll(!revealAll); });
    // 設定
    $("settingsBtn").addEventListener("click", resetAll);

    setLevel(level);
    renderProgress();
    switchMode("study");
  }

  init();

  /* ====== PWA（オフライン・ホーム画面追加） ====== */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* 非対応環境は無視 */ });
    });
  }
})();
