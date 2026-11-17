// 저장소(Supabase, 2단계). 화면은 이 모듈만 부른다(cvsStore). boot.js가 로그인 직후 cvsStore.hydrate(data)로 서버 값을 채운다.
// 읽기 함수(list*, findDuplicate)는 그 자리에서 바로 값을 돌려준다(화면이 바뀌지 않도록). 쓰기 함수(add*/update*/set*/delete*/restore*/purge*)는
// 전부 Promise를 돌려준다 — 화면은 DB 저장에 성공한 뒤에만 자기 상태를 바꾼다(실패하면 화면과 DB가 어긋나지 않게).
// Item = { id, name, zone, expiresAt(ISO 문자열), status, createdAt(ISO), doneAt(ISO|null), deletedAt(ISO|null) }
// status: "active"(처리 전) | "done"(처리완료) | "trash"(삭제 보관함) | "purged"(완전 삭제 — 화면에 안 보임)
// Product = { name, barcode }. 필요: expiry-rules.js(normalizeName)를 먼저 읽을 것. 필요: boot.js가 만든 window.cvsDb(request/rpc).
var cvsStore = (function () {
  var mem = null; // boot.js가 hydrate()로 채우기 전에는 비어 있다(설정 화면 관리자 확인 단계 등 store.js를 쓰기 전 단계에서는 호출되지 않는다)

  function nameKey(name) {
    return normalizeName(name).toLowerCase();
  }

  function db() {
    return window.cvsDb;
  }

  function toItem(r) {
    return { id: r.id, name: r.name, zone: r.zone, expiresAt: r.expires_at, status: r.status, createdAt: r.created_at, doneAt: r.done_at, deletedAt: r.deleted_at };
  }

  function findActiveProductRow(name) {
    var key = nameKey(name);
    return (
      mem.productRows.filter(function (p) {
        return !p.deleted_at && nameKey(p.name) === key;
      })[0] || null
    );
  }

  function zoneInUse(zone) {
    return mem.itemRows.some(function (it) {
      return it.status === "active" && it.zone === zone;
    });
  }

  function productInUse(name) {
    var key = nameKey(name);
    return mem.itemRows.some(function (it) {
      return it.status === "active" && nameKey(it.name) === key;
    });
  }

  // 새 상품명이면 cvs_products에 먼저 추가하고, 있으면 기존 표기를 그대로 쓴다. 등록된 상품명을 Promise로 돌려준다.
  function ensureProductName(rawName) {
    var clean = normalizeName(rawName);
    var existing = findActiveProductRow(clean);
    if (existing) {
      return Promise.resolve(existing.name);
    }
    return db()
      .request("POST", "/rest/v1/cvs_products", [{ name: clean, barcode: "" }], { Prefer: "return=representation" })
      .then(function (rows) {
        mem.productRows.push(rows[0]);
        return rows[0].name;
      });
  }

  return {
    hydrate: function (data) {
      mem = { zoneRows: data.zones.slice(), productRows: data.products.slice(), itemRows: data.items.slice() };
    },

    listItems: function () {
      return mem.itemRows.map(toItem);
    },
    // 등록된 상품명(가나다순, 중복 제거). 자동완성 후보
    listProducts: function () {
      var seen = {};
      var names = [];
      mem.productRows.forEach(function (p) {
        if (p.deleted_at) {
          return;
        }
        var key = nameKey(p.name);
        if (!seen[key]) {
          seen[key] = true;
          names.push(p.name);
        }
      });
      return names.sort(function (a, b) {
        return a.localeCompare(b, "ko");
      });
    },
    // 설정 화면용: {name, barcode} 전체(가나다순)
    listProductRecords: function () {
      return mem.productRows
        .filter(function (p) {
          return !p.deleted_at;
        })
        .map(function (p) {
          return { name: p.name, barcode: p.barcode };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, "ko");
        });
    },
    // 구역 목록(추가한 순서)
    listZones: function () {
      return mem.zoneRows
        .filter(function (z) {
          return !z.deleted_at;
        })
        .map(function (z) {
          return z.name;
        });
    },
    // 중복 확인: 처리 전(active) 건 중 같은 상품(공백·대소문자 무시)·같은 유통기한(시각 자체, 문자열 표기 차이는 무시)이 있으면 그 건을 돌려준다.
    findDuplicate: function (name, expiresAt, excludeId) {
      var key = nameKey(name);
      var ms = expiresAt.getTime();
      return (
        mem.itemRows
          .map(toItem)
          .filter(function (x) {
            return x.status === "active" && x.id !== excludeId && nameKey(x.name) === key && new Date(x.expiresAt).getTime() === ms;
          })[0] || null
      );
    },

    // ---- 쓰기(전부 Promise) ----
    addItem: function (input) {
      return ensureProductName(input.name).then(function (name) {
        var row = { name: name, zone: input.zone, expires_at: input.expiresAt.toISOString(), status: "active" };
        return db()
          .request("POST", "/rest/v1/cvs_items", [row], { Prefer: "return=representation" })
          .then(function (rows) {
            mem.itemRows.push(rows[0]);
            return toItem(rows[0]);
          });
      });
    },
    // patch: { name?, zone?, expiresAt? }
    updateItem: function (id, patch) {
      var namePromise = patch.name && normalizeName(patch.name) ? ensureProductName(patch.name) : Promise.resolve(null);
      return namePromise.then(function (name) {
        var body = {};
        if (name) {
          body.name = name;
        }
        if (patch.expiresAt) {
          body.expires_at = patch.expiresAt.toISOString();
        }
        if (patch.zone) {
          body.zone = patch.zone;
        }
        return db()
          .request("PATCH", "/rest/v1/cvs_items?id=eq." + encodeURIComponent(id), body, { Prefer: "return=representation" })
          .then(function (rows) {
            if (!rows[0]) {
              return;
            }
            var idx = mem.itemRows.findIndex(function (x) {
              return x.id === id;
            });
            if (idx >= 0) {
              mem.itemRows[idx] = rows[0];
            }
          });
      });
    },
    setStatus: function (id, status) {
      var now = new Date().toISOString();
      var body = { status: status, done_at: status === "done" ? now : null, deleted_at: status === "trash" ? now : null };
      return db()
        .request("PATCH", "/rest/v1/cvs_items?id=eq." + encodeURIComponent(id), body, { Prefer: "return=representation" })
        .then(function (rows) {
          if (!rows[0]) {
            return;
          }
          var idx = mem.itemRows.findIndex(function (x) {
            return x.id === id;
          });
          if (idx >= 0) {
            mem.itemRows[idx] = rows[0];
          }
        });
    },
    // 보관함(trash)에서 유통기한이 이미 지난 건은 화면에서 완전 삭제로 접어 보여준다(서버 쪽 자동 처리는 2단계 다음 작업).
    purgeExpiredTrash: function (now) {
      var n = 0;
      mem.itemRows.forEach(function (it) {
        if (it.status === "trash" && new Date(it.expires_at) <= now) {
          it.status = "purged";
          n++;
        }
      });
      return n;
    },

    // ---- 구역 관리(설정 화면) ----
    addZone: function (name) {
      var clean = normalizeName(name);
      if (!clean) {
        return Promise.resolve({ ok: false, reason: "구역 이름을 입력하세요." });
      }
      if (
        mem.zoneRows.some(function (z) {
          return !z.deleted_at && z.name === clean;
        })
      ) {
        return Promise.resolve({ ok: false, reason: "이미 있는 구역입니다." });
      }
      return db()
        .request("POST", "/rest/v1/cvs_zones", [{ name: clean }], { Prefer: "return=representation" })
        .then(function (rows) {
          mem.zoneRows.push(rows[0]);
          return { ok: true };
        })
        .catch(function (e) {
          return { ok: false, reason: e.message };
        });
    },
    deleteZone: function (zone) {
      if (zoneInUse(zone)) {
        return Promise.resolve({ ok: false, reason: "아직 처리하지 않은 건이 이 구역을 쓰고 있어 삭제할 수 없습니다. 먼저 처리완료하거나 다른 구역으로 옮겨 주세요." });
      }
      var row = mem.zoneRows.filter(function (z) {
        return !z.deleted_at && z.name === zone;
      })[0];
      if (!row) {
        return Promise.resolve({ ok: false, reason: "이미 삭제된 구역입니다." });
      }
      var now = new Date().toISOString();
      return db()
        .request("PATCH", "/rest/v1/cvs_zones?id=eq." + encodeURIComponent(row.id), { deleted_at: now }, { Prefer: "return=representation" })
        .then(function (rows) {
          row.deleted_at = rows[0].deleted_at;
          return { ok: true };
        });
    },
    listDeletedZones: function () {
      return mem.zoneRows
        .filter(function (z) {
          return z.deleted_at;
        })
        .map(function (z) {
          return { zone: z.name, deletedAt: z.deleted_at };
        });
    },
    restoreZone: function (zone) {
      if (
        mem.zoneRows.some(function (z) {
          return !z.deleted_at && z.name === zone;
        })
      ) {
        return Promise.resolve({ ok: false, reason: "이미 있는 구역입니다." });
      }
      var row = mem.zoneRows.filter(function (z) {
        return z.deleted_at && z.name === zone;
      })[0];
      if (!row) {
        return Promise.resolve({ ok: false });
      }
      return db()
        .request("PATCH", "/rest/v1/cvs_zones?id=eq." + encodeURIComponent(row.id), { deleted_at: null }, { Prefer: "return=representation" })
        .then(function (rows) {
          row.deleted_at = rows[0].deleted_at;
          return { ok: true };
        });
    },
    purgeZone: function (zone) {
      var row = mem.zoneRows.filter(function (z) {
        return z.deleted_at && z.name === zone;
      })[0];
      if (!row) {
        return Promise.resolve();
      }
      return db()
        .request("DELETE", "/rest/v1/cvs_zones?id=eq." + encodeURIComponent(row.id), undefined, { Prefer: "return=minimal" })
        .then(function () {
          mem.zoneRows.splice(mem.zoneRows.indexOf(row), 1);
        });
    },

    // ---- 상품 관리(설정 화면) ----
    addProduct: function (name, barcode) {
      var clean = normalizeName(name);
      if (!clean) {
        return Promise.resolve({ ok: false, reason: "상품명을 입력하세요." });
      }
      if (findActiveProductRow(clean)) {
        return Promise.resolve({ ok: false, reason: "이미 있는 상품입니다." });
      }
      return db()
        .request("POST", "/rest/v1/cvs_products", [{ name: clean, barcode: normalizeName(barcode || "") }], { Prefer: "return=representation" })
        .then(function (rows) {
          mem.productRows.push(rows[0]);
          return { ok: true };
        })
        .catch(function (e) {
          return { ok: false, reason: e.message };
        });
    },
    deleteProduct: function (name) {
      if (productInUse(name)) {
        return Promise.resolve({ ok: false, reason: "아직 처리하지 않은 건이 이 상품을 쓰고 있어 삭제할 수 없습니다. 먼저 처리완료한 뒤 삭제해 주세요." });
      }
      var row = findActiveProductRow(name);
      if (!row) {
        return Promise.resolve({ ok: false, reason: "이미 삭제된 상품입니다." });
      }
      var now = new Date().toISOString();
      return db()
        .request("PATCH", "/rest/v1/cvs_products?id=eq." + encodeURIComponent(row.id), { deleted_at: now }, { Prefer: "return=representation" })
        .then(function (rows) {
          row.deleted_at = rows[0].deleted_at;
          return { ok: true };
        });
    },
    listDeletedProducts: function () {
      return mem.productRows
        .filter(function (p) {
          return p.deleted_at;
        })
        .map(function (p) {
          return { product: { name: p.name, barcode: p.barcode }, deletedAt: p.deleted_at };
        });
    },
    restoreProduct: function (name) {
      if (findActiveProductRow(name)) {
        return Promise.resolve({ ok: false, reason: "이미 있는 상품입니다." });
      }
      var key = nameKey(name);
      var row = mem.productRows.filter(function (p) {
        return p.deleted_at && nameKey(p.name) === key;
      })[0];
      if (!row) {
        return Promise.resolve({ ok: false });
      }
      return db()
        .request("PATCH", "/rest/v1/cvs_products?id=eq." + encodeURIComponent(row.id), { deleted_at: null }, { Prefer: "return=representation" })
        .then(function (rows) {
          row.deleted_at = rows[0].deleted_at;
          return { ok: true };
        });
    },
    purgeProduct: function (name) {
      var key = nameKey(name);
      var row = mem.productRows.filter(function (p) {
        return p.deleted_at && nameKey(p.name) === key;
      })[0];
      if (!row) {
        return Promise.resolve();
      }
      return db()
        .request("DELETE", "/rest/v1/cvs_products?id=eq." + encodeURIComponent(row.id), undefined, { Prefer: "return=minimal" })
        .then(function () {
          mem.productRows.splice(mem.productRows.indexOf(row), 1);
        });
    },
  };
})();
