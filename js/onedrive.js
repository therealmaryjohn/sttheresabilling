// OneDrive connection using Microsoft sign-in (MSAL) + Microsoft Graph.
// No passwords or secrets are stored in this code.
(function () {
  const cfg = window.APP_CONFIG || {};
  const SCOPES = ["User.Read", "Files.ReadWrite"];
  const GRAPH = "https://graph.microsoft.com/v1.0";
  let msal = null;
  let account = null;

  const enabled = () => !!(cfg.clientId && window.msal);

  async function init() {
    if (!enabled()) return null;
    msal = new window.msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: cfg.authority,
        redirectUri: window.location.origin + window.location.pathname
      },
      cache: { cacheLocation: "localStorage" }
    });
    const result = await msal.handleRedirectPromise().catch(e => { console.error(e); return null; });
    if (result && result.account) account = result.account;
    if (!account) account = msal.getAllAccounts()[0] || null;
    return account;
  }

  // Redirect sign-in works on both phone and computer (popups are often blocked on mobile)
  function signIn() {
    if (!enabled()) throw new Error("OneDrive is not configured yet. Add the clientId in js/config.js.");
    return msal.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
  }

  function signOut() {
    if (!msal || !account) return;
    return msal.logoutRedirect({ account });
  }

  async function token() {
    if (!account) throw new Error("Not signed in");
    try {
      const r = await msal.acquireTokenSilent({ scopes: SCOPES, account });
      return r.accessToken;
    } catch (e) {
      await msal.acquireTokenRedirect({ scopes: SCOPES, account });
      throw e;
    }
  }

  const enc = path => path.split("/").map(encodeURIComponent).join("/");

  async function graph(url, opts = {}) {
    const t = await token();
    const res = await fetch(GRAPH + url, {
      ...opts,
      headers: { Authorization: "Bearer " + t, ...(opts.headers || {}) }
    });
    return res;
  }

  /** Read a JSON file from OneDrive. Returns null if it does not exist yet. */
  async function readJson(path) {
    const res = await graph(`/me/drive/root:/${enc(path)}:/content`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("OneDrive read failed (" + res.status + ")");
    return res.json();
  }

  /** Upload (create or replace) a file. Files under 4 MB - invoices are ~100-300 KB. */
  async function upload(path, data, contentType) {
    const res = await graph(`/me/drive/root:/${enc(path)}:/content`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: data
    });
    if (!res.ok) throw new Error("OneDrive upload failed (" + res.status + ")");
    return res.json(); // contains webUrl and id
  }

  const writeJson = (path, obj) => upload(path, JSON.stringify(obj, null, 2), "application/json");

  window.OneDrive = {
    enabled, init, signIn, signOut, readJson, writeJson, upload,
    isSignedIn: () => !!account,
    userName: () => (account && (account.name || account.username)) || ""
  };
})();
