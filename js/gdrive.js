// Google Drive connection (Google Identity Services + Drive API v3).
// Uses the "drive.file" permission: the app can ONLY see files it created itself,
// not the rest of your Google Drive. No password or secret is stored in this code.
(function () {
  const cfg = window.APP_CONFIG || {};
  const SCOPE = "https://www.googleapis.com/auth/drive.file";
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
  const LS_TOK = "gd_token", LS_CON = "gd_connected", LS_USER = "gd_user";
  const FOLDER = "application/vnd.google-apps.folder";
  let client = null, tok = null;
  const folderCache = {};

  const gisReady = () => !!(window.google && google.accounts && google.accounts.oauth2);
  const enabled = () => !!(cfg.googleClientId && gisReady());
  const isConnected = () => localStorage.getItem(LS_CON) === "1";
  const hasToken = () => !!(tok && tok.exp > Date.now() + 60000);

  async function init() {
    for (let i = 0; i < 60 && !gisReady(); i++) await new Promise(r => setTimeout(r, 100));
    try { tok = JSON.parse(localStorage.getItem(LS_TOK)); } catch { tok = null; }
    if (!enabled()) return false;
    client = google.accounts.oauth2.initTokenClient({ client_id: cfg.googleClientId, scope: SCOPE, callback: () => {} });
    return isConnected();
  }

  /** Get a valid access token. When a new one is needed, Google shows a small sign-in window,
   *  so this must be called straight from a button tap (before any other await). */
  function ensureToken() {
    if (hasToken()) return Promise.resolve(tok.value);
    if (!client) return Promise.reject(new Error("Google Drive is not set up yet. Add googleClientId in js/config.js."));
    return new Promise((resolve, reject) => {
      client.callback = r => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        if (!google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) return reject(new Error("Please tick the Google Drive permission and try again"));
        tok = { value: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 };
        localStorage.setItem(LS_TOK, JSON.stringify(tok));
        localStorage.setItem(LS_CON, "1");
        resolve(tok.value);
      };
      client.error_callback = e => reject(new Error(e && e.type === "popup_closed"
        ? "Google sign-in window was closed"
        : "Google sign-in was blocked. Allow pop-ups for this site and try again."));
      const opts = { prompt: isConnected() ? "" : "consent" };
      const hint = localStorage.getItem(LS_USER);
      if (hint) opts.login_hint = hint;
      client.requestAccessToken(opts);
    });
  }

  async function api(url, opts = {}) {
    if (!hasToken()) { const e = new Error("Google sign-in expired - tap Sync"); e.needAuth = true; throw e; }
    const res = await fetch(url, { ...opts, headers: { Authorization: "Bearer " + tok.value, ...(opts.headers || {}) } });
    if (res.status === 401) {
      tok = null; localStorage.removeItem(LS_TOK);
      const e = new Error("Google sign-in expired - tap Sync"); e.needAuth = true; throw e;
    }
    if (!res.ok) throw new Error("Google Drive error " + res.status + ": " + (await res.text()).slice(0, 200));
    return res;
  }

  const q = s => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  async function findChild(parent, name, isFolder) {
    const query = `name='${q(name)}' and '${parent}' in parents and trashed=false and mimeType${isFolder ? "=" : "!="}'${FOLDER}'`;
    const res = await api(`${API}/files?q=${encodeURIComponent(query)}&fields=files(id,webViewLink)&spaces=drive&pageSize=1`);
    return (await res.json()).files[0] || null;
  }

  /** "A/B/C" -> id of folder C, creating folders that don't exist yet */
  async function folderId(parts) {
    let parent = "root", key = "";
    for (const name of parts) {
      key += "/" + name;
      if (!folderCache[key]) {
        let f = await findChild(parent, name, true);
        if (!f) {
          const res = await api(`${API}/files?fields=id`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] })
          });
          f = await res.json();
        }
        folderCache[key] = f.id;
      }
      parent = folderCache[key];
    }
    return parent;
  }

  /** Make sure a folder exists and return its Google Drive web link. */
  async function folderLink(path) {
    const id = await folderId(path.split("/").filter(Boolean));
    return "https://drive.google.com/drive/folders/" + id;
  }

  const split = path => { const p = path.split("/").filter(Boolean); return { dirs: p.slice(0, -1), name: p[p.length - 1] }; };

  /** Read a JSON file. Returns null if it doesn't exist yet. */
  async function readJson(path) {
    const { dirs, name } = split(path);
    const f = await findChild(await folderId(dirs), name, false);
    if (!f) return null;
    return (await api(`${API}/files/${f.id}?alt=media`)).json();
  }

  /** Create the file, or replace it if a file with the same name is already in that folder. */
  async function upload(path, data, type) {
    const { dirs, name } = split(path);
    const parent = await folderId(dirs);
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const existing = await findChild(parent, name, false);
    let res;
    if (existing) {
      res = await api(`${UPLOAD}/files/${existing.id}?uploadType=media&fields=id,webViewLink`, {
        method: "PATCH", headers: { "Content-Type": type }, body: blob
      });
    } else {
      const b = "stt" + Date.now();
      const body = new Blob([
        `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n`,
        `--${b}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${b}--`
      ]);
      res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`, {
        method: "POST", headers: { "Content-Type": "multipart/related; boundary=" + b }, body
      });
    }
    const j = await res.json();
    return { id: j.id, webUrl: j.webViewLink };
  }

  const writeJson = (path, obj) => upload(path, JSON.stringify(obj, null, 2), "application/json");

  async function fetchUser() {
    try {
      const u = (await (await api(`${API}/about?fields=user(emailAddress,displayName)`)).json()).user;
      if (u && u.emailAddress) localStorage.setItem(LS_USER, u.emailAddress);
    } catch (e) { console.warn(e); }
  }

  function signOut() {
    if (tok && gisReady()) google.accounts.oauth2.revoke(tok.value, () => {});
    tok = null;
    [LS_TOK, LS_CON, LS_USER].forEach(k => localStorage.removeItem(k));
    Object.keys(folderCache).forEach(k => delete folderCache[k]);
  }

  window.Cloud = {
    enabled, init, ensureToken, hasToken, isConnected, readJson, writeJson, upload, folderLink, fetchUser, signOut,
    userName: () => localStorage.getItem(LS_USER) || ""
  };
})();
