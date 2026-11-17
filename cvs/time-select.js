// 유통기한 "시" 선택 드롭다운(분은 입력하지 않는다). 값은 "HH:MM" 문자열이고 빈 값("")은 "시간 없음" = 그날 23:59(parseLocal이 처리).
// 사용: timeSelectHtml("time-input", "14:00") → <select> HTML. 이미 저장된 값이 정시(분 00)가 아니면 그 값을 "현재값"으로 맨 위에 따로 보여 준다(시험·옛 데이터가 몰래 바뀌지 않도록).
function timeSelectHtml(id, selected) {
  var sel = selected === CVS_DEFAULT_TIME ? "" : selected || "";
  var opts = [{ v: "", label: "시간 미정" }];
  var isHour = /^\d\d:00$/.test(sel);
  if (sel && !isHour) {
    opts.push({ v: sel, label: sel + " (현재값)" });
  }
  for (var h = 0; h < 24; h++) {
    var v = cvsPad2(h) + ":00";
    opts.push({ v: v, label: cvsPad2(h) + "시" });
  }
  return (
    '<select id="' + id + '" aria-label="유통기한 시간">' +
    opts
      .map(function (o) {
        return '<option value="' + o.v + '"' + (o.v === sel ? " selected" : "") + ">" + o.label + "</option>";
      })
      .join("") +
    "</select>"
  );
}
