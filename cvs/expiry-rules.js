// 유통기한 규칙 계산(화면과 분리한 순수 함수). 설계 문서(CLAUDE.md) 4절이 기준이다.
// 2단계에서 서버(푸시 시각 계산)도 이 파일과 같은 기준을 써야 앱 표시와 푸시 시각이 어긋나지 않는다.
// 시간은 브라우저 로컬 시간을 한국시간으로 본다(서버 쪽은 Asia/Seoul로 명시할 것).
var CVS_ZONES = ["포스쪽 오픈케이스", "창고쪽 오픈케이스", "핫바류", "그 외 식품류"];

var CVS_CHECK_START_MIN = 11 * 60; // 확인 구간 시작 11:00 (오픈 10시지만 오픈 직후 바로 폐기하므로 11시부터)
var CVS_CHECK_END_MIN = 19 * 60; // 확인 구간 끝 19:00(정각 포함)
var CVS_ALERT_BEFORE_MIN = 10; // 구간 안 기한은 10분 전에 알림
var CVS_EVENING_ALERT_MIN = 17 * 60 + 30; // 구간 밖 기한은 확인일 17:30에 알림
var CVS_DEFAULT_TIME = "23:59"; // 시간이 없는 날짜(옛 엑셀 자료)의 기본 시간
var CVS_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function cvsPad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function cvsMinuteOfDay(d) {
  return d.getHours() * 60 + d.getMinutes();
}

function cvsYmd(d) {
  return d.getFullYear() + "-" + cvsPad2(d.getMonth() + 1) + "-" + cvsPad2(d.getDate());
}

// 확인일: 기한이 11:00 전이면 전날, 11:00 이후면 당일 ("YYYY-MM-DD")
function checkDateOf(expiresAt) {
  var day = new Date(expiresAt.getFullYear(), expiresAt.getMonth(), expiresAt.getDate());
  if (cvsMinuteOfDay(expiresAt) < CVS_CHECK_START_MIN) {
    day.setDate(day.getDate() - 1);
  }
  return cvsYmd(day);
}

// 알림 시각: 11:00~19:00(정각 포함)이면 기한 10분 전, 그 밖에는 확인일 17:30
function alertAtOf(expiresAt) {
  var m = cvsMinuteOfDay(expiresAt);
  if (m >= CVS_CHECK_START_MIN && m <= CVS_CHECK_END_MIN) {
    return new Date(expiresAt.getTime() - CVS_ALERT_BEFORE_MIN * 60000);
  }
  var p = checkDateOf(expiresAt).split("-");
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), Math.floor(CVS_EVENING_ALERT_MIN / 60), CVS_EVENING_ALERT_MIN % 60);
}

// 지남(기한 이후) / 임박(알림 시각 이후~기한 전) / 대기
function statusOf(expiresAt, now) {
  if (now.getTime() >= expiresAt.getTime()) {
    return "overdue";
  }
  if (now.getTime() >= alertAtOf(expiresAt).getTime()) {
    return "soon";
  }
  return "waiting";
}

// "YYYY-MM-DD" + "HH:MM" → Date (시간이 비면 23:59)
function parseLocal(dateStr, timeStr) {
  var dp = dateStr.split("-");
  var tp = (timeStr || CVS_DEFAULT_TIME).split(":");
  return new Date(parseInt(dp[0], 10), parseInt(dp[1], 10) - 1, parseInt(dp[2], 10), parseInt(tp[0], 10), parseInt(tp[1], 10));
}

// 화면 표시: "11/17(화)"
function fmtDate(d) {
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + CVS_WEEKDAYS[d.getDay()] + ")";
}

// 화면 표시: "11/17(화) 04:05"
function fmtDateTime(d) {
  return fmtDate(d) + " " + cvsPad2(d.getHours()) + ":" + cvsPad2(d.getMinutes());
}

// 상품명 비교용 정리: 앞뒤 공백 제거 + 연속 공백 1칸
function normalizeName(s) {
  return String(s).replace(/\s+/g, " ").trim();
}
