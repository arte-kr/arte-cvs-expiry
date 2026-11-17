// settings.html(설정) — 관리자 비밀번호 확인은 boot.js(data-admin="1")가 이 화면을 실행하기 전에 처리한다(ARTECAFE cafe_admin_* 방식, 2단계).
// 처리 안 된(active) 건이 쓰는 구역·상품은 삭제를 막는다. 삭제해도 "삭제된 ○○"에서 복원하거나 완전 삭제할 수 있다(복원 전까지는 등록·처리 화면에 나타나지 않는다).
document.addEventListener("DOMContentLoaded", function () {
  var app = document.getElementById("app");

  function showMsg(id, text) {
    var el = document.getElementById(id);
    el.textContent = text;
    el.style.display = text ? "block" : "none";
  }

  // ---------------- 구역 ----------------
  function zoneRowsHtml() {
    var zones = cvsStore.listZones();
    if (zones.length === 0) {
      return '<div class="settings-empty">등록된 구역이 없습니다.</div>';
    }
    return (
      '<ul class="item-list">' +
      zones
        .map(function (z) {
          return (
            '<li class="day-row"><div class="day-row-main"><strong>' + shellEsc(z) + "</strong></div>" +
            '<button type="button" class="btn-small btn-ghost" data-del-zone="' + shellEsc(z) + '">삭제</button></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function deletedZoneAreaHtml() {
    var deleted = cvsStore.listDeletedZones();
    if (deleted.length === 0) {
      return "";
    }
    return (
      "<h2>삭제된 구역</h2><ul class=\"item-list\">" +
      deleted
        .map(function (d) {
          return (
            '<li class="item-card item-trash"><div class="item-head"><strong>' + shellEsc(d.zone) + "</strong></div>" +
            '<div class="item-sub">' + shellEsc(d.deletedAt.slice(0, 10)) + ' 삭제</div>' +
            '<div class="item-actions"><button type="button" class="btn-small" data-restore-zone="' + shellEsc(d.zone) + '">복원</button>' +
            '<button type="button" class="btn-small btn-ghost" data-purge-zone="' + shellEsc(d.zone) + '">완전 삭제</button></div></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // ---------------- 상품 ----------------
  function productRowsHtml() {
    var products = cvsStore.listProductRecords();
    if (products.length === 0) {
      return '<div class="settings-empty">등록된 상품이 없습니다.</div>';
    }
    return (
      '<ul class="item-list">' +
      products
        .map(function (p) {
          return (
            '<li class="day-row"><div class="day-row-main"><strong>' + shellEsc(p.name) + "</strong>" +
            (p.barcode ? "<span>바코드 " + shellEsc(p.barcode) + "</span>" : "") + "</div>" +
            '<button type="button" class="btn-small btn-ghost" data-del-product="' + shellEsc(p.name) + '">삭제</button></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function deletedProductAreaHtml() {
    var deleted = cvsStore.listDeletedProducts();
    if (deleted.length === 0) {
      return "";
    }
    return (
      "<h2>삭제된 상품</h2><ul class=\"item-list\">" +
      deleted
        .map(function (d) {
          return (
            '<li class="item-card item-trash"><div class="item-head"><strong>' + shellEsc(d.product.name) + "</strong></div>" +
            '<div class="item-sub">' + shellEsc(d.deletedAt.slice(0, 10)) + ' 삭제</div>' +
            '<div class="item-actions"><button type="button" class="btn-small" data-restore-product="' + shellEsc(d.product.name) + '">복원</button>' +
            '<button type="button" class="btn-small btn-ghost" data-purge-product="' + shellEsc(d.product.name) + '">완전 삭제</button></div></li>'
          );
        })
        .join("") +
      "</ul>"
    );
  }

  // ---------------- 화면 ----------------
  function renderSettings() {
    var html = renderShell("편의점", "", "설정");
    html += '<main class="cafe-main">';

    html += '<div class="form-card form-card-wide">';
    html += '<h2 style="margin-top:0">구역 관리</h2>';
    html += '<form id="zone-form" class="expiry-row" style="margin-bottom:12px">' +
      '<input type="text" id="zone-name" maxlength="20" placeholder="새 구역 이름" />' +
      '<button type="submit" class="btn-small">추가</button></form>';
    html += '<div class="form-message show error" id="zone-msg" style="display:none"></div>';
    html += '<div id="zone-list">' + zoneRowsHtml() + "</div>";
    html += '<div id="deleted-zone-area">' + deletedZoneAreaHtml() + "</div>";
    html += "</div>";

    html += '<div class="form-card form-card-wide" style="margin-top:16px">';
    html += '<h2 style="margin-top:0">상품 관리</h2>';
    html += '<form id="product-form">' +
      '<div class="form-field"><label for="product-name">상품명</label><input type="text" id="product-name" maxlength="60" placeholder="새 상품명" /></div>' +
      '<div class="form-field"><label for="product-barcode">바코드(선택)</label><input type="text" id="product-barcode" maxlength="30" placeholder="나중에 입력해도 됩니다" /></div>' +
      '<button type="submit" class="btn-small">추가</button></form>';
    html += '<div class="form-message show error" id="product-msg" style="display:none"></div>';
    html += '<div id="product-list">' + productRowsHtml() + "</div>";
    html += '<div id="deleted-product-area">' + deletedProductAreaHtml() + "</div>";
    html += "</div>";

    html += "</main>";
    app.innerHTML = html;

    document.getElementById("zone-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var input = document.getElementById("zone-name");
      var btn = e.target.querySelector("button");
      btn.disabled = true;
      cvsStore.addZone(input.value).then(function (r) {
        btn.disabled = false;
        if (!r.ok) {
          showMsg("zone-msg", r.reason);
          return;
        }
        showMsg("zone-msg", "");
        renderSettings();
      });
    });

    document.getElementById("product-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nameInput = document.getElementById("product-name");
      var barcodeInput = document.getElementById("product-barcode");
      var btn = e.target.querySelector("button");
      btn.disabled = true;
      cvsStore.addProduct(nameInput.value, barcodeInput.value).then(function (r) {
        btn.disabled = false;
        if (!r.ok) {
          showMsg("product-msg", r.reason);
          return;
        }
        showMsg("product-msg", "");
        renderSettings();
      });
    });
  }

  // 삭제·복원·완전삭제 버튼(한 번만 연결 — 화면은 다시 그려지므로 위임으로 처리)
  app.addEventListener("click", function (e) {
    var delZone = e.target.closest("[data-del-zone]");
    if (delZone) {
      var zone = delZone.getAttribute("data-del-zone");
      var inUse = cvsStore.listItems().some(function (it) {
        return it.status === "active" && it.zone === zone;
      });
      if (inUse) {
        confirmDialog({
          title: "'" + zone + "' 구역을 삭제할 수 없습니다",
          message: "아직 처리하지 않은 건이 이 구역을 쓰고 있습니다. 먼저 처리완료하거나 다른 구역으로 옮겨 주세요.",
          infoOnly: true,
        });
        return;
      }
      confirmDialog({ title: "'" + zone + "' 구역을 삭제할까요?", message: "삭제해도 아래 '삭제된 구역'에서 복원할 수 있습니다." }).then(function (ok) {
        if (!ok) {
          return;
        }
        cvsStore.deleteZone(zone).then(function () {
          renderSettings();
        });
      });
      return;
    }

    var restoreZone = e.target.closest("[data-restore-zone]");
    if (restoreZone) {
      cvsStore.restoreZone(restoreZone.getAttribute("data-restore-zone")).then(function () {
        renderSettings();
      });
      return;
    }

    var purgeZone = e.target.closest("[data-purge-zone]");
    if (purgeZone) {
      var pz = purgeZone.getAttribute("data-purge-zone");
      confirmDialog({ title: "'" + pz + "' 구역을 완전히 삭제할까요?", message: "이후에는 복원할 수 없습니다.", confirmLabel: "완전 삭제" }).then(function (ok) {
        if (!ok) {
          return;
        }
        cvsStore.purgeZone(pz).then(function () {
          renderSettings();
        });
      });
      return;
    }

    var delProduct = e.target.closest("[data-del-product]");
    if (delProduct) {
      var product = delProduct.getAttribute("data-del-product");
      var prodInUse = cvsStore.listItems().some(function (it) {
        return it.status === "active" && normalizeName(it.name).toLowerCase() === normalizeName(product).toLowerCase();
      });
      if (prodInUse) {
        confirmDialog({
          title: "'" + product + "' 상품을 삭제할 수 없습니다",
          message: "아직 처리하지 않은 건이 이 상품을 쓰고 있습니다. 먼저 처리완료한 뒤 삭제해 주세요.",
          infoOnly: true,
        });
        return;
      }
      confirmDialog({ title: "'" + product + "' 상품을 삭제할까요?", message: "삭제해도 아래 '삭제된 상품'에서 복원할 수 있습니다." }).then(function (ok) {
        if (!ok) {
          return;
        }
        cvsStore.deleteProduct(product).then(function () {
          renderSettings();
        });
      });
      return;
    }

    var restoreProduct = e.target.closest("[data-restore-product]");
    if (restoreProduct) {
      cvsStore.restoreProduct(restoreProduct.getAttribute("data-restore-product")).then(function () {
        renderSettings();
      });
      return;
    }

    var purgeProduct = e.target.closest("[data-purge-product]");
    if (purgeProduct) {
      var pp = purgeProduct.getAttribute("data-purge-product");
      confirmDialog({ title: "'" + pp + "' 상품을 완전히 삭제할까요?", message: "이후에는 복원할 수 없습니다.", confirmLabel: "완전 삭제" }).then(function (ok) {
        if (!ok) {
          return;
        }
        cvsStore.purgeProduct(pp).then(function () {
          renderSettings();
        });
      });
      return;
    }
  });

  renderSettings();
});
