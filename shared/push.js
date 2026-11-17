// 웹 푸시 알림 켜기(3단계). 기기마다 한 번 허용받아 구독 정보를 cvs_push_subscriptions에 저장한다.
// shell.js의 알림창이 pushEnableRowHtml()을 불러 상태 줄(버튼/안내)을 보여주고, 버튼 클릭은 shell.js의 위임 클릭 처리에서 enablePushNotifications()를 부른다.
// 공개 열쇠라 화면 코드에 그대로 둬도 된다(비밀 열쇠는 서버 쪽에만, Supabase Edge Function Secrets).
var PUSH_VAPID_PUBLIC_KEY = "BGIeO7o_pQn_KyFYc4vpzV9cx45zY6DSPO7UzC6m4JFpYwjso_bvah-0Rwjh4Ahq5MKkX40mYeJqoNXmmIVpn4A";

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64String) {
  var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  var rawData = atob(base64);
  return Uint8Array.from(
    [...rawData].map(function (c) {
      return c.charCodeAt(0);
    })
  );
}

// 알림창에 보여줄 상태 줄. 미지원·이미 켜짐이면 조용히 아무것도 안 보여준다(매번 번거롭게 안내하지 않음).
function pushEnableRowHtml() {
  if (!pushSupported()) {
    return "";
  }
  if (Notification.permission === "denied") {
    return '<p class="shell-alert-note">알림이 차단돼 있습니다. 브라우저의 이 사이트 알림 권한을 허용으로 바꿔 주세요.</p>';
  }
  if (Notification.permission === "granted") {
    return "";
  }
  return '<div class="shell-push-row"><button type="button" class="btn-small" data-push-enable="1">이 기기로 알림 받기</button></div>';
}

function enablePushNotifications() {
  if (!pushSupported()) {
    return;
  }
  // 클릭(사용자 동작)과 권한 요청 사이에 다른 비동기 작업이 끼면 일부 브라우저(안드로이드 크롬 등)가
  // 허용 창을 아예 안 띄우고 조용히 넘어갈 수 있어, 권한 요청을 클릭 직후 가장 먼저 부른다.
  Notification.requestPermission()
    .then(function (perm) {
      if (perm !== "granted") {
        if (typeof confirmDialog === "function") {
          confirmDialog({ title: "알림 권한이 필요합니다", message: "방금 뜬 허용 창에서 허용을 눌러야 알림을 받을 수 있습니다. 다시 시도해 주세요.", infoOnly: true });
        }
        return null;
      }
      return navigator.serviceWorker
        .register("sw.js")
        .then(function () {
          return navigator.serviceWorker.ready;
        })
        .then(function (reg) {
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC_KEY),
          });
        });
    })
    .then(function (sub) {
      if (!sub) {
        return null;
      }
      var json = sub.toJSON();
      return window.cvsDb.request(
        "POST",
        "/rest/v1/cvs_push_subscriptions?on_conflict=endpoint",
        [{ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, last_seen_at: new Date().toISOString() }],
        // return=minimal이면 서버가 빈 응답을 주는데 boot.js의 request()가 204가 아닌 빈 응답은 그대로 JSON으로 읽으려다 오류가 났다 — representation으로 받아 피한다.
        { Prefer: "resolution=merge-duplicates,return=representation" }
      );
    })
    .then(function (result) {
      if (result === null) {
        return;
      }
      // 알림창(.shell-alert-dialog)이 열려 있는 상태라, 안내창을 먼저 띄우면 모달이 겹쳐서 제대로 안 보일 수 있다 — 알림창부터 닫는다.
      var dlg = document.querySelector(".shell-alert-dialog");
      if (dlg) {
        dlg.close();
      }
      if (typeof confirmDialog === "function") {
        confirmDialog({ title: "알림을 켰습니다", message: "이 기기로 유통기한 알림을 받습니다.", infoOnly: true });
      }
    })
    .catch(function (e) {
      var dlg = document.querySelector(".shell-alert-dialog");
      if (dlg) {
        dlg.close();
      }
      if (typeof confirmDialog === "function") {
        confirmDialog({ title: "알림을 켜지 못했습니다", message: String((e && e.message) || e), infoOnly: true });
      }
    });
}
