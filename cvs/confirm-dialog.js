// 삭제 확인 안내창 (설정 화면 공용). 사용: confirmDialog({title, message, details, confirmLabel, infoOnly}).then(function (ok) {...})
// 취소 버튼에 먼저 포커스가 가므로 Enter를 눌러도 실수로 삭제되지 않는다. Esc·바깥 클릭은 취소.
function confirmDialog(opts) {
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return new Promise(function (resolve) {
    var result = false;
    var dlg = document.createElement("dialog");
    dlg.className = "confirm-dialog";
    dlg.innerHTML =
      '<div class="confirm-title">' +
      esc(opts.title) +
      '</div><p class="confirm-message">' +
      esc(opts.message) +
      "</p>" +
      (opts.details && opts.details.length
        ? '<ul class="confirm-details">' +
          opts.details
            .map(function (d) {
              return "<li>" + esc(d) + "</li>";
            })
            .join("") +
          "</ul>"
        : "") +
      (opts.infoOnly
        ? // 안내만 하는 모드: 확인 버튼 하나 (삭제 불가 사유 등을 알릴 때)
          '<div class="confirm-actions"><button type="button" class="btn-small" data-r="0">확인</button></div>'
        : '<div class="confirm-actions"><button type="button" class="btn-small btn-ghost" data-r="0">취소</button>' +
          '<button type="button" class="btn-small btn-danger" data-r="1">' +
          esc(opts.confirmLabel || "삭제") +
          "</button></div>");

    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) {
        dlg.close();
        return;
      }
      var btn = e.target.closest("[data-r]");
      if (btn) {
        result = btn.getAttribute("data-r") === "1";
        dlg.close();
      }
    });
    dlg.addEventListener("close", function () {
      dlg.remove();
      resolve(result);
    });

    document.body.appendChild(dlg);
    dlg.showModal();
  });
}
