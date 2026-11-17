// 공통 셸: 모든 편의점 유통기한 화면이 이 함수로 상단 헤더/탭을 채운다 (ARTECAFE shared/shell.js에서 가져와 탭·아이콘만 줄였다).
// 알림 목록은 각 화면이 getShellAlerts()로 제공한다(alerts.js). 없으면 알림 없음.
var SHELL_ICON_ATTRS = 'width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
var SHELL_ICON_BELL =
  "<svg " + SHELL_ICON_ATTRS + '><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
var SHELL_ICON_GEAR =
  "<svg " +
  SHELL_ICON_ATTRS +
  '><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

function shellEsc(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderShell(title, activeNav, subtitle) {
  var navItems = [
    { key: "register", label: "유통기한등록", href: "register.html" },
    { key: "process", label: "유통기한처리", href: "process.html" },
  ];

  var navHtml = navItems
    .map(function (item) {
      var activeClass = item.key === activeNav ? " shell-nav-active" : "";
      return '<a class="shell-nav-item' + activeClass + '" href="' + item.href + '">' + item.label + "</a>";
    })
    .join("");

  var alerts = typeof getShellAlerts === "function" ? getShellAlerts() : [];
  var subtitleHtml = subtitle ? '<div class="shell-subtitle">' + subtitle + "</div>" : "";

  return (
    '<header class="shell-header">' +
    '<div class="shell-title-group"><div class="shell-title">' + title + "</div>" + subtitleHtml + "</div>" +
    '<div class="shell-icons">' +
    '<a class="shell-alert-btn" href="settings.html" title="설정" aria-label="설정">' +
    SHELL_ICON_GEAR +
    "</a>" +
    '<button type="button" class="shell-alert-btn shell-bell" id="shell-bell" aria-label="알림">' +
    SHELL_ICON_BELL +
    (alerts.length > 0 ? '<span class="shell-badge">' + alerts.length + "</span>" : "") +
    "</button></div></header>" +
    '<nav class="shell-nav">' + navHtml + "</nav>"
  );
}

// 🔔 알림창: 항목은 { title, text, href }. 열 때마다 getShellAlerts()를 다시 불러 최신 상태를 보여 준다.
function openShellAlerts() {
  if (document.querySelector(".shell-alert-dialog")) {
    return; // 이미 열려 있으면 또 열지 않는다(자동 열기 + 벨 클릭 겹침 방지)
  }
  var alerts = typeof getShellAlerts === "function" ? getShellAlerts() : [];
  var dlg = document.createElement("dialog");
  dlg.className = "shell-alert-dialog";
  dlg.innerHTML =
    '<div class="shell-alert-title">알림</div>' +
    (alerts.length === 0
      ? '<div class="shell-alert-empty">새로운 알림이 없습니다.</div>'
      : '<ul class="shell-alert-list">' +
        alerts
          .map(function (a) {
            return '<li><a class="' + (a.level ? "shell-alert-" + shellEsc(a.level) : "") + '" href="' + shellEsc(a.href) + '"><strong>' + shellEsc(a.title) + "</strong><span>" + shellEsc(a.text) + "</span></a></li>";
          })
          .join("") +
        "</ul>" +
        (typeof getShellAlertNote === "function" && getShellAlertNote() ? '<p class="shell-alert-note">' + shellEsc(getShellAlertNote()) + "</p>" : "")) +
    '<div class="shell-alert-actions"><button type="button" data-close="1">확인</button></div>';
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest("[data-close]")) {
      dlg.close();
    }
  });
  dlg.addEventListener("close", function () {
    dlg.remove();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
}

document.addEventListener("click", function (e) {
  if (e.target.closest("#shell-bell")) {
    openShellAlerts();
  }
});
