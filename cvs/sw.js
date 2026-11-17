// 최소한의 서비스 워커(ARTECAFE webapp/sw.js를 확장) — 크롬 "앱 설치" 조건을 채우고, 웹 푸시 수신·클릭 처리를 담당한다.
// 화면 파일은 저장(캐시)하지 않는다: 저장하면 배포 후에도 예전 화면이 남는 문제가 생기기 때문이다. 모든 요청은 브라우저가 그대로 처리한다.
// 이 파일의 위치(cvs/sw.js)가 곧 적용 범위다 — cvs/ 아래 화면(register·process·settings)에서만 동작한다.
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function () {
  // 일부러 비워 둔다(응답을 가로채지 않음)
});

// 웹 푸시 수신 → 알림 띄우기. 서버(Edge Function)가 보내는 JSON: { title, body, url }
self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "편의점 유통기한", body: event.data ? event.data.text() : "" };
  }
  var title = data.title || "편의점 유통기한";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      data: { url: data.url || "process.html" },
    })
  );
});

// 알림 클릭 → 처리 화면으로 이동(이미 열린 탭이 있으면 그 탭을 그대로 포커스)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "process.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) {
          if ("navigate" in list[i]) {
            list[i].navigate(url).catch(function () {});
          }
          return list[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
