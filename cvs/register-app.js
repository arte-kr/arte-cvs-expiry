// register.html(유통기한등록) — 상품명(자동완성) + 구역 + 유통기한(날짜·시) → cvsStore.addItem.
// 아래에는 "일자별 등록현황"(처리 전 건을 유통기한 날짜별로 묶어 보여 주고, 여기서 바로 [수정])을 둔다.
// 등록하면 화면을 다시 그린다(헤더 🔔 개수도 함께 갱신). 구역·날짜는 연속 입력을 위해 유지하고 상품명·시간만 비운다.
// 바코드 버튼 아이콘(shell.js 아이콘과 같은 선 굵기의 카메라 모양). 실제 인식은 barcode-scan.js의 openBarcodeScanner — bind()의 barcode-btn 클릭 참고.
var BARCODE_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> ';

document.addEventListener("DOMContentLoaded", function () {
  var app = document.getElementById("app");
  var ZONE_KEY = "cvs_last_zone";
  var state = { name: "", zone: loadZone(), date: todayStr(), time: "", message: null, statusDay: todayStr(), barcode: "" }; // time "" = 시간 없음(23:59). name은 중복 등록 안내 때 입력을 되살리는 용도. statusDay = 아래 등록현황에서 조회 중인 날(기본 오늘). barcode = 촬영했지만 기존 상품이 없어 신규 등록될 때 같이 붙일 번호
  var firstRender = true;

  function todayStr() {
    return cvsYmd(new Date());
  }

  function loadZone() {
    var zones = cvsStore.listZones();
    try {
      var z = localStorage.getItem(ZONE_KEY);
      if (z && zones.indexOf(z) >= 0) {
        return z;
      }
    } catch (e) {
      // 저장소를 못 쓰면 첫 구역을 쓴다
    }
    return zones[0];
  }

  function saveZone(z) {
    try {
      localStorage.setItem(ZONE_KEY, z);
    } catch (e) {
      // 기억하지 못해도 동작에는 지장 없다
    }
  }

  // 입력한 날짜·시간으로 "확인일·알림 시각"을 미리 보여 준다(규칙을 눈으로 확인하는 용도)
  function previewText(dateStr, timeStr) {
    if (!dateStr) {
      return "";
    }
    var exp = parseLocal(dateStr, timeStr);
    if (isNaN(exp.getTime())) {
      return "";
    }
    var alertAt = alertAtOf(exp);
    var cp = checkDateOf(exp).split("-");
    return "확인일 " + parseInt(cp[1], 10) + "/" + parseInt(cp[2], 10) + " · 알림 " + fmtDateTime(alertAt);
  }

  // 등록현황 날짜 조회 줄(오늘 기본, ‹ › 또는 달력으로 다른 날 선택). "전체"는 건수가 늘어나면 의미가 없어 두지 않는다
  function statusDayFilterHtml() {
    var today = todayStr();
    return (
      '<div class="day-filter">' +
      '<button type="button" class="chip' + (state.statusDay === today ? " chip-active" : "") + '" data-day="today">오늘</button>' +
      '<div class="day-nav"><button type="button" class="btn-small btn-ghost" data-step="-1" aria-label="이전 날">‹</button>' +
      '<input type="text" id="status-day-input" class="date-field" readonly value="' + state.statusDay + '" aria-label="등록현황 조회 일자" />' +
      '<button type="button" class="btn-small btn-ghost" data-step="1" aria-label="다음 날">›</button></div></div>'
    );
  }

  // 일자별 등록현황: 선택한 날(기본 오늘)에 유통기한이 걸린 처리 전(active) 건만 보여준다. 처리완료·삭제된 건은 보이지 않는다.
  function statusHtml() {
    var today = todayStr();
    var day = state.statusDay;
    var rows = cvsStore
      .listItems()
      .filter(function (it) {
        return it.status === "active" && cvsYmd(new Date(it.expiresAt)) === day;
      })
      .map(function (it) {
        return { item: it, exp: new Date(it.expiresAt) };
      })
      .sort(function (a, b) {
        return a.exp - b.exp || a.item.name.localeCompare(b.item.name, "ko");
      });
    var tag = day < today ? '<span class="status-badge status-overdue">지남</span>' : day === today ? '<span class="status-badge status-today">오늘</span>' : "";
    var head = '<div class="day-head"><strong>' + fmtDate(parseLocal(day, "00:00")) + "</strong>" + tag + '<span class="day-count">' + rows.length + "건</span></div>";
    if (rows.length === 0) {
      return statusDayFilterHtml() + head + '<div class="settings-empty">등록된 건이 없습니다.</div>';
    }
    return (
      statusDayFilterHtml() +
      head +
      '<ul class="day-list">' +
      rows
        .map(function (r) {
          return (
            '<li class="day-row" data-id="' + shellEsc(r.item.id) + '"><div class="day-row-main"><strong>' + shellEsc(r.item.name) + "</strong><span>" +
            shellEsc(r.item.zone) + " · " + cvsPad2(r.exp.getHours()) + ":" + cvsPad2(r.exp.getMinutes()) +
            '</span></div><button type="button" class="btn-small btn-ghost" data-edit="1">수정</button></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // 등록현황 날짜 입력칸에 달력을 연결한다(현황만 다시 그릴 때마다 입력칸이 새로 생기므로 매번 다시 연결)
  function bindStatusDayInput() {
    var dayInput = document.getElementById("status-day-input");
    attachDatePicker(dayInput, {});
    dayInput.addEventListener("change", function () {
      state.statusDay = dayInput.value;
      refreshStatus();
    });
  }

  // 현황만 다시 그린다(입력 중인 상품명이 지워지지 않도록 폼은 건드리지 않는다). 🔔 개수도 갱신.
  function refreshStatus() {
    document.getElementById("status-area").innerHTML = statusHtml();
    bindStatusDayInput();
    var n = getShellAlerts().length;
    var bell = document.getElementById("shell-bell");
    var badge = bell.querySelector(".shell-badge");
    if (n > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "shell-badge";
        bell.appendChild(badge);
      }
      badge.textContent = n;
    } else if (badge) {
      badge.remove();
    }
  }

  function render() {
    var html = renderShell("편의점", "register", "유통기한 등록");
    html += '<main class="cafe-main"><form class="form-card form-card-wide" id="reg-form" autocomplete="off"><div class="reg-grid">';
    html += '<div class="form-field reg-name"><label for="name-input">상품명</label><div class="expiry-row">' +
      '<button type="button" class="btn-small btn-ghost" id="barcode-btn" aria-label="바코드로 상품 찾기">' + BARCODE_ICON + "</button>" +
      '<input type="text" id="name-input" maxlength="60" placeholder="상품명을 입력하세요" value="' + shellEsc(state.name) + '" /></div></div>';
    html += '<div class="form-field reg-zone"><label>구역</label><div class="form-radio-group" id="zone-group">';
    cvsStore.listZones().forEach(function (z) {
      html +=
        '<label class="' + (z === state.zone ? "form-radio-active" : "") + '"><input type="radio" name="zone" value="' + shellEsc(z) + '"' +
        (z === state.zone ? " checked" : "") + " />" + shellEsc(z) + "</label>";
    });
    html += "</div></div>";
    html += '<div class="form-field reg-date"><label for="date-input">유통기한</label><div class="expiry-row">';
    html += '<input type="text" id="date-input" class="date-field" readonly value="' + state.date + '" />';
    html += timeSelectHtml("time-input", state.time) + "</div>";
    html += '<div class="field-hint" id="rule-preview">' + shellEsc(previewText(state.date, state.time)) + "</div></div>";
    html += '</div><button type="submit" class="btn-primary">등록</button>';
    html += '<div class="form-message show ' + (state.message ? state.message.kind : "") + '" id="form-message"' + (state.message ? "" : ' style="display:none"') + ">" +
      (state.message ? shellEsc(state.message.text) : "") + "</div>";
    html += "</form>";
    html += '<h2>일자별 등록현황</h2><div id="status-area" class="form-card form-card-wide">' + statusHtml() + "</div></main>";
    app.innerHTML = html;
    bind();
    bindStatusDayInput();
    if (firstRender) {
      firstRender = false;
      autoOpenShellAlerts();
    }
  }

  function bind() {
    var form = document.getElementById("reg-form");
    var nameInput = document.getElementById("name-input");
    var dateInput = document.getElementById("date-input");
    var timeInput = document.getElementById("time-input");
    var preview = document.getElementById("rule-preview");

    // 상품이 마지막으로 등록됐던 구역을 기본값으로 선택해 준다(구역이 설정에서 삭제됐으면 조용히 무시하고 그대로 둔다)
    function applyZoneDefault(zone) {
      if (!zone) {
        return;
      }
      var matched = false;
      Array.prototype.forEach.call(document.getElementById("zone-group").querySelectorAll("label"), function (l) {
        var input = l.querySelector("input");
        if (input.value === zone) {
          input.checked = true;
          matched = true;
        }
        l.classList.toggle("form-radio-active", input.checked);
      });
      if (matched) {
        state.zone = zone;
        saveZone(zone);
      }
    }

    attachProductSuggest(nameInput, function () {
      return cvsStore.listProducts();
    });
    // 자동완성으로 고르거나(값 변경 시 change 이벤트 발생) 기존 상품명을 그대로 입력해 확정했을 때, 그 상품의 마지막 구역을 기본값으로 적용
    nameInput.addEventListener("change", function () {
      var rec = cvsStore.findProductRecordByName(nameInput.value);
      if (rec) {
        applyZoneDefault(rec.lastZone);
      }
    });
    attachDatePicker(dateInput, {});
    document.getElementById("barcode-btn").addEventListener("click", function () {
      openBarcodeScanner().then(function (code) {
        if (!code) {
          return;
        }
        var rec = cvsStore.findProductByBarcode(code);
        if (rec) {
          state.barcode = "";
          nameInput.value = rec.name;
          applyZoneDefault(rec.lastZone);
          nameInput.focus();
        } else {
          state.barcode = code;
          confirmDialog({
            title: "등록된 상품이 없습니다",
            message: "바코드 " + code + " 로 등록된 상품이 없습니다. 상품명을 입력해 신규 등록해 주세요(이 번호가 같이 저장됩니다).",
            infoOnly: true,
          }).then(function () {
            nameInput.focus();
          });
        }
      });
    });

    function updatePreview() {
      preview.textContent = previewText(dateInput.value, timeInput.value);
    }
    dateInput.addEventListener("change", updatePreview);
    timeInput.addEventListener("change", updatePreview);

    document.getElementById("zone-group").addEventListener("change", function (e) {
      state.zone = e.target.value;
      saveZone(state.zone);
      Array.prototype.forEach.call(this.querySelectorAll("label"), function (l) {
        l.classList.toggle("form-radio-active", l.querySelector("input").checked);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = normalizeName(nameInput.value);
      state.date = dateInput.value;
      if (!name) {
        state.time = timeInput.value;
        state.message = { kind: "error", text: "상품명을 입력하세요." };
        render();
        return;
      }
      var exp = parseLocal(state.date, timeInput.value);
      if (isNaN(exp.getTime())) {
        state.message = { kind: "error", text: "유통기한 날짜·시간을 확인하세요." };
        render();
        return;
      }
      var dup = cvsStore.findDuplicate(name, exp, null);
      if (dup) {
        // 이미 처리 전 상태로 같은 상품·일자·시간이 등록되어 있으면 추가하지 않는다(입력값은 그대로 두어 시간 등을 고칠 수 있게)
        state.name = name;
        state.time = timeInput.value;
        state.message = { kind: "error", text: "이미 등록되었습니다 · " + dup.name + " · " + fmtDateTime(exp) + " (" + dup.zone + "). 추가로 등록하지 않았습니다." };
        render();
        return;
      }
      var submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      var timeVal = timeInput.value;
      cvsStore.addItem({ name: name, zone: state.zone, expiresAt: exp, barcode: state.barcode }).then(
        function (item) {
          cvsStore.rememberProductZone(item.name, item.zone);
          state.name = "";
          state.time = "";
          state.barcode = "";
          state.message = { kind: "success", text: "등록했습니다 · " + item.name + " · " + previewText(state.date, timeVal) };
          render();
        },
        function (err) {
          submitBtn.disabled = false;
          state.message = { kind: "error", text: "저장하지 못했습니다. " + err.message };
          render();
        }
      );
    });
  }

  // 현황 날짜 조회(오늘 / ‹ ›)와 [수정] 버튼(한 번만 연결)
  app.addEventListener("click", function (e) {
    var dayBtn = e.target.closest("[data-day]");
    if (dayBtn) {
      state.statusDay = todayStr();
      refreshStatus();
      return;
    }
    var step = e.target.closest("[data-step]");
    if (step) {
      var base = parseLocal(state.statusDay, "00:00");
      base.setDate(base.getDate() + parseInt(step.getAttribute("data-step"), 10));
      state.statusDay = cvsYmd(base);
      refreshStatus();
      return;
    }
    var btn = e.target.closest("[data-edit]");
    if (!btn) {
      return;
    }
    var id = btn.closest("[data-id]").getAttribute("data-id");
    var it = cvsStore.listItems().filter(function (x) {
      return x.id === id;
    })[0];
    if (it) {
      openItemEditor(it, refreshStatus);
    }
  });

  render();
});
