// 수정 창(등록 화면·처리 화면 공용): 상품명·구역·유통기한(날짜+시)을 고친다.
// 사용: openItemEditor(item, function () { 저장 뒤 화면 다시 그리기 })
// 필요: expiry-rules.js, store.js, time-select.js, date-picker.js, shell.js(shellEsc)
function openItemEditor(it, onSaved) {
  var exp = new Date(it.expiresAt);
  var dlg = document.createElement("dialog");
  dlg.className = "confirm-dialog item-editor";
  dlg.innerHTML =
    '<div class="confirm-title">수정</div>' +
    '<div class="form-field"><label for="ed-name">상품명</label><input type="text" id="ed-name" maxlength="60" value="' + shellEsc(it.name) + '" /></div>' +
    '<div class="form-field"><label for="ed-zone">구역</label><select id="ed-zone">' +
    cvsStore.listZones().map(function (z) {
      return '<option value="' + shellEsc(z) + '"' + (z === it.zone ? " selected" : "") + ">" + shellEsc(z) + "</option>";
    }).join("") +
    "</select></div>" +
    '<div class="form-field"><label>유통기한</label><div class="expiry-row">' +
    '<input type="text" class="date-field" id="ed-date" readonly value="' + cvsYmd(exp) + '" />' +
    timeSelectHtml("ed-time", cvsPad2(exp.getHours()) + ":" + cvsPad2(exp.getMinutes())) +
    '</div><div class="field-hint" id="ed-preview"></div></div>' +
    '<div class="confirm-actions"><button type="button" class="btn-small btn-ghost" data-r="0">취소</button><button type="button" class="btn-small" data-r="1">저장</button></div>';
  document.body.appendChild(dlg);

  var nameInput = dlg.querySelector("#ed-name");
  var zoneSelect = dlg.querySelector("#ed-zone");
  var dateInput = dlg.querySelector("#ed-date");
  var timeInput = dlg.querySelector("#ed-time");
  var preview = dlg.querySelector("#ed-preview");
  attachDatePicker(dateInput, {});

  function updatePreview() {
    var e = parseLocal(dateInput.value, timeInput.value);
    preview.textContent = isNaN(e.getTime()) ? "" : "알림 " + fmtDateTime(alertAtOf(e));
  }
  dateInput.addEventListener("change", updatePreview);
  timeInput.addEventListener("change", updatePreview);
  updatePreview();

  dlg.addEventListener("click", function (ev) {
    if (ev.target === dlg) {
      dlg.close();
      return;
    }
    var btn = ev.target.closest("[data-r]");
    if (!btn) {
      return;
    }
    if (btn.getAttribute("data-r") === "1") {
      var name = normalizeName(nameInput.value);
      var e = parseLocal(dateInput.value, timeInput.value);
      if (!name) {
        preview.textContent = "상품명을 입력하세요.";
        return;
      }
      if (isNaN(e.getTime())) {
        preview.textContent = "날짜·시간을 확인하세요.";
        return;
      }
      if (it.status === "active" && cvsStore.findDuplicate(name, e, it.id)) {
        preview.textContent = "이미 같은 상품·일자·시간으로 등록된 건이 있어 저장하지 않았습니다.";
        return;
      }
      btn.disabled = true;
      cvsStore.updateItem(it.id, { name: name, zone: zoneSelect.value, expiresAt: e }).then(
        function () {
          dlg.close();
          onSaved();
        },
        function (err) {
          btn.disabled = false;
          preview.textContent = "저장하지 못했습니다. " + err.message;
        }
      );
      return;
    }
    dlg.close();
  });
  dlg.addEventListener("close", function () {
    dlg.remove();
  });
  dlg.showModal();
}
