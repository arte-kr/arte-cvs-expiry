// 바코드 촬영 인식(register.html 전용). 크롬(안드로이드 등) BarcodeDetector 지원 브라우저에서만 동작 — 사파리·파이어폭스는 미지원 안내만 한다.
// 사용: openBarcodeScanner().then(function (code) { ... }) — code는 인식한 숫자 문자열, 취소·미지원·카메라 오류면 null.
function openBarcodeScanner() {
  if (!("BarcodeDetector" in window)) {
    return confirmDialog({
      title: "이 브라우저는 바코드 인식을 지원하지 않습니다",
      message: "크롬(안드로이드)에서 촬영해 주세요. 지금은 상품명을 직접 입력해 주세요.",
      infoOnly: true,
    }).then(function () {
      return null;
    });
  }

  return new Promise(function (resolve) {
    var dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog barcode-dialog";
    dlg.innerHTML =
      '<div class="confirm-title">바코드를 카메라에 비춰 주세요</div>' +
      '<video class="barcode-video" autoplay playsinline muted></video>' +
      '<p class="confirm-message" id="barcode-status">카메라를 여는 중...</p>' +
      '<div class="confirm-actions"><button type="button" class="btn-small btn-ghost" data-r="cancel">취소</button></div>';

    var video = dlg.querySelector(".barcode-video");
    var statusEl = dlg.querySelector("#barcode-status");
    var stream = null;
    var detector = null;
    var loopTimer = null;
    var done = false;

    function finish(code) {
      if (done) {
        return;
      }
      done = true;
      if (loopTimer) {
        clearTimeout(loopTimer);
      }
      if (stream) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
      }
      dlg.close();
      resolve(code);
    }

    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.closest("[data-r]")) {
        finish(null);
      }
    });
    dlg.addEventListener("close", function () {
      finish(null);
      dlg.remove();
    });

    document.body.appendChild(dlg);
    dlg.showModal();

    try {
      detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    } catch (e) {
      statusEl.textContent = "이 기기에서는 바코드 인식을 지원하지 않습니다.";
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(function (s) {
        if (done) {
          s.getTracks().forEach(function (t) {
            t.stop();
          });
          return;
        }
        stream = s;
        video.srcObject = s;
        statusEl.textContent = "바코드를 화면 중앙에 맞춰 주세요.";

        function loop() {
          if (done) {
            return;
          }
          detector
            .detect(video)
            .then(function (codes) {
              if (codes.length) {
                finish(codes[0].rawValue);
              } else {
                loopTimer = setTimeout(loop, 300);
              }
            })
            .catch(function () {
              loopTimer = setTimeout(loop, 300);
            });
        }
        loop();
      })
      .catch(function () {
        statusEl.textContent = "카메라를 열 수 없습니다. 브라우저 설정에서 카메라 권한을 확인해 주세요.";
      });
  });
}
