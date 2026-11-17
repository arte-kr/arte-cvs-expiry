// 상품명 자동완성. 사용: attachProductSuggest(input, function () { return 상품명 배열; })
// 입력한 글자가 포함된 상품만 드롭다운으로 보여 주고, 하나도 없으면 "새 상품으로 등록됩니다"를 안내한다(그대로 직접 입력하면 신규 등록).
// 입력칸 값은 목록을 고를 때만 바꾼다(타이핑·한글 조합 중에는 건드리지 않아 마지막 글자가 사라지지 않는다). 필요: expiry-rules.js(normalizeName), shell.js(shellEsc)
function attachProductSuggest(input, getNames) {
  var MAX_ROWS = 8;
  var wrap = input.parentNode;
  wrap.classList.add("suggest-wrap");
  var list = document.createElement("ul");
  list.className = "suggest-list";
  list.hidden = true;
  var hint = document.createElement("div");
  hint.className = "field-hint";
  wrap.appendChild(list);
  wrap.appendChild(hint);
  var composing = false;

  function hideList() {
    list.hidden = true;
    list.innerHTML = "";
  }

  function refresh() {
    var q = normalizeName(input.value).toLowerCase();
    hint.textContent = "";
    if (!q) {
      hideList();
      return;
    }
    var names = getNames();
    var exact = names.some(function (n) {
      return n.toLowerCase() === q;
    });
    var matches = names.filter(function (n) {
      return n.toLowerCase().indexOf(q) >= 0 && n.toLowerCase() !== q;
    });
    if (matches.length > 0) {
      list.innerHTML = matches
        .slice(0, MAX_ROWS)
        .map(function (n) {
          return '<li><button type="button" class="suggest-item" data-name="' + shellEsc(n) + '">' + shellEsc(n) + "</button></li>";
        })
        .join("");
      list.hidden = false;
    } else {
      hideList();
    }
    if (exact) {
      hint.textContent = "이미 등록된 상품입니다.";
    } else if (matches.length === 0 && !composing) {
      hint.textContent = "새 상품으로 등록됩니다.";
    }
  }

  input.addEventListener("compositionstart", function () {
    composing = true;
  });
  input.addEventListener("compositionend", function () {
    composing = false;
    refresh();
  });
  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      hideList();
    }
  });
  // 목록을 누르면 입력칸이 포커스를 잃기 전에 값을 채운다(mousedown에서 처리)
  list.addEventListener("mousedown", function (e) {
    var btn = e.target.closest(".suggest-item");
    if (!btn) {
      return;
    }
    e.preventDefault();
    input.value = btn.getAttribute("data-name");
    hideList();
    hint.textContent = "이미 등록된 상품입니다.";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  input.addEventListener("blur", function () {
    setTimeout(hideList, 120);
  });
}
