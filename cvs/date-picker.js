// 직접 만든 달력 선택창 (브라우저 기본 날짜 입력칸은 한국어 설정에서 요일 자리가 "()"로 비어 보여 대체).
// 사용: <input type="text" readonly class="date-field" value="YYYY-MM-DD"> 에 attachDatePicker(input, { max: "YYYY-MM-DD" })
// 입력칸을 누르면 달력이 뜨고, 날짜를 고르면 input.value를 바꾸고 input/change 이벤트를 발생시킨다(기존 폼 코드는 그대로 동작).
function attachDatePicker(input, opts) {
  opts = opts || {};
  var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function parse(s) {
    var p = s.split("-");
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) };
  }

  function open() {
    var start = parse(input.value || opts.max || todayStr());
    var viewY = start.y;
    var viewM = start.m;
    var maxStr = opts.max || "9999-12-31";
    var maxP = parse(maxStr);
    var dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog date-dialog";

    // 화면 모드: days(날짜) → 제목 누르면 months(월) → 연도 누르면 years(연도 목록)
    var mode = "days";
    var yearEnd = Math.min(maxP.y, viewY + 5); // years 모드에서 보여 주는 12개 연도의 마지막 해

    function navHtml(label, labelAttr, prevAttr, nextAttr, nextDisabled) {
      return (
        '<div class="year-nav"><button type="button" class="btn-small btn-ghost" ' +
        prevAttr +
        '>‹</button><button type="button" class="month-label" ' +
        labelAttr +
        ">" +
        label +
        '</button><button type="button" class="btn-small btn-ghost" ' +
        nextAttr +
        (nextDisabled ? " disabled" : "") +
        ">›</button></div>"
      );
    }

    function draw() {
      var footer =
        '<div class="confirm-actions"><button type="button" class="btn-small btn-ghost" data-today="1"' +
        (todayStr() > maxStr ? " disabled" : "") +
        '>오늘</button><button type="button" class="btn-small btn-ghost" data-close="1">닫기</button></div>';

      if (mode === "years") {
        var yStart = yearEnd - 11;
        var ycells = "";
        for (var y = yStart; y <= yearEnd; y++) {
          ycells +=
            '<button type="button" class="btn-small ' + (y === viewY ? "" : "btn-ghost") + '" data-year="' + y + '"' + (y > maxP.y ? " disabled" : "") + ">" + y + "년</button>";
        }
        dlg.innerHTML =
          navHtml(yStart + "년 ~ " + yearEnd + "년", 'data-mode="months"', 'data-ypage="-1"', 'data-ypage="1"', yearEnd >= maxP.y) +
          '<div class="month-grid">' + ycells + "</div>" + footer;
        return;
      }

      if (mode === "months") {
        var mcells = "";
        for (var m = 1; m <= 12; m++) {
          var mDisabled = viewY === maxP.y && m > maxP.m;
          mcells +=
            '<button type="button" class="btn-small ' + (viewY === start.y && m === start.m ? "" : "btn-ghost") + '" data-month="' + m + '"' + (mDisabled ? " disabled" : "") + ">" + m + "월</button>";
        }
        dlg.innerHTML =
          navHtml(viewY + "년 ▾", 'data-mode="years"', 'data-ynav="-1"', 'data-ynav="1"', viewY >= maxP.y) +
          '<div class="month-grid">' + mcells + "</div>" + footer;
        return;
      }

      var firstDay = new Date(viewY, viewM - 1, 1).getDay();
      var daysInMonth = new Date(viewY, viewM, 0).getDate();
      var cells = "";
      for (var i = 0; i < firstDay; i++) {
        cells += "<span></span>";
      }
      for (var d = 1; d <= daysInMonth; d++) {
        var ds = viewY + "-" + pad2(viewM) + "-" + pad2(d);
        var cls = "cal-day" + (ds === input.value ? " cal-selected" : "") + (ds === todayStr() ? " cal-today" : "");
        cells += '<button type="button" class="' + cls + '" data-d="' + ds + '"' + (ds > maxStr ? " disabled" : "") + ">" + d + "</button>";
      }
      var nextDisabled = viewY > maxP.y || (viewY === maxP.y && viewM >= maxP.m);
      dlg.innerHTML =
        navHtml(viewY + "년 " + viewM + "월 ▾", 'data-mode="months"', 'data-nav="-1"', 'data-nav="1"', nextDisabled) +
        '<div class="cal-grid cal-head">' +
        WEEKDAYS.map(function (w) {
          return "<span>" + w + "</span>";
        }).join("") +
        '</div><div class="cal-grid">' +
        cells +
        "</div>" +
        footer;
    }
    draw();

    function pick(ds) {
      input.value = ds;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      dlg.close();
    }

    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-close]")) {
        dlg.close();
        return;
      }
      var modeBtn = e.target.closest("[data-mode]");
      if (modeBtn) {
        // 날짜 화면의 제목 → 월 선택, 월 화면의 연도 → 연도 목록(월 화면에서 제목을 다시 누르면 날짜로 복귀)
        var target = modeBtn.getAttribute("data-mode");
        if (mode === "years") {
          mode = "months";
        } else if (mode === "months" && target === "months") {
          mode = "days";
        } else {
          mode = target;
        }
        if (mode === "years") {
          yearEnd = Math.min(maxP.y, viewY + 5);
        }
        draw();
        return;
      }
      var yPage = e.target.closest("[data-ypage]");
      if (yPage) {
        yearEnd = Math.min(maxP.y, yearEnd + 12 * parseInt(yPage.getAttribute("data-ypage"), 10));
        draw();
        return;
      }
      var yNav = e.target.closest("[data-ynav]");
      if (yNav) {
        viewY += parseInt(yNav.getAttribute("data-ynav"), 10);
        draw();
        return;
      }
      var yearBtn = e.target.closest("[data-year]");
      if (yearBtn) {
        viewY = parseInt(yearBtn.getAttribute("data-year"), 10);
        if (viewY === maxP.y && viewM > maxP.m) {
          viewM = maxP.m;
        }
        mode = "months";
        draw();
        return;
      }
      var monthBtn = e.target.closest("[data-month]");
      if (monthBtn) {
        viewM = parseInt(monthBtn.getAttribute("data-month"), 10);
        mode = "days";
        draw();
        return;
      }
      var nav = e.target.closest("[data-nav]");
      if (nav) {
        viewM += parseInt(nav.getAttribute("data-nav"), 10);
        if (viewM < 1) {
          viewM = 12;
          viewY--;
        } else if (viewM > 12) {
          viewM = 1;
          viewY++;
        }
        draw();
        return;
      }
      if (e.target.closest("[data-today]")) {
        pick(todayStr());
        return;
      }
      var day = e.target.closest("[data-d]");
      if (day) {
        pick(day.getAttribute("data-d"));
      }
    });
    dlg.addEventListener("close", function () {
      dlg.remove();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  }

  input.addEventListener("click", open);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
}
