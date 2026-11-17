// 공통 부팅: 로그인 확인(지점은 계정이 정함) → cvs_zones·cvs_products·cvs_items를 읽어 cvsStore에 채움 → 화면 스크립트 실행.
// 각 HTML은 shell.js 다음에 이 파일 한 줄만 두고, 실행할 스크립트 목록을 data-scripts에 적는다(순서대로 실행, store.js가 오면 방금 읽은 DB 값을 채운다).
// 접속 키는 공개해도 되는 publishable 키뿐이다 — 실제 접근은 로그인 + DB 잠금(RLS, 자기 지점만)이 막는다. 비밀번호는 로그에 남기지 않는다.
// ARTECAFE(webapp/shared/boot.js)와 같은 구조 — 같은 asset-app 프로젝트를 쓰므로 로그인·토큰 처리 방식을 그대로 가져왔다.
(function () {
  var SUPABASE_URL = "https://omqnuhrshddkoarbiiei.supabase.co";
  var PUBLISHABLE_KEY = "sb_publishable_xBcS0_fg1WGzDwn8JUNgew_p5GK40oc";
  var SESSION_KEY = "cvs_session"; // ARTECAFE(cafe_session)와 같은 브라우저를 써도 로그인 상태가 섞이지 않도록 키를 다르게 둔다
  var PAGE = 1000;

  var bootTag = document.currentScript;
  var scriptList = (bootTag.getAttribute("data-scripts") || "")
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var token = null;

  // ---------- 화면 보조 ----------
  var style = document.createElement("style");
  style.textContent =
    ".boot-card{max-width:360px;margin:64px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#fff}" +
    ".boot-card h1{margin:0 0 16px;font-size:16px}" +
    ".boot-card label{display:block;margin:12px 0 4px;font-size:13px}" +
    ".boot-card input{width:100%;box-sizing:border-box;min-height:44px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}" +
    ".boot-card button{width:100%;min-height:44px;margin-top:16px;border:0;border-radius:8px;background:var(--shell-accent,#0d9488);color:#fff;font:inherit;cursor:pointer}" +
    ".boot-card button:disabled{opacity:.6;cursor:default}" +
    ".boot-msg{margin-top:12px;font-size:13px;color:#b91c1c;min-height:18px}" +
    ".boot-info{max-width:360px;margin:64px auto;text-align:center;font-size:13px;color:#475569}" +
    ".boot-status{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:90vw;padding:10px 14px;border-radius:8px;font-size:13px;background:#0f172a;color:#fff;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.2)}" +
    ".boot-status.ok{background:#0d9488}.boot-status.error{background:#b91c1c}" +
    ".boot-logout{display:block;margin:24px auto;padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font:inherit;cursor:pointer}";
  document.head.appendChild(style);

  function appEl() {
    var el = document.getElementById("app");
    if (!el) {
      el = document.createElement("div");
      el.id = "app";
      document.body.insertBefore(el, document.body.firstChild);
    }
    return el;
  }

  function showInfo(text) {
    appEl().innerHTML = '<div class="boot-info"></div>';
    appEl().firstChild.textContent = text;
  }

  // ---------- 로그인 상태 ----------
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function saveSession(s) {
    try {
      if (s) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      // 저장소를 못 쓰는 환경(사생활 보호 창 등)에서는 이 화면에서만 로그인이 유지된다
    }
  }

  function authCall(path, body) {
    return fetch(SUPABASE_URL + path, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (json) {
        return { ok: res.ok, status: res.status, json: json };
      });
    });
  }

  function toSession(json) {
    return { access_token: json.access_token, refresh_token: json.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (json.expires_in || 3600) };
  }

  function restoreToken() {
    var s = loadSession();
    if (!s || !s.refresh_token) {
      return Promise.resolve(null);
    }
    if (s.expires_at - 60 > Date.now() / 1000) {
      return Promise.resolve(s.access_token);
    }
    return authCall("/auth/v1/token?grant_type=refresh_token", { refresh_token: s.refresh_token }).then(function (r) {
      if (!r.ok) {
        saveSession(null);
        return null;
      }
      saveSession(toSession(r.json));
      return r.json.access_token;
    });
  }

  function showLogin(message) {
    return new Promise(function (resolve) {
      appEl().innerHTML =
        '<form class="boot-card" id="boot-form">' +
        "<h1>편의점 유통기한 관리</h1>" +
        '<label for="boot-email">이메일</label><input id="boot-email" type="email" autocomplete="username" required />' +
        '<label for="boot-pw">비밀번호</label><input id="boot-pw" type="password" autocomplete="current-password" required />' +
        '<button type="submit">로그인</button><div class="boot-msg" id="boot-msg"></div></form>';
      var msg = document.getElementById("boot-msg");
      msg.textContent = message || "";
      document.getElementById("boot-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var btn = e.target.querySelector("button");
        btn.disabled = true;
        msg.textContent = "";
        authCall("/auth/v1/token?grant_type=password", {
          email: document.getElementById("boot-email").value.trim(),
          password: document.getElementById("boot-pw").value,
        })
          .then(function (r) {
            if (!r.ok) {
              msg.textContent = r.status === 400 || r.status === 401 ? "이메일 또는 비밀번호가 맞지 않습니다." : "로그인에 실패했습니다(응답 " + r.status + "). 잠시 후 다시 시도해 주세요.";
              btn.disabled = false;
              return;
            }
            saveSession(toSession(r.json));
            resolve(r.json.access_token);
          })
          .catch(function () {
            msg.textContent = "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
            btn.disabled = false;
          });
      });
    });
  }

  window.cvsLogout = function () {
    saveSession(null);
    location.reload();
  };

  // ---------- DB 읽기/쓰기 공통 (store.js가 이 두 함수로 실제 통신한다) ----------
  function freshToken() {
    var s = loadSession();
    if (s && s.expires_at - 60 > Date.now() / 1000) {
      return Promise.resolve(s.access_token);
    }
    return restoreToken().then(function (t) {
      if (!t) {
        throw new Error("AUTH");
      }
      token = t;
      return t;
    });
  }

  function errorText(e) {
    if (e && e.message === "AUTH") {
      return "로그인이 만료되었습니다. 새로고침해서 다시 로그인해 주세요.";
    }
    if (e instanceof TypeError) {
      return "서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.";
    }
    return (e && e.message) || String(e);
  }

  // method/path/body: REST 호출 그대로. extra: 추가 헤더(Prefer 등). 성공하면 응답 JSON(배열)을, 실패하면 사람이 읽을 메시지가 담긴 Error를 던진다.
  function request(method, path, body, extra) {
    return freshToken()
      .then(function (t) {
        var headers = { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + t, "Content-Type": "application/json" };
        Object.keys(extra || {}).forEach(function (k) {
          headers[k] = extra[k];
        });
        return fetch(SUPABASE_URL + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) });
      })
      .then(function (res) {
        if (res.status === 401) {
          throw new Error("AUTH");
        }
        if (!res.ok) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (j) {
              throw new Error(j.message || "저장하지 못했습니다(응답 " + res.status + ")");
            });
        }
        if (res.status === 204) {
          return [];
        }
        return res.json();
      })
      .catch(function (e) {
        throw new Error(errorText(e));
      });
  }

  function rpc(name, body) {
    return request("POST", "/rest/v1/rpc/" + name, body || {});
  }

  window.cvsDb = { request: request, rpc: rpc };

  function fetchAll(table, order) {
    var rows = [];
    function next(offset) {
      return freshToken().then(function (t) {
        return fetch(SUPABASE_URL + "/rest/v1/" + table + "?select=*&order=" + order, {
          headers: { apikey: PUBLISHABLE_KEY, Authorization: "Bearer " + t, "Range-Unit": "items", Range: offset + "-" + (offset + PAGE - 1) },
        }).then(function (res) {
          if (res.status === 401) {
            throw new Error("AUTH");
          }
          if (!res.ok && res.status !== 206) {
            throw new Error(table + " 읽기 실패(응답 " + res.status + ")");
          }
          return res.json().then(function (part) {
            rows = rows.concat(part);
            return part.length < PAGE ? rows : next(offset + PAGE);
          });
        });
      });
    }
    return next(0);
  }

  function loadAll() {
    return Promise.all([fetchAll("cvs_zones", "created_at"), fetchAll("cvs_products", "name"), fetchAll("cvs_items", "created_at")]).then(function (r) {
      return { zones: r[0], products: r[1], items: r[2] };
    });
  }

  // ---------- 화면 스크립트 순서대로 실행 ----------
  var assetVersion = (bootTag.getAttribute("src").match(/[?&]v=([^&]+)/) || [])[1] || "";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = assetVersion ? src + "?v=" + assetVersion : src;
      el.async = false;
      el.onload = resolve;
      el.onerror = function () {
        reject(new Error(src + " 파일을 불러오지 못했습니다."));
      };
      document.body.appendChild(el);
    });
  }

  function runScripts(data) {
    appEl().innerHTML = "";
    return scriptList
      .reduce(function (chain, src) {
        return chain.then(function () {
          return loadScript(src).then(function () {
            if (src === "store.js") {
              cvsStore.hydrate(data); // 방금 읽은 DB 값을 목업 대신 채운다
            }
          });
        });
      }, Promise.resolve())
      .then(function () {
        document.dispatchEvent(new Event("DOMContentLoaded"));
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "boot-logout";
        btn.textContent = "로그아웃";
        btn.addEventListener("click", window.cvsLogout);
        document.body.appendChild(btn);
      });
  }

  // ---------- 관리자 비밀번호(설정 화면 전용, data-admin="1") ----------
  var needAdmin = bootTag.getAttribute("data-admin") === "1";

  var adminPwMemory = null;
  function adminPw() {
    try {
      return sessionStorage.getItem("cvs_admin_pw") || adminPwMemory;
    } catch (e) {
      return adminPwMemory;
    }
  }
  function adminUnlocked() {
    return !!adminPw();
  }

  function adminGate() {
    if (adminUnlocked()) {
      return Promise.resolve();
    }
    return rpc("cvs_admin_status").then(function (isSet) {
      return new Promise(function (resolve) {
        appEl().innerHTML =
          '<form class="boot-card" id="boot-admin">' +
          "<h1>" + (isSet ? "관리자 확인" : "관리자 비밀번호 설정") + "</h1>" +
          '<div style="font-size:13px;color:#475569">' +
          (isSet ? "설정 화면은 관리자만 열 수 있습니다." : "처음 한 번 관리자 비밀번호를 정해 주세요(4자 이상). 이후 설정 화면은 이 비밀번호로만 열립니다.") +
          "</div>" +
          '<label for="boot-apw">' + (isSet ? "관리자 비밀번호" : "새 비밀번호") + '</label><input id="boot-apw" type="password" autocomplete="off" required />' +
          (isSet ? "" : '<label for="boot-apw2">새 비밀번호 확인</label><input id="boot-apw2" type="password" autocomplete="off" required />') +
          '<button type="submit">' + (isSet ? "확인" : "설정") + '</button><div class="boot-msg" id="boot-amsg"></div>' +
          '<a href="register.html" style="display:block;margin-top:12px;text-align:center;font-size:13px">← 유통기한등록으로</a></form>';
        var msg = document.getElementById("boot-amsg");
        document.getElementById("boot-admin").addEventListener("submit", function (e) {
          e.preventDefault();
          var btn = e.target.querySelector("button");
          var pw = document.getElementById("boot-apw").value;
          if (!isSet) {
            if (pw.length < 4) {
              msg.textContent = "비밀번호는 4자 이상으로 정해 주세요.";
              return;
            }
            if (pw !== document.getElementById("boot-apw2").value) {
              msg.textContent = "두 비밀번호가 서로 다릅니다.";
              return;
            }
          }
          btn.disabled = true;
          msg.textContent = "";
          (isSet ? rpc("cvs_admin_check", { p_pw: pw }) : rpc("cvs_admin_set", { p_new: pw }))
            .then(function (ok) {
              if (!ok) {
                msg.textContent = isSet ? "관리자 비밀번호가 맞지 않습니다." : "비밀번호를 설정하지 못했습니다.";
                btn.disabled = false;
                return;
              }
              adminPwMemory = pw;
              try {
                sessionStorage.setItem("cvs_admin_pw", pw);
              } catch (err) {
                // 저장소를 못 쓰면 이 화면을 열어 둔 동안만 풀린 상태가 된다
              }
              resolve();
            })
            .catch(function (err) {
              msg.textContent = err && err.message === "AUTH" ? "로그인이 만료되었습니다. 새로고침해 주세요." : "서버에 연결하지 못했습니다.";
              btn.disabled = false;
            });
        });
      });
    });
  }

  function start(msg) {
    var ready = token ? Promise.resolve(token) : restoreToken().then(function (t) {
      return t || showLogin(msg);
    });
    ready
      .then(function (t) {
        token = t;
        return needAdmin ? adminGate() : null;
      })
      .then(function () {
        showInfo("데이터를 불러오는 중입니다…");
        return loadAll();
      })
      .then(runScripts)
      .catch(function (e) {
        if (e && e.message === "AUTH") {
          saveSession(null);
          token = null;
          start("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        } else {
          showInfo("불러오지 못했습니다: " + (e && e.message ? e.message : e));
        }
      });
  }

  start();
})();
