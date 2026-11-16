/* bq-crypto.js - BOTTY QUANTER.grok client-side decryption (StatiCrypt-style). ANALYSIS ONLY, never places orders.
   data/latest.enc.json = AES-256-GCM ciphertext; key = PBKDF2-SHA256(password, salt, iter) via WebCrypto.
   Wrong password -> verifier fails to decrypt -> "bad-password". Nothing readable is published in plaintext.
   Session: the derived AES key (raw, never the password) is kept in localStorage "bq_session" for 7 days.
   Exposes window.BQ { data (latest), account, payload, unlock(pw), restore(), hasSession(), lock() } and fires
   window events "bq:data" (detail = latest) after every successful decrypt and "bq:lock" on sign-out. */
(function () {
  "use strict";
  var URL_ = window.BQ_ENC_URL || "data/latest.enc.json";
  var KEY = "bq_session", TTL = 7 * 24 * 3600 * 1000, REFRESH_MS = 60000;
  var subtle = window.crypto && window.crypto.subtle;
  var key = null, salt = null, timer = 0;
  var BQ = window.BQ = { data: null, account: null, payload: null };

  function b64d(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function b64e(buf) { var u = new Uint8Array(buf), s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function fail(code) { var e = new Error(code); e.code = code; return e; }

  function fetchDoc() {
    return fetch(URL_ + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw fail("fetch-" + r.status);
      return r.json();
    });
  }
  function derive(pw, doc) {
    return subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]).then(function (base) {
      return subtle.deriveKey({ name: "PBKDF2", hash: doc.hash || "SHA-256", salt: b64d(doc.salt), iterations: doc.iter },
        base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    });
  }
  function dec(k, part) {
    return subtle.decrypt({ name: "AES-GCM", iv: b64d(part.iv) }, k, b64d(part.ct));
  }
  function open_(k, doc) {
    return dec(k, doc.verifier).then(null, function () { throw fail("bad-password"); }).then(function () {
      return dec(k, doc.data);
    }).then(function (buf) {
      var p = JSON.parse(new TextDecoder().decode(buf));
      key = k; salt = doc.salt;
      BQ.payload = p; BQ.data = p.latest || null; BQ.account = p.account || null;
      try { window.dispatchEvent(new CustomEvent("bq:data", { detail: BQ.data })); } catch (e) { /* old browsers */ }
      if (!timer) timer = setInterval(refresh, REFRESH_MS);
      return BQ.data;
    });
  }
  function save(k) {
    return subtle.exportKey("raw", k).then(function (raw) {
      var s = JSON.stringify({ v: 2, k: b64e(raw), salt: salt, exp: Date.now() + TTL });
      try { localStorage.setItem(KEY, s); } catch (e) { try { sessionStorage.setItem(KEY, s); } catch (e2) { /* no storage */ } }
    });
  }
  function readSession() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { /* ignore */ }
    if (!s) try { s = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { /* ignore */ }
    if (!s || s.v !== 2 || !s.k || !(s.exp > Date.now())) { if (s) clear(); return null; }
    return s;
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function refresh() {
    if (!key) return;
    fetchDoc().then(function (doc) {
      if (doc.salt !== salt) throw fail("bad-password"); // password changed on the box: sign in again
      return open_(key, doc);
    }).then(null, function (e) {
      if (e && e.code === "bad-password") { BQ.lock(); location.reload(); }
      /* network errors: keep the last decrypted data */
    });
  }

  BQ.supported = !!(subtle && window.fetch && window.TextEncoder);
  BQ.hasSession = function () { return !!readSession(); };
  BQ.unlock = function (pw) {
    if (!BQ.supported) return Promise.reject(fail("unsupported"));
    return fetchDoc().then(function (doc) {
      return derive(pw, doc).then(function (k) { return open_(k, doc).then(function (d) { return save(k).then(function () { return d; }); }); });
    });
  };
  BQ.restore = function () {
    var s = readSession();
    if (!s || !BQ.supported) return Promise.reject(fail("no-session"));
    return subtle.importKey("raw", b64d(s.k), { name: "AES-GCM" }, true, ["decrypt"]).then(function (k) {
      return fetchDoc().then(function (doc) {
        if (doc.salt !== s.salt) throw fail("bad-password");
        return open_(k, doc);
      });
    }).then(null, function (e) { if (e && e.code === "bad-password") clear(); throw e; });
  };
  BQ.lock = function () {
    key = null; salt = null; BQ.data = BQ.account = BQ.payload = null;
    if (timer) { clearInterval(timer); timer = 0; }
    clear();
    try { window.dispatchEvent(new CustomEvent("bq:lock")); } catch (e) { /* ignore */ }
  };
})();
