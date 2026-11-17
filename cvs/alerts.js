// 알림 목록 계산 + 앱을 열었을 때 알림창 자동 열기. 필요: expiry-rules.js, store.js, shell.js
// 알림 대상 = 처리 전(active)이면서 지남 또는 임박인 건. 지남을 먼저, 각각 기한 빠른 순.
function getShellAlerts() {
  var now = new Date();
  var rows = cvsStore
    .listItems()
    .filter(function (it) {
      return it.status === "active";
    })
    .map(function (it) {
      var exp = new Date(it.expiresAt);
      return { item: it, exp: exp, status: statusOf(exp, now) };
    })
    .filter(function (r) {
      return r.status !== "waiting";
    });
  rows.sort(function (a, b) {
    if (a.status !== b.status) {
      return a.status === "overdue" ? -1 : 1;
    }
    return a.exp - b.exp;
  });
  return rows.map(function (r) {
    return {
      title: (r.status === "overdue" ? "지남 · " : "임박 · ") + r.item.name,
      text: r.item.zone + " · " + fmtDateTime(r.exp),
      href: "process.html",
      level: r.status, // "overdue"(지남) | "soon"(임박) — 알림창에서 색을 다르게 보여 주는 데 쓴다
    };
  });
}

// 알림창 아래에 붙는 안내 문구(사용자 지정). 3단계 웹푸시 알림에도 같은 문구를 넣는다.
function getShellAlertNote() {
  return "유통기한 처리완료 된 상품은 유통기한처리에서 처리완료 반영해주세요.";
}

// 앱을 열었을 때(세션당 1회) 알림 대상이 있으면 알림창을 자동으로 보여 준다.
function autoOpenShellAlerts() {
  var flag = "cvs_alert_shown";
  try {
    if (sessionStorage.getItem(flag)) {
      return;
    }
    sessionStorage.setItem(flag, "1");
  } catch (e) {
    // sessionStorage를 못 쓰면 화면을 열 때마다 보여 준다
  }
  if (getShellAlerts().length > 0) {
    openShellAlerts();
  }
}
