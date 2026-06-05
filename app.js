(function () {
  "use strict";

  var level = 1;          // 1=初級, 2=中級, 3=上級
  var revealAll = false;  // 「答えを表示」トグル

  var listEl = document.getElementById("list");
  var segItems = Array.prototype.slice.call(document.querySelectorAll(".segmented__item"));
  var thumb = document.querySelector(".segmented__thumb");
  var revealBtn = document.getElementById("revealToggle");

  function pageLabel(p) {
    return /^[0-9]+$/.test(p) ? "P." + p : p;
  }

  function setRevealed(btn, on) {
    if (on) {
      btn.classList.add("is-revealed");
      btn.textContent = btn.dataset.term;
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.classList.remove("is-revealed");
      btn.textContent = btn.dataset.ph;
      btn.setAttribute("aria-pressed", "false");
    }
  }

  function makeBlank(term) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "blank";
    btn.dataset.term = term;
    btn.dataset.ph = "□".repeat(Array.from(term).length);
    btn.setAttribute("aria-label", "虫食い。タップで答えを表示");
    setRevealed(btn, revealAll);
    btn.addEventListener("click", function () {
      setRevealed(btn, !btn.classList.contains("is-revealed"));
    });
    return btn;
  }

  function render() {
    var frag = document.createDocumentFragment();

    QUESTIONS.forEach(function (q) {
      var card = document.createElement("article");
      card.className = "card";

      var no = document.createElement("div");
      no.className = "card__no";
      no.textContent = q.id;

      var body = document.createElement("div");
      body.className = "card__body";

      var text = document.createElement("p");
      text.className = "card__text";

      q.seg.forEach(function (s) {
        if (typeof s === "string") {
          text.appendChild(document.createTextNode(s));
        } else if (s.lv <= level) {
          text.appendChild(makeBlank(s.t));         // この難度で隠す
        } else {
          text.appendChild(document.createTextNode(s.t)); // まだ隠さない（地の文として表示）
        }
      });

      var page = document.createElement("div");
      page.className = "card__page";
      page.textContent = "記載：" + pageLabel(q.page);

      body.appendChild(text);
      body.appendChild(page);
      card.appendChild(no);
      card.appendChild(body);
      frag.appendChild(card);
    });

    listEl.innerHTML = "";
    listEl.appendChild(frag);
  }

  function moveThumb() {
    thumb.style.transform = "translateX(" + ((level - 1) * 100) + "%)";
  }

  function setLevel(l) {
    level = l;
    segItems.forEach(function (btn) {
      var on = Number(btn.dataset.level) === l;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    moveThumb();
    render();
  }

  function setRevealAll(on) {
    revealAll = on;
    revealBtn.textContent = on ? "答えを隠す" : "答えを表示";
    revealBtn.classList.toggle("is-on", on);
    revealBtn.setAttribute("aria-pressed", on ? "true" : "false");
    Array.prototype.forEach.call(document.querySelectorAll(".blank"), function (b) {
      setRevealed(b, on);
    });
  }

  segItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLevel(Number(btn.dataset.level));
    });
  });
  revealBtn.addEventListener("click", function () {
    setRevealAll(!revealAll);
  });

  moveThumb();
  render();
})();
