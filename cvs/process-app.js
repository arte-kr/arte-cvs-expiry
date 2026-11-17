// process.html(유통기한처리) — 처리할 건 목록(지남 → 임박 → 대기, 기한 빠른 순) + 구역 필터.
// [처리완료]=폐기·판매로 없어짐(목록에서 숨기고 알림 중단), [수정]=이름·구역·기한 변경, [삭제]=삭제 보관함(복원 가능).
// 삭제 규칙: 아직 기한 전이면 "삭제된 건"(보관함)에 두고 [복원]/[완전 삭제]를 준다. 이미 기한이 지난 건은 복원해도 의미가 없어 바로 완전 삭제한다.
// 보관함에 있는 동안 기한이 지나면 자동으로 완전 삭제로 넘어간다(cvsStore.purgeExpiredTrash).
// 처리완료·삭제는 행을 지우지 않고 상태만 바꾼다. "처리됨" 보기에서 처리완료 건을 되돌릴 수 있다.
document.addEventListener("DOMContentLoaded", function () {
  var app = document.getElementById("app");
  var STATUS_LABEL = { overdue: "지남", soon: "임박", waiting: "대기" };
  var STATUS_ORDER = { overdue: 0, soon: 1, waiting: 2 };
  // day: null(전체 일자) 또는 "YYYY-MM-DD"(그 날 확인할 건). 일자 조회는 유통기한 날짜가 아니라 "확인일"(checkDateOf) 기준이다:
  // 새벽·밤 기한은 전날/당일 영업 중에 처리해야 하므로, "오늘 처리할 것"이 한눈에 보이게 하려는 것(카드에는 실제 기한도 함께 표시).
  var state = { zone: "all", day: null, showDone: false };
  var firstRender = true;

  function rowsFor(status) {
    var now = new Date();
    return cvsStore
      .listItems()
      .filter(function (it) {
        if (it.status !== status || (state.zone !== "all" && it.zone !== state.zone)) {
          return false;
        }
        if (state.day === null) {
          return true;
        }
        var exp = new Date(it.expiresAt);
        // 지남(기한이 지난) 미처리 건은 쌓여서 처리할 때까지 남으므로, 선택한 날짜와 상관없이 계속 보여준다
        if (status === "active" && exp.getTime() <= now.getTime()) {
          return true;
        }
        return checkDateOf(exp) === state.day;
      })
      .map(function (it) {
        var exp = new Date(it.expiresAt);
        return { item: it, exp: exp, st: statusOf(exp, now) };
      });
  }

  function cardHtml(r) {
    var it = r.item;
    var alertAt = alertAtOf(r.exp);
    return (
      '<li class="item-card item-' + r.st + '" data-id="' + shellEsc(it.id) + '">' +
      '<div class="item-head"><strong>' + shellEsc(it.name) + '</strong><span class="status-badge status-' + r.st + '">' + STATUS_LABEL[r.st] + "</span></div>" +
      '<div class="item-sub">' + shellEsc(it.zone) + " · 기한 " + fmtDateTime(r.exp) + " · 알림 " + fmtDateTime(alertAt) + "</div>" +
      '<div class="item-actions">' +
      '<button type="button" class="btn-small" data-act="done">처리완료</button>' +
      '<div class="item-actions-right">' +
      '<button type="button" class="btn-small btn-ghost" data-act="edit">수정</button>' +
      '<button type="button" class="btn-small btn-ghost" data-act="del">삭제</button></div></div></li>'
    );
  }

  function doneCardHtml(r) {
    var it = r.item;
    return (
      '<li class="item-card item-done" data-id="' + shellEsc(it.id) + '">' +
      '<div class="item-head"><strong>' + shellEsc(it.name) + '</strong><span class="status-badge status-done">처리완료</span></div>' +
      '<div class="item-sub">' + shellEsc(it.zone) + " · 기한 " + fmtDateTime(r.exp) + (it.doneAt ? " · 처리 " + fmtDateTime(new Date(it.doneAt)) : "") + "</div>" +
      '<div class="item-actions"><button type="button" class="btn-small btn-ghost" data-act="undo">되돌리기</button></div></li>'
    );
  }

  // 삭제 보관함 카드(ARTECAFE의 "삭제된 …"와 같은 방식): 복원 / 완전 삭제
  function trashCardHtml(r) {
    var it = r.item;
    return (
      '<li class="item-card item-trash" data-id="' + shellEsc(it.id) + '">' +
      '<div class="item-head"><strong>' + shellEsc(it.name) + "</strong></div>" +
      '<div class="item-sub">' + shellEsc(it.zone) + " · 기한 " + fmtDateTime(r.exp) + (it.deletedAt ? " · " + fmtDateTime(new Date(it.deletedAt)) + " 삭제" : "") + "</div>" +
      '<div class="item-actions"><button type="button" class="btn-small" data-act="restore">복원</button>' +
      '<button type="button" class="btn-small btn-ghost" data-act="purge">완전 삭제</button></div></li>'
    );
  }

  function render() {
    cvsStore.purgeExpiredTrash(new Date()); // 보관함에 있는 동안 기한이 지난 건은 복원할 의미가 없어 완전 삭제로 넘긴다
    var html = renderShell("편의점", "process", "유통기한 처리");
    html += '<main class="cafe-main">';
    var today = cvsYmd(new Date());
    html += '<div class="form-card form-card-wide">';
    html += '<div class="form-field"><label>유통기한 만료일자</label>' +
      '<div class="day-filter">' +
      '<button type="button" class="chip' + (state.day === null ? " chip-active" : "") + '" data-day="all">전체</button>' +
      '<button type="button" class="chip' + (state.day === today ? " chip-active" : "") + '" data-day="today">오늘</button>' +
      '<div class="day-nav"><button type="button" class="btn-small btn-ghost" data-step="-1" aria-label="이전 날">‹</button>' +
      '<input type="text" id="day-input" class="date-field" readonly value="' + (state.day || today) + '" aria-label="확인일 선택" />' +
      '<button type="button" class="btn-small btn-ghost" data-step="1" aria-label="다음 날">›</button></div></div></div>';
    html += '<div class="form-field"><label>구역</label><div class="chip-row" id="zone-chips">';
    [["all", "전체"]].concat(cvsStore.listZones().map(function (z) { return [z, z]; })).forEach(function (c) {
      html += '<button type="button" class="chip' + (state.zone === c[0] ? " chip-active" : "") + '" data-zone="' + shellEsc(c[0]) + '">' + shellEsc(c[1]) + "</button>";
    });
    html += "</div></div>";
    html += '<div class="form-field"><label>유통기한 처리여부</label><div class="chip-row"><button type="button" class="chip' + (state.showDone ? "" : " chip-active") + '" data-view="active">처리필요</button>' +
      '<button type="button" class="chip' + (state.showDone ? " chip-active" : "") + '" data-view="done">처리완료</button></div></div>';
    html += "</div>";
    if (state.showDone) {
      var done = rowsFor("done").sort(function (a, b) {
        return (b.item.doneAt || "") < (a.item.doneAt || "") ? -1 : 1;
      });
      html += done.length === 0 ? '<div class="settings-empty">처리완료한 건이 없습니다.</div>' : '<ul class="item-list">' + done.map(doneCardHtml).join("") + "</ul>";
    } else {
      var rows = rowsFor("active").sort(function (a, b) {
        return STATUS_ORDER[a.st] - STATUS_ORDER[b.st] || a.exp - b.exp;
      });
      var counts = { overdue: 0, soon: 0, waiting: 0 };
      rows.forEach(function (r) {
        counts[r.st]++;
      });
      html += '<div class="field-hint summary-line">' + rows.length + "건 · 지남 " + counts.overdue + " · 임박 " + counts.soon + " · 대기 " + counts.waiting + "</div>";
      html += rows.length === 0 ? '<div class="settings-empty">처리할 건이 없습니다.</div>' : '<ul class="item-list">' + rows.map(cardHtml).join("") + "</ul>";
      var trash = rowsFor("trash").sort(function (a, b) {
        return a.exp - b.exp;
      });
      if (trash.length > 0) {
        html += "<h2>삭제된 건</h2>" +
          '<div class="field-hint">복원할 수 있습니다. 유통기한이 지나면 보관함에서도 자동으로 사라집니다.</div>' +
          '<ul class="item-list">' + trash.map(trashCardHtml).join("") + "</ul>";
      }
    }
    html += "</main>";
    app.innerHTML = html;
    var dayInput = document.getElementById("day-input");
    attachDatePicker(dayInput, {});
    dayInput.addEventListener("change", function () {
      state.day = dayInput.value;
      render();
    });
    if (firstRender) {
      firstRender = false;
      autoOpenShellAlerts();
    }
  }

  app.addEventListener("click", function (e) {
    var dayBtn = e.target.closest("[data-day]");
    if (dayBtn) {
      state.day = dayBtn.getAttribute("data-day") === "all" ? null : cvsYmd(new Date());
      render();
      return;
    }
    var step = e.target.closest("[data-step]");
    if (step) {
      // 이전·다음 날: 지금 보는 날(전체 일자였으면 오늘)에서 하루씩 이동
      var base = parseLocal(state.day || cvsYmd(new Date()), "00:00");
      base.setDate(base.getDate() + parseInt(step.getAttribute("data-step"), 10));
      state.day = cvsYmd(base);
      render();
      return;
    }
    var chip = e.target.closest("[data-zone]");
    if (chip) {
      state.zone = chip.getAttribute("data-zone");
      render();
      return;
    }
    var view = e.target.closest("[data-view]");
    if (view) {
      state.showDone = view.getAttribute("data-view") === "done";
      render();
      return;
    }
    var btn = e.target.closest("[data-act]");
    if (!btn) {
      return;
    }
    var id = btn.closest("[data-id]").getAttribute("data-id");
    var it = cvsStore.listItems().filter(function (x) {
      return x.id === id;
    })[0];
    if (!it) {
      return;
    }
    var act = btn.getAttribute("data-act");
    if ((act === "undo" || act === "restore") && cvsStore.findDuplicate(it.name, new Date(it.expiresAt), id)) {
      // 같은 상품·일자·시간이 이미 처리 전으로 등록되어 있으면 되살리지 않는다(중복 방지)
      confirmDialog({
        title: "'" + it.name + "' 건을 되살릴 수 없습니다",
        message: "같은 상품·일자·시간으로 이미 등록된 건이 있습니다. 기존 건을 먼저 정리해 주세요.",
        infoOnly: true,
      });
      return;
    }
    if (act === "done") {
      cvsStore.setStatus(id, "done").then(render);
    } else if (act === "undo") {
      cvsStore.setStatus(id, "active").then(render);
    } else if (act === "edit") {
      openItemEditor(it, render);
    } else if (act === "restore") {
      cvsStore.setStatus(id, "active").then(render);
    } else if (act === "purge") {
      confirmDialog({
        title: "'" + it.name + "' 건을 완전히 삭제할까요?",
        message: "보관함에서도 지워지며 이후에는 복원할 수 없습니다.",
        confirmLabel: "완전 삭제",
      }).then(function (ok) {
        if (ok) {
          cvsStore.setStatus(id, "purged").then(render);
        }
      });
    } else if (act === "del") {
      // 아직 기한 전이면 보관함(복원 가능), 이미 기한이 지난 건은 복원해도 의미가 없어 보관함 없이 바로 완전 삭제
      var expired = new Date(it.expiresAt) <= new Date();
      confirmDialog({
        title: "'" + it.name + "' 건을 삭제할까요?",
        message: expired
          ? "이미 유통기한이 지난 건이라 보관함에 남지 않고 바로 삭제되며 복원할 수 없습니다. 폐기·판매로 없어진 상품은 [처리완료]를 누르세요."
          : "삭제해도 아래 '삭제된 건'에서 복원할 수 있습니다. 유통기한이 지나면 보관함에서도 자동으로 사라집니다.",
        confirmLabel: "삭제",
      }).then(function (ok) {
        if (ok) {
          cvsStore.setStatus(id, expired ? "purged" : "trash").then(render);
        }
      });
    }
  });

  render();
});
