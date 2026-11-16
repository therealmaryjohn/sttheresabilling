// ST. THERESA Billing - main application
(function () {
  const B = window.Billing, OD = window.Cloud, CFG = window.APP_CONFIG || {};
  const LS_KEY = "stt_billing_data_v1", LS_DRAFT = "stt_billing_draft_v1", LS_PENDING = "stt_billing_pending";
  const DATA_FILE = () => `${CFG.driveFolder}/Data/billing-data.json`;
  const EWAY_URL = CFG.ewayUrl || "https://ewaybillgst.gov.in/Login.aspx";
  const GST_RATES = [0, 3, 5, 12, 18, 28, 40];
  const A4_W = 794, A4_H = 1122;     // A4 in CSS pixels (96 dpi)

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const dmy = iso => iso ? iso.split("-").reverse().join("-") : "";
  const norm = s => String(s || "").trim().toLowerCase();
  const ewbFmt = n => String(n || "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

  // ================= DATA =================
  let db = null;

  function freshData() {
    const s = window.SEED_DATA;
    return {
      version: 1, updatedAt: "",   // empty: data already in Google Drive always wins over starter data
      settings: JSON.parse(JSON.stringify(s.settings)),
      customers: s.customers.map(c => ({ id: uid(), ...c })),
      products: s.products.map(([name, hsn, rate, gst]) => ({ id: uid(), code: "", name, hsn, rate, gst: gst || 5, taxIncluded: false, active: true })),
      invoices: []
    };
  }
  function loadLocal() {
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch { db = null; }
    if (!db || !db.settings) { db = freshData(); saveLocal(); }
  }
  function saveLocal() { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  function markPending() { localStorage.setItem(LS_PENDING, "1"); setSync(false, "Not synced · tap Sync"); }

  async function persist() {
    db.updatedAt = new Date().toISOString();
    saveLocal();
    if (!OD.isConnected()) return;
    if (!OD.hasToken()) { markPending(); return; }
    try { await OD.writeJson(DATA_FILE(), db); localStorage.removeItem(LS_PENDING); setSync(true); }
    catch (e) { console.error(e); markPending(); toast("Saved on this device. Tap Sync to save to Google Drive.", true); }
  }

  // Bills from BOTH devices are always kept; customers/products/settings come from the newer copy.
  function merge(local, remote) {
    const newer = (local.updatedAt || "") > (remote.updatedAt || "") ? local : remote;
    const deleted = { ...(remote.deleted || {}), ...(local.deleted || {}) };   // id -> number, deleted on any device
    const map = new Map();
    [...(remote.invoices || []), ...(local.invoices || [])].forEach(i => {
      if (deleted[i.id]) return;
      const e = map.get(i.id);
      if (!e) { map.set(i.id, i); return; }
      // the most recently edited copy of the bill wins
      const [older, latest] = (i.editedAt || "") >= (e.editedAt || "") ? [e, i] : [i, e];
      const m = { ...older, ...latest };
      i = latest; const e2 = older;
      m.webUrl = i.webUrl || e2.webUrl; m.drivePath = i.drivePath || e2.drivePath;
      const ea = e2.ewb || {}, ia = i.ewb || {};
      if (e2.ewb || i.ewb) m.ewb = { ...ea, ...ia, webUrl: ia.webUrl || ea.webUrl, drivePath: ia.drivePath || ea.drivePath, no: ia.no || ea.no };
      map.set(i.id, m);
    });
    const invoices = [...map.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.seq || 0) - (b.seq || 0));
    const settings = { ...newer.settings,
      ewayFolders: { ...((remote.settings || {}).ewayFolders || {}), ...((local.settings || {}).ewayFolders || {}) } };
    return { ...newer, settings, invoices, deleted,
      catalogVersion: Math.max(local.catalogVersion || 0, remote.catalogVersion || 0),
      oldBillsVersion: Math.max(local.oldBillsVersion || 0, remote.oldBillsVersion || 0),
      updatedAt: [local.updatedAt || "", remote.updatedAt || ""].sort()[1] };
  }

  async function pull() {
    const remote = await OD.readJson(DATA_FILE());
    const before = remote ? JSON.stringify(remote) : "";
    if (remote && remote.settings) db = merge(db, remote);
    if (!db.updatedAt) db.updatedAt = new Date().toISOString();
    applyCatalog(); applyOldBills();
    await ensureEwayFolder(B.fyOf(today()));
    saveLocal();
    if (JSON.stringify(db) !== before) await OD.writeJson(DATA_FILE(), db);
    localStorage.removeItem(LS_PENDING);
    setSync(true);
  }

  /** One-time: catalogue products P001-P060 (existing codes kept as they are). */
  function applyCatalog() {
    const ver = window.CATALOG_VERSION || 0;
    if (!window.CATALOG || (db.catalogVersion || 0) >= ver) return false;
    const replaced = new Set((window.CATALOG_REPLACES || []).map(norm));
    db.products = db.products.filter(p => p.code || !replaced.has(norm(p.name)));
    const codes = new Set(db.products.map(p => norm(p.code)).filter(Boolean));
    window.CATALOG.forEach(c => { if (!codes.has(norm(c.code))) db.products.push({ id: uid(), ...c, active: true }); });
    db.catalogVersion = ver; db.updatedAt = new Date().toISOString();
    return true;
  }

  /** Once per version: add bills made before this website, their customers and e-way bill details. */
  function applyOldBills() {
    const ver = window.OLD_BILLS_VERSION || 0;
    if (!window.OLD_BILLS || (db.oldBillsVersion || 0) >= ver) return false;
    const s = db.settings;
    (window.OLD_CUSTOMERS || []).forEach(c => {
      if (!db.customers.some(x => norm(x.name) === norm(c.name))) db.customers.push({ id: uid(), ...c });
    });
    window.OLD_BILLS.forEach(o => {
      const fy = B.fyOf(o.date);
      const number = B.invoiceNumber(s.invoicePrefix || "DC", o.seq, s.numberDigits || 4, fy);
      const id = "old-" + number.replace(/\//g, "-");
      if ((db.deleted || {})[id]) return;
      const existing = db.invoices.find(i => i.id === id || i.number === number);
      if (existing) {
        if (o.ewb && !(existing.ewb && existing.ewb.no)) existing.ewb = { ...(existing.ewb || {}), ...o.ewb };
        return;
      }
      const { lines, ...totals } = B.calcInvoice(o.items, String(o.customer.stateCode) !== String(s.business.stateCode));
      db.invoices.push({
        id, fy, seq: o.seq, number, date: o.date, customer: { ...o.customer },
        business: { ...s.business }, bank: { ...s.bank }, items: lines, totals,
        status: "active", imported: true, ewb: o.ewb ? { ...o.ewb } : undefined,
        fileName: number.replace(/\//g, "_") + ".pdf", createdAt: o.date + "T00:00:00.000Z"
      });
    });
    db.invoices.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.seq || 0) - (b.seq || 0));
    db.oldBillsVersion = ver; db.updatedAt = new Date().toISOString();
    return true;
  }

  // ================= E-WAY BILL =================
  const ewayLimit = () => Number(db.settings.ewayLimit) || 50000;
  const needsEway = inv => inv.status !== "cancelled" && inv.totals.total > ewayLimit();
  const hasEwb = inv => !!(inv.ewb && (inv.ewb.no || inv.ewb.webUrl));
  const ewayFolderUrl = fy => (db.settings.ewayFolders || {})[fy] || "";

  async function ensureEwayFolder(fy) {
    if (ewayFolderUrl(fy) || !OD.hasToken()) return ewayFolderUrl(fy);
    const url = await OD.folderLink(`${CFG.driveFolder}/E-Way Bills/${fy}`);
    db.settings.ewayFolders = { ...(db.settings.ewayFolders || {}), [fy]: url };
    return url;
  }

  function openEwbForm(inv) {
    const e = inv.ewb || {};
    openForm(`E-Way Bill · ${inv.number}`, `
      <div><label>E-Way Bill number</label><input id="wNo" inputmode="numeric" maxlength="14" value="${esc(ewbFmt(e.no))}" placeholder="12 digits"></div>
      <div><label>E-Way Bill date</label><input id="wDate" type="date" value="${esc(e.date || inv.date)}"></div>
      <div><label>Vehicle number (optional)</label><input id="wVeh" value="${esc(e.vehicle || "")}" style="text-transform:uppercase"></div>
      <div><label>Valid until (optional)</label><input id="wValid" type="date" value="${esc(e.validUntil || "")}"></div>
      <div class="full"><label>E-Way Bill PDF ${e.webUrl ? "(already attached, choose a file only to replace it)" : ""}</label>
        <input id="wFile" type="file" accept="application/pdf,.pdf"></div>
      <div class="full muted">Saved to <b>${esc(CFG.driveFolder)}/E-Way Bills/${esc(inv.fy)}</b> as <b>EWB_${esc(inv.number.replace(/\//g, "_"))}.pdf</b></div>`,
      async () => {
        const no = fv("wNo").replace(/\D/g, "");
        if (no && no.length !== 12) { toast("E-Way Bill number should be 12 digits", true); return false; }
        const file = $("#wFile").files[0];
        if (!no && !file && !e.webUrl) { toast("Enter the E-Way Bill number or choose its PDF", true); return false; }
        if (file && !OD.isConnected()) { toast("Connect Google Drive to attach the PDF", true); return false; }
        if (file) { try { await OD.ensureToken(); } catch (err) { toast(err.message, true); return false; } }
        busy(true, "Saving E-Way Bill…");
        try {
          inv.ewb = { ...e, no, date: fv("wDate"), vehicle: fv("wVeh").toUpperCase(), validUntil: fv("wValid") };
          if (file) {
            const path = `${CFG.driveFolder}/E-Way Bills/${inv.fy}/EWB_${inv.number.replace(/\//g, "_")}.pdf`;
            const item = await OD.upload(path, file, "application/pdf");
            inv.ewb.drivePath = path; inv.ewb.webUrl = item.webUrl;
          }
          await persist();
          busy(false); toast(`E-Way Bill saved for ${inv.number} ✔`);
          route();
          if (!$("#previewModal").classList.contains("hidden")) showPreview(inv, false);
        } catch (err) { busy(false); toast("Could not save: " + err.message, true); return false; }
      });
  }

  function ewayBarHtml(inv) {
    const e = inv.ewb || {};
    if (hasEwb(inv)) {
      return { cls: "done", html: `<span class="msg">✅ <b>E-Way Bill ${esc(ewbFmt(e.no) || "attached")}</b>${e.date ? " · " + dmy(e.date) : ""}${e.vehicle ? " · " + esc(e.vehicle) : ""}</span>
        ${e.webUrl ? `<a class="btn small ewbok" href="${esc(e.webUrl)}" target="_blank" rel="noopener">📄 Open E-Way Bill</a>` : ""}
        <button class="btn small" type="button" data-ewbedit="${esc(inv.id)}">${e.webUrl ? "Edit" : "📎 Attach E-Way Bill PDF"}</button>` };
    }
    return { cls: "", html: `<span class="msg">🚚 <b>E-Way Bill needed</b> for ${esc(inv.number)} (${money(inv.totals.total)}). Create it on the portal, then attach it here.</span>
      <a class="btn small eway" href="${esc(EWAY_URL)}" target="_blank" rel="noopener noreferrer">🚚 Generate E-Way Bill</a>
      <button class="btn small" type="button" data-ewbedit="${esc(inv.id)}">📎 Attach E-Way Bill</button>` };
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-ewbedit]");
    if (!b) return;
    const inv = db.invoices.find(x => x.id === b.dataset.ewbedit);
    if (inv) openEwbForm(inv);
  });

  // ================= ATTACH ORIGINAL INVOICE PDF (old bills) =================
  let attachTarget = null;
  async function startAttach(inv) {
    if (!OD.isConnected()) { toast("Connect Google Drive first", true); return; }
    try { await OD.ensureToken(); } catch (e) { toast(e.message, true); return; }
    attachTarget = inv;
    const picker = $("#pdfPicker"); picker.value = ""; picker.click();
  }
  $("#pdfPicker").addEventListener("change", async e => {
    const f = e.target.files[0], inv = attachTarget; attachTarget = null;
    if (!f || !inv) return;
    busy(true, "Uploading PDF to Google Drive…");
    try {
      inv.fileName = inv.fileName || inv.number.replace(/\//g, "_") + ".pdf";
      const path = `${CFG.driveFolder}/Invoices/${inv.fy}/${inv.fileName}`;
      const item = await OD.upload(path, f, "application/pdf");
      inv.drivePath = path; inv.webUrl = item.webUrl;
      await persist();
      busy(false); toast(`PDF attached to ${inv.number} ✔`);
      route();
      if (!$("#previewModal").classList.contains("hidden")) showPreview(inv, false);
    } catch (err) { busy(false); toast("Upload failed: " + err.message, true); }
  });

  // ================= UI HELPERS =================
  function toast(msg, err) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : "");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 4000);
  }
  function busy(on, text) { $("#busy").classList.toggle("hidden", !on); if (text) $("#busyText").textContent = text; }
  function setSync(on, text) {
    const s = $("#syncStatus");
    s.className = "sync " + (on ? "on" : "off");
    s.textContent = text || (on ? "Drive synced" : (OD.isConnected() ? "Tap Sync" : "Device only"));
  }
  const openModal = id => $("#" + id).classList.remove("hidden");
  const closeModal = id => $("#" + id).classList.add("hidden");
  document.addEventListener("click", e => { const c = e.target.closest("[data-close]"); if (c) closeModal(c.dataset.close); });

  function openForm(title, fieldsHtml, onSave) {
    $("#formTitle").textContent = title;
    $("#formBody").innerHTML = fieldsHtml;
    $("#formSave").onclick = async () => { const r = await onSave(); if (r !== false) closeModal("formModal"); };
    openModal("formModal");
    const first = $("#formBody input"); if (first) setTimeout(() => first.focus(), 50);
  }
  const fv = id => ($("#" + id).value || "").trim();

  // ================= NAVIGATION =================
  const ROUTES = [["dashboard", "🏠", "Home"], ["new", "➕", "New Bill"], ["history", "🧾", "Bills"],
    ["customers", "👥", "Customers"], ["products", "📦", "Products"], ["settings", "⚙️", "Settings"]];
  function renderNav() {
    const cur = (location.hash.slice(1) || "dashboard").split("/")[0];
    $("#deskNav").innerHTML = ROUTES.map(([k, , t]) => `<a href="#${k}" class="${k === cur ? "active" : ""}">${t}</a>`).join("");
    $("#mobileNav").innerHTML = ROUTES.filter(r => r[0] !== "settings")
      .map(([k, i, t]) => `<a href="#${k}" class="${k === cur ? "active" : ""}"><span>${i}</span>${t}</a>`).join("");
  }
  function route() {
    renderNav();
    const [page, arg] = (location.hash.slice(1) || "dashboard").split("/");
    ({ dashboard: viewDashboard, new: viewEditor, history: viewHistory, customers: viewCustomers, products: viewProducts, settings: viewSettings }[page] || viewDashboard)(arg);
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  // ================= DASHBOARD =================
  function viewDashboard() {
    const act = db.invoices.filter(i => i.status !== "cancelled");
    const t = today(), month = t.slice(0, 7), fy = B.fyOf(t);
    const sum = arr => arr.reduce((s, i) => s + i.totals.total, 0);
    const todays = act.filter(i => i.date === t), monthly = act.filter(i => i.date.startsWith(month)), fyAll = act.filter(i => i.fy === fy);
    const next = B.invoiceNumber(db.settings.invoicePrefix, B.nextSeq(db.invoices, fy, db.settings.seqStart), db.settings.numberDigits, fy);
    const missing = act.filter(i => needsEway(i) && !hasEwb(i));
    $("#view").innerHTML = `
      <div class="row"><h1>Welcome 👋</h1><span class="spacer"></span><a class="btn primary" href="#new">➕ New Bill</a></div>
      <div class="stats">
        <div class="stat"><span class="muted">Today</span><b>${money(sum(todays))}</b><small class="muted">${todays.length} bills</small></div>
        <div class="stat"><span class="muted">This month</span><b>${money(sum(monthly))}</b><small class="muted">${monthly.length} bills</small></div>
        <div class="stat"><span class="muted">FY ${fy}</span><b>${money(sum(fyAll))}</b><small class="muted">${fyAll.length} bills</small></div>
        <div class="stat"><span class="muted">Next bill no.</span><b>${esc(next)}</b></div>
      </div>
      ${missing.length ? `<div class="card" style="border-color:#f0b46a;background:#fff9ef"><b>🚚 ${missing.length} bill(s) above ${money(ewayLimit())} have no E-Way Bill:</b>
        ${missing.map(i => `<a href="#history/ewb" style="margin-left:6px">${esc(i.number)}</a>`).join(",")}</div>` : ""}
      ${!OD.isConnected() ? `<div class="card" style="border-color:#f3c98b;background:#fff9ef"><b>Google Drive not connected.</b>
        <span class="muted">${OD.enabled() ? "Tap “Connect Google Drive” at the top." : "Add googleClientId in js/config.js (see README). Until then, data is stored only on this device."}</span></div>` : ""}
      <div class="card"><h2>Recent bills</h2><div class="list">${invoiceRows(db.invoices.slice().reverse().slice(0, 8)) || '<p class="muted">No bills yet.</p>'}</div></div>`;
    bindInvoiceRows();
  }

  // ================= INVOICE EDITOR =================
  let draft = null;
  const blankItem = () => ({ key: uid(), name: "", hsn: "", qty: 1, rate: 0, gst: 5, taxIncluded: false });
  const newDraft = () => ({ customerId: "", customer: null, date: today(), items: [blankItem()] });
  const saveDraft = () => localStorage.setItem(LS_DRAFT, JSON.stringify(draft));
  const isInterState = c => !!c && String(c.stateCode || "") !== String(db.settings.business.stateCode);

  function viewEditor() {
    if (!draft) { try { draft = JSON.parse(localStorage.getItem(LS_DRAFT)); } catch { draft = null; } if (!draft) draft = newDraft(); }
    const editing = draft.editId ? db.invoices.find(i => i.id === draft.editId) : null;
    if (draft.editId && !editing) { draft = newDraft(); saveDraft(); }
    const fy = B.fyOf(draft.date);
    const nextNo = editing ? editing.number
      : B.invoiceNumber(db.settings.invoicePrefix, B.nextSeq(db.invoices, fy, db.settings.seqStart), db.settings.numberDigits, fy);
    $("#view").innerHTML = `
      <div class="row"><h1>${editing ? "Edit Bill " + esc(editing.number) : "New Bill"}</h1><span class="spacer"></span>
        ${editing ? '<button class="btn small ghost" id="btnStopEdit" type="button">✕ Stop editing</button>' : '<button class="btn small ghost" id="btnClear" type="button">Clear</button>'}</div>
      ${editing ? `<div class="eway-note" style="margin:0 0 14px">✏️ You are editing <b>${esc(editing.number)}</b>. The bill number stays the same. Saving replaces the old PDF.</div>` : ""}
      <div class="card"><div class="editor-head">
        <div>
          <label for="custInput">Customer (type to search)</label>
          <div class="row" style="flex-wrap:nowrap">
            <input id="custInput" list="custList" placeholder="Customer name" autocomplete="off" value="${esc(draft.customer ? draft.customer.name : "")}">
            <button class="btn" id="btnNewCust" type="button" title="Add new customer">＋</button>
          </div>
          <datalist id="custList">${db.customers.map(c => `<option value="${esc(c.name)}">`).join("")}</datalist>
          <div id="custCard"></div>
        </div>
        <div><label for="invDate">Invoice date</label><input type="date" id="invDate" value="${draft.date}"></div>
        <div><label>Invoice number</label><input value="${esc(nextNo)}" disabled></div>
      </div></div>
      <div class="card">
        <div class="row"><h2>Items</h2><span class="spacer"></span><label class="check"><input type="checkbox" id="allIncl"> All rates include tax</label></div>
        <div class="items-head"><div>#</div><div>Particulars</div><div>HSN</div><div>Qty</div><div>Rate</div><div>GST %</div><div style="text-align:center">Tax incl.</div><div style="text-align:right">Amount</div><div></div></div>
        <div id="items"></div>
        <datalist id="prodList">${db.products.filter(p => p.active !== false).map(p => `<option value="${esc(p.name)}">${p.code ? esc(p.code) + " · " : ""}₹${p.rate}</option>`).join("")}</datalist>
        <div class="row" style="margin-top:10px"><button class="btn" id="btnAddItem" type="button">＋ Add item</button></div>
      </div>
      <div class="card"><div id="totals" class="totals"></div><div id="words" class="words"></div><div id="ewayNote"></div></div>
      <div class="action-bar">
        <span class="total-mini" id="miniTotal"></span>
        <button class="btn" id="btnPreview" type="button">👁 Preview</button>
        <button class="btn primary" id="btnGenerate" type="button">${editing ? "✔ Save changes" : "✔ Generate & Save"}</button>
      </div>`;
    renderCustCard(); renderItems(); renderTotals();
    $("#custInput").addEventListener("change", e => {
      const c = db.customers.find(x => norm(x.name) === norm(e.target.value));
      if (c) { draft.customerId = c.id; draft.customer = { ...c }; }
      else if (e.target.value.trim()) openCustomerForm(null, e.target.value.trim(), saved => selectCustomer(saved));
      else { draft.customer = null; draft.customerId = ""; }
      renderCustCard(); renderTotals(); saveDraft();
    });
    $("#btnNewCust").onclick = () => openCustomerForm(null, "", saved => selectCustomer(saved));
    $("#invDate").onchange = e => {
      const d = e.target.value || today();
      if (editing && B.fyOf(d) !== editing.fy) { toast(`Date must stay in financial year ${editing.fy}`, true); e.target.value = draft.date; return; }
      draft.date = d; saveDraft(); viewEditor();
    };
    $("#btnAddItem").onclick = () => { draft.items.push(blankItem()); renderItems(); saveDraft(); const ins = $$("#items .f-name input"); ins[ins.length - 1].focus(); };
    $("#allIncl").onchange = e => { draft.items.forEach(i => i.taxIncluded = e.target.checked); renderItems(); renderTotals(); saveDraft(); };
    if ($("#btnClear")) $("#btnClear").onclick = () => { if (confirm("Clear this bill?")) { draft = newDraft(); saveDraft(); viewEditor(); } };
    if ($("#btnStopEdit")) $("#btnStopEdit").onclick = () => { if (confirm("Stop editing? Your changes will not be saved.")) { draft = newDraft(); saveDraft(); location.hash = "#history"; } };
    $("#btnPreview").onclick = () => { const inv = buildInvoice(false); if (inv) showPreview(inv, true); };
    $("#btnGenerate").onclick = generate;
  }

  function selectCustomer(c) {
    draft.customerId = c.id; draft.customer = { ...c }; saveDraft();
    $("#custInput").value = c.name;
    $("#custList").innerHTML = db.customers.map(x => `<option value="${esc(x.name)}">`).join("");
    renderCustCard(); renderTotals();
  }

  function renderCustCard() {
    const c = draft.customer, el = $("#custCard");
    if (!c) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="cust-card">
      <div class="row"><b>${esc(c.name)}</b><span class="tag ${isInterState(c) ? "igst" : ""}">${isInterState(c) ? "IGST (other state)" : "CGST + SGST"}</span>
      <span class="spacer"></span><button class="btn small ghost" type="button" id="btnEditCust">Edit</button></div>
      <div>${esc(c.address)}</div>
      <div class="muted">Ph: ${esc(c.phone || "-")} · GSTIN: ${esc(c.gstin || "-")} · ${esc(c.state)} (${esc(c.stateCode)})</div></div>`;
    $("#btnEditCust").onclick = () => openCustomerForm(db.customers.find(x => x.id === draft.customerId) || c, "", saved => selectCustomer(saved));
  }

  function renderItems() {
    const gstOpts = v => GST_RATES.map(r => `<option value="${r}" ${Number(v) === r ? "selected" : ""}>${r}%</option>`).join("");
    $("#items").innerHTML = draft.items.map((it, i) => `<div class="item" data-k="${it.key}">
        <div class="sl">${i + 1}</div>
        <div class="f-name"><label>Particulars</label><input data-f="name" list="prodList" value="${esc(it.name)}" placeholder="Code (P044) or product name" autocomplete="off"></div>
        <div><label>HSN</label><input data-f="hsn" value="${esc(it.hsn)}" inputmode="numeric"></div>
        <div><label>Qty</label><input data-f="qty" type="number" min="0" step="any" inputmode="decimal" value="${it.qty}"></div>
        <div><label>Rate ₹</label><input data-f="rate" type="number" min="0" step="any" inputmode="decimal" value="${it.rate}"></div>
        <div><label>GST</label><select data-f="gst">${gstOpts(it.gst)}</select></div>
        <div class="row incl"><label class="check" style="display:inline-flex"><input type="checkbox" data-f="taxIncluded" ${it.taxIncluded ? "checked" : ""}> <span class="m-only">Tax incl.</span></label></div>
        <div class="amt" data-amt>${lineAmtHtml(B.calcLine(it))}</div>
        <button class="icon-btn del" type="button" title="Remove" data-del>🗑</button>
      </div>`).join("");
    $$("#items .item").forEach(row => {
      const it = draft.items.find(x => x.key === row.dataset.k);
      $$("[data-f]", row).forEach(inp => {
        const f = inp.dataset.f;
        const ev = (f === "name" || inp.type === "checkbox" || inp.tagName === "SELECT") ? "change" : "input";
        inp.addEventListener(ev, () => {
          if (f === "taxIncluded") it.taxIncluded = inp.checked;
          else if (f === "qty" || f === "rate" || f === "gst") it[f] = Number(inp.value) || 0;
          else it[f] = inp.value;
          if (f === "name") {
            const p = db.products.find(x => norm(x.name) === norm(inp.value) || (x.code && norm(x.code) === norm(inp.value)));
            if (p) {
              Object.assign(it, { name: p.name, hsn: p.hsn, rate: p.rate, gst: p.gst, taxIncluded: !!p.taxIncluded });
              saveDraft();
              setTimeout(() => { renderItems(); renderTotals(); const q = $(`[data-k="${it.key}"] [data-f="qty"]`); if (q) q.focus(); }, 0);
              return;
            }
          }
          $("[data-amt]", row).innerHTML = lineAmtHtml(B.calcLine(it));
          renderTotals(); saveDraft();
        });
      });
      $("[data-del]", row).onclick = () => {
        draft.items = draft.items.filter(x => x !== it);
        if (!draft.items.length) draft.items.push(blankItem());
        renderItems(); renderTotals(); saveDraft();
      };
    });
  }

  function lineAmtHtml(l) {
    if (l.taxIncluded && l.gst > 0) return `${money(B.r2(l.qty * l.rate))}<small>Taxable ${money(l.taxable)} + GST</small>`;
    return `${money(l.taxable)}<small>+ GST ${l.gst}%</small>`;
  }

  function renderTotals() {
    const t = B.calcInvoice(draft.items, isInterState(draft.customer));
    const rows = [`<div><span>Taxable value</span><b>${money(t.taxable)}</b></div>`];
    t.slabs.forEach(s => rows.push(t.interState
      ? `<div><span>IGST ${s.rate}%</span><span>${money(s.igst)}</span></div>`
      : `<div><span>SGST ${s.rate / 2}%</span><span>${money(s.sgst)}</span></div><div><span>CGST ${s.rate / 2}%</span><span>${money(s.cgst)}</span></div>`));
    if (t.roundOff) rows.push(`<div><span>Round off</span><span>${t.roundOff > 0 ? "+" : ""}${t.roundOff.toFixed(2)}</span></div>`);
    rows.push(`<div class="grand"><span>TOTAL</span><span>${money(t.total)}</span></div>`);
    $("#totals").innerHTML = rows.join("");
    $("#words").textContent = t.total ? "Rupees " + B.inWords(t.total) : "";
    $("#miniTotal").textContent = money(t.total);
    $("#ewayNote").innerHTML = t.total > ewayLimit()
      ? `<div class="eway-note">🚚 <b>E-Way Bill needed</b>: this bill is above ${money(ewayLimit())}. After you generate the bill, use the <b>Generate E-Way Bill</b> button.</div>` : "";
  }

  function buildInvoice(assignNumber) {
    if (!draft.customer) { toast("Please select a customer", true); return null; }
    const totals = B.calcInvoice(draft.items, isInterState(draft.customer));
    if (!totals.lines.length) { toast("Please add at least one item with quantity", true); return null; }
    const { lines, ...tot } = totals;
    const old = draft.editId ? db.invoices.find(i => i.id === draft.editId) : null;
    if (old) {   // editing: same id, number and financial year
      return { ...old, date: draft.date, customer: { ...draft.customer },
        items: lines.map(({ key, ...l }) => l), totals: tot, status: "active",
        business: { ...db.settings.business }, bank: { ...db.settings.bank }, editedAt: new Date().toISOString() };
    }
    const fy = B.fyOf(draft.date), seq = B.nextSeq(db.invoices, fy, db.settings.seqStart);
    return {
      id: uid(), fy, seq: assignNumber ? seq : null,
      number: assignNumber ? B.invoiceNumber(db.settings.invoicePrefix, seq, db.settings.numberDigits, fy) : "(Preview)",
      date: draft.date, customer: { ...draft.customer }, business: { ...db.settings.business }, bank: { ...db.settings.bank },
      items: lines.map(({ key, ...l }) => l), totals: tot, status: "active", createdAt: new Date().toISOString()
    };
  }

  async function generate() {
    if (!buildInvoice(false)) return;
    const cloud = OD.isConnected();
    if (cloud) { try { await OD.ensureToken(); } catch (e) { toast(e.message, true); return; } }
    else if (!confirm("Google Drive is not connected.\n\nThe bill will be saved on this device only and the PDF downloaded. Continue?")) return;
    busy(true, "Creating bill…");
    try {
      if (cloud) { busy(true, "Getting latest from Google Drive…"); await pull(); }
      const editing = !!draft.editId;
      if (editing && !db.invoices.some(i => i.id === draft.editId)) throw new Error("This bill was deleted on another device");
      const inv = buildInvoice(true);
      if (editing && inv.imported) inv.webUrl = inv.drivePath = undefined;   // new PDF replaces the attached original link
      inv.items.forEach(l => {
        if (!db.products.some(p => norm(p.name) === norm(l.name)))
          db.products.push({ id: uid(), code: "", name: l.name.trim(), hsn: l.hsn, rate: l.rate, gst: l.gst, taxIncluded: !!l.taxIncluded, active: true });
      });
      busy(true, "Creating PDF…");
      const blob = await makePdf(inv);
      inv.fileName = inv.number.replace(/\//g, "_") + ".pdf";
      if (cloud) {
        busy(true, "Saving PDF to Google Drive…");
        const path = `${CFG.driveFolder}/Invoices/${inv.fy}/${inv.fileName}`;
        const item = await OD.upload(path, blob, "application/pdf");
        inv.drivePath = path; inv.webUrl = item.webUrl;
        if (needsEway(inv)) await ensureEwayFolder(inv.fy);
      } else downloadBlob(blob, inv.fileName);
      if (editing) db.invoices = db.invoices.map(i => i.id === inv.id ? inv : i);
      else db.invoices.push(inv);
      await persist();
      draft = newDraft(); saveDraft();
      busy(false); toast(editing ? `${inv.number} updated ✔` : `${inv.number} saved ✔`);
      location.hash = "#history";
      showPreview(inv, false);
    } catch (e) { console.error(e); busy(false); toast("Could not save bill: " + e.message, true); }
  }

  // ================= PRINTED INVOICE (A4) =================
  function invoiceHtml(inv) {
    const b = inv.business, bk = inv.bank, c = inv.customer, t = inv.totals, P = B.plain;
    const rows = inv.items.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.name)}</td><td class="c">${esc(l.hsn)}</td><td class="c">${P(l.qty)}</td><td class="n">${P(l.baseRate)}</td><td class="n">${P(l.taxable)}</td></tr>`).join("");
    const taxLines = t.slabs.map(s => t.interState
      ? `<tr class="sum"><td colspan="5" style="text-align:right">IGST ${s.rate}%</td><td class="n">${P(s.igst)}</td></tr>`
      : `<tr class="sum"><td colspan="5" style="text-align:right">SGST ${s.rate / 2}%</td><td class="n">${P(s.sgst)}</td></tr>
         <tr class="sum"><td colspan="5" style="text-align:right">CGST ${s.rate / 2}%</td><td class="n">${P(s.cgst)}</td></tr>`).join("");
    const taxSum = t.slabs.map(s => `<tr><td>${P(s.taxable)}</td>
      <td>${t.interState ? "" : s.rate / 2}</td><td>${t.interState ? "" : P(s.sgst)}</td>
      <td>${t.interState ? "" : s.rate / 2}</td><td>${t.interState ? "" : P(s.cgst)}</td>
      <td>${t.interState ? s.rate : ""}</td><td>${t.interState ? P(s.igst) : ""}</td><td>${P(s.tax)}</td></tr>`).join("");
    const wm = CFG.watermark ? `<img class="wm" src="${esc(CFG.watermark)}" alt="" style="opacity:${Number(CFG.watermarkOpacity) || 0.1}">` : "";
    return `<div class="inv">
      ${wm}
      ${inv.status === "cancelled" ? '<div class="stamp">CANCELLED</div>' : ""}
      <div class="body">
      <table>
        <tr><td colspan="2" class="title">Tax Invoice</td></tr>
        <tr><td style="width:60%"><div class="biz-name">${esc(b.name)}</div><div>${esc(b.address)}</div><div>Ph: ${esc(b.phone)}</div><div>GSTIN: ${esc(b.gstin)}</div></td>
          <td><table class="kv">
            <tr><td>Invoice Number</td><td>: <b>${esc(inv.number)}</b></td></tr>
            <tr><td>Invoice Date</td><td>: ${dmy(inv.date)}</td></tr>
            <tr><td>State</td><td>: ${esc(b.state)}</td></tr>
            <tr><td>State Code</td><td>: ${esc(b.stateCode)}</td></tr></table></td></tr>
        <tr><td colspan="2"><b>Billed to:</b><table class="kv">
            <tr><td>Name</td><td>: <b>${esc(c.name)}</b></td></tr>
            <tr><td>Address</td><td>: ${esc(c.address)}</td></tr>
            <tr><td>Phone</td><td>: ${esc(c.phone)}</td></tr>
            <tr><td>GSTIN</td><td>: ${esc(c.gstin)}</td></tr>
            <tr><td>State</td><td>: ${esc(c.state)} &nbsp;&nbsp;&nbsp; State Code : ${esc(c.stateCode)}</td></tr></table></td></tr>
      </table>
      <table class="items no-top">
        <tr><th style="width:50px">Sl No.</th><th>Particulars</th><th style="width:80px">HSN Code</th><th style="width:55px">Qty</th><th style="width:80px">Rate</th><th style="width:100px">Amount</th></tr>
        ${rows}
        <tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        <tr class="sum"><td colspan="5" style="text-align:right">Taxable Value</td><td class="n">${P(t.taxable)}</td></tr>
        ${taxLines}
        <tr class="sum"><td colspan="5" style="text-align:right">Round off</td><td class="n">${t.roundOff ? P(t.roundOff) : ""}</td></tr>
        <tr class="grand"><td colspan="5" style="text-align:right">TOTAL</td><td class="n">${P(t.total)}</td></tr>
        <tr><td colspan="6"><b>Total Invoice Amount in Words:</b> ${esc(B.inWords(t.total))}</td></tr>
      </table>
      <table class="taxsum no-top">
        <tr><th rowspan="2">Taxable Value</th><th colspan="2">SGST</th><th colspan="2">CGST</th><th colspan="2">IGST</th><th rowspan="2">Total Tax Amount</th></tr>
        <tr><th>Rate %</th><th>Value</th><th>Rate %</th><th>Value</th><th>Rate %</th><th>Value</th></tr>
        ${taxSum}
      </table>
      <table class="no-top"><tr>
        <td style="width:55%"><b>BANK DETAILS</b><table class="kv">
          <tr><td>Bank</td><td>: ${esc(bk.bank)}</td></tr><tr><td>A/C Name</td><td>: ${esc(bk.accName)}</td></tr>
          <tr><td>A/C Number</td><td>: ${esc(bk.accNo)}</td></tr><tr><td>IFSC</td><td>: ${esc(bk.ifsc)}</td></tr>
          <tr><td>BRANCH</td><td>: ${esc(bk.branch)}</td></tr></table></td>
        <td class="sign-box">
          <div class="cert">Certified that the particulars given above are true and correct.</div>
          <div class="for">For <b>${esc(b.name)}</b></div>
          <div class="space"></div>
          <div class="who">Authorised Signatory</div>
        </td>
      </tr></table>
      </div>
    </div>`;
  }

  /** Stretch the empty item row so the bill fills exactly one A4 page
   *  (if there are too many items, the bill simply continues on page 2). */
  function fitSheet(sheet) {
    const filler = sheet.querySelector("tr.filler td");
    if (!filler) return;
    filler.style.height = "0px";
    const body = sheet.querySelector(".body");
    const cs = getComputedStyle(sheet);
    const used = body.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    filler.style.height = Math.max(0, A4_H - used - 4) + "px";
  }

  async function waitImages(el) {
    await Promise.all([...el.querySelectorAll("img")].map(img =>
      img.complete && img.naturalWidth ? Promise.resolve()
        : new Promise(res => { img.onload = img.onerror = res; })));
  }

  async function makePdf(inv) {
    const stage = $("#pdfStage");
    stage.innerHTML = invoiceHtml(inv);
    const sheet = stage.firstElementChild;
    try {
      await waitImages(sheet);
      fitSheet(sheet);
      const prevScroll = window.scrollY;
      window.scrollTo(0, 0);               // capture from the very top-left, so nothing is cut off
      const blob = await html2pdf().set({
        margin: 0,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff",
                       width: A4_W, windowWidth: A4_W, scrollX: 0, scrollY: 0, x: 0, y: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },   // 794 px wide sheet = 210 mm exactly
        pagebreak: { mode: ["css"], avoid: "tr" }
      }).from(sheet).outputPdf("blob");
      window.scrollTo(0, prevScroll);
      return blob;
    } finally { stage.innerHTML = ""; }
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function fitPreview() {
    const box = $(".preview-scroll"), sc = $("#previewScale");
    const s = Math.min(1, (box.clientWidth - 24) / A4_W);
    sc.style.transform = `scale(${s})`;
    sc.style.height = ($("#printArea").scrollHeight * s) + "px";
  }
  window.addEventListener("resize", () => { if (!$("#previewModal").classList.contains("hidden")) fitPreview(); });

  async function showPreview(inv, isDraft) {
    $("#previewTitle").textContent = isDraft ? "Preview (not saved yet)" : inv.number + (inv.imported ? " (old bill)" : "");
    $("#printArea").innerHTML = invoiceHtml(inv);
    const bar = $("#ewayBar");
    if (!isDraft && (needsEway(inv) || hasEwb(inv))) {
      const r = ewayBarHtml(inv);
      bar.className = "eway-bar no-print " + r.cls; bar.innerHTML = r.html;
    } else if (isDraft && needsEway(inv)) {
      bar.className = "eway-bar no-print";
      bar.innerHTML = `<span class="msg">🚚 <b>E-Way Bill needed</b> (above ${money(ewayLimit())}). Generate and save the bill first.</span>`;
    } else bar.className = "eway-bar no-print hidden";

    $("#previewActions").innerHTML = isDraft
      ? `<button class="btn" data-close="previewModal" type="button">Back to edit</button><button class="btn primary" id="pvGen" type="button">✔ Generate & Save</button>`
      : `${inv.webUrl ? `<a class="btn" href="${esc(inv.webUrl)}" target="_blank" rel="noopener">${inv.imported ? "Open original PDF" : "Open in Google Drive"}</a>`
                      : (inv.imported ? `<button class="btn" id="pvAttach" type="button">📎 Attach original PDF</button>` : "")}
         ${!needsEway(inv) && !hasEwb(inv) && inv.status !== "cancelled" ? `<button class="btn" type="button" data-ewbedit="${esc(inv.id)}">🚚 Add E-Way Bill</button>` : ""}
         <button class="btn" id="pvEdit" type="button">✏️ Edit</button>
         <button class="btn" id="pvPdf" type="button">⬇ PDF</button><button class="btn primary" id="pvPrint" type="button">🖨 Print</button>`;
    if (isDraft) $("#pvGen").onclick = () => { closeModal("previewModal"); generate(); };
    else {
      $("#pvPrint").onclick = () => window.print();
      $("#pvPdf").onclick = async () => { busy(true, "Creating PDF…"); try { downloadBlob(await makePdf(inv), inv.fileName || "invoice.pdf"); } catch (e) { toast(e.message, true); } finally { busy(false); } };
      if ($("#pvAttach")) $("#pvAttach").onclick = () => startAttach(inv);
      $("#pvEdit").onclick = () => startEdit(inv);
    }
    openModal("previewModal");
    const sheet = $("#printArea .inv");
    await waitImages(sheet);
    fitSheet(sheet);
    requestAnimationFrame(fitPreview);
  }

  // ================= BILLS LIST =================
  function invoiceRows(list) {
    return list.map(i => {
      const need = needsEway(i), got = hasEwb(i);
      return `<div class="list-item ${i.status === "cancelled" ? "cancelled" : ""}" data-id="${i.id}">
      <div class="main"><b>${esc(i.number)}</b> ${i.status === "cancelled" ? '<span class="badge-c">CANCELLED</span>' : ""}
        ${got ? `<span class="badge badge-ewbok">EWB ${esc(ewbFmt(i.ewb.no) || "✓")}</span>` : (need ? '<span class="badge badge-ewb">E-Way Bill missing</span>' : "")}
        ${i.imported ? '<span class="badge badge-old">Old bill</span>' : ""}
        <small>${dmy(i.date)} · ${esc(i.customer.name)}</small></div>
      <div class="money">${money(i.totals.total)}</div>
      <div class="row">
        <button class="btn small" data-act="view" type="button">View / Print</button>
        ${i.imported && !i.webUrl ? '<button class="btn small" data-act="attach" type="button">📎 Attach PDF</button>' : ""}
        ${got && i.ewb.webUrl ? `<a class="btn small ewbok" href="${esc(i.ewb.webUrl)}" target="_blank" rel="noopener">📄 E-Way Bill</a>` : ""}
        ${got && !i.ewb.webUrl ? `<button class="btn small" type="button" data-ewbedit="${esc(i.id)}">📎 Attach EWB PDF</button>` : ""}
        ${need && !got ? `<a class="btn small eway" href="${esc(EWAY_URL)}" target="_blank" rel="noopener noreferrer">🚚 Generate EWB</a>
          <button class="btn small" type="button" data-ewbedit="${esc(i.id)}">📎 Attach EWB</button>` : ""}
        <button class="btn small" data-act="dup" type="button">Duplicate</button>
        <button class="btn small" data-act="edit" type="button">✏️ Edit</button>
        <button class="btn small danger" data-act="del" type="button">🗑 Delete</button>
      </div></div>`;
    }).join("");
  }

  function bindInvoiceRows() {
    $$(".list-item[data-id] [data-act]").forEach(btn => btn.onclick = async () => {
      const inv = db.invoices.find(x => x.id === btn.closest("[data-id]").dataset.id);
      const act = btn.dataset.act;
      if (act === "view") showPreview(inv, false);
      if (act === "attach") startAttach(inv);
      if (act === "dup") {
        const cust = db.customers.find(c => norm(c.name) === norm(inv.customer.name)) || inv.customer;
        draft = { customerId: cust.id || "", customer: { ...cust }, date: today(),
          items: inv.items.map(l => ({ key: uid(), name: l.name, hsn: l.hsn, qty: l.qty, rate: l.rate, gst: l.gst, taxIncluded: !!l.taxIncluded })) };
        saveDraft(); location.hash = "#new";
      }
      if (act === "edit") startEdit(inv);
      if (act === "del") deleteBill(inv);
    });
  }

  /** Open a saved bill in the editor. Its number never changes. */
  function startEdit(inv) {
    if (draft && draft.editId !== inv.id && (draft.editId || (draft.items || []).some(i => (i.name || "").trim()))
        && !confirm("You have an unsaved bill open. Replace it with this bill for editing?")) return;
    const cust = db.customers.find(c => norm(c.name) === norm(inv.customer.name));
    draft = { editId: inv.id, customerId: cust ? cust.id : "", customer: { ...inv.customer }, date: inv.date,
      items: inv.items.map(l => ({ key: uid(), name: l.name, hsn: l.hsn, qty: l.qty, rate: l.rate, gst: l.gst, taxIncluded: !!l.taxIncluded })) };
    saveDraft();
    closeModal("previewModal");
    location.hash = "#new";
    if ((location.hash.slice(1) || "") === "new") viewEditor();
  }

  /** Only the LATEST bill of a financial year can be deleted, so no number is ever skipped.
   *  Its number is given to the next new bill. Older bills can only be edited. */
  async function deleteBill(inv) {
    const latest = Math.max(...db.invoices.filter(i => i.fy === inv.fy).map(i => i.seq));
    if (inv.seq !== latest) {
      alert(`${inv.number} cannot be deleted.\n\nOnly the latest bill (${B.invoiceNumber(db.settings.invoicePrefix, latest, db.settings.numberDigits, inv.fy)}) can be deleted, so the bill numbers stay continuous.\n\nTo change this bill, use ✏️ Edit. You can change the customer, items and amounts and keep the same number.`);
      return;
    }
    if (OD.isConnected()) { try { await OD.ensureToken(); } catch (e) { toast(e.message, true); return; } }
    if (!confirm(`Delete ${inv.number}?\n\nThe bill and its PDF will be removed.\nThe next new bill will get the number ${inv.number} again.`)) return;
    busy(true, "Deleting…");
    try {
      if (OD.hasToken()) {
        await pull();   // make sure no newer bill was made on another device
        const latestNow = Math.max(...db.invoices.filter(i => i.fy === inv.fy).map(i => i.seq));
        if (inv.seq !== latestNow) throw new Error("A newer bill was made on another device. Use ✏️ Edit instead.");
        if (inv.drivePath) { try { await OD.trash(inv.drivePath); } catch (e) { console.warn(e); } }
      }
      db.invoices = db.invoices.filter(i => i.id !== inv.id);
      db.deleted = { ...(db.deleted || {}), [inv.id]: inv.number };
      // give the number back to the next bill
      db.settings.seqStart = db.settings.seqStart || {};
      if ((db.settings.seqStart[inv.fy] || 0) > inv.seq) db.settings.seqStart[inv.fy] = inv.seq;
      if (draft && draft.editId === inv.id) { draft = newDraft(); saveDraft(); }
      await persist();
      busy(false); toast(`${inv.number} deleted. The next bill will be ${inv.number}.`);
      closeModal("previewModal"); route();
    } catch (e) { busy(false); toast(e.message, true); }
  }

  function viewHistory(arg) {
    $("#view").innerHTML = `<h1>Bills</h1>
      <div class="card row">
        <input class="search" id="hSearch" placeholder="Search bill no., customer, phone, E-Way Bill no.">
        <input type="month" id="hMonth" style="max-width:180px">
        <select id="hEway" style="max-width:220px">
          <option value="">All bills</option><option value="need">Above limit (E-Way Bill)</option>
          <option value="missing">E-Way Bill missing</option><option value="has">Has E-Way Bill</option>
        </select>
        <span class="spacer"></span><b id="hSum"></b></div>
      <div class="list" id="hList"></div>`;
    if (arg === "ewb") $("#hEway").value = "missing";
    const draw = () => {
      const q = norm($("#hSearch").value), qd = q.replace(/\s/g, ""), m = $("#hMonth").value, ew = $("#hEway").value;
      const list = db.invoices.filter(i => (!m || i.date.startsWith(m))
        && (!ew || (ew === "need" && needsEway(i)) || (ew === "missing" && needsEway(i) && !hasEwb(i)) || (ew === "has" && hasEwb(i)))
        && (!q || norm(i.number).includes(q) || norm(i.customer.name).includes(q) || norm(i.customer.phone).includes(q)
            || (qd && i.ewb && String(i.ewb.no || "").includes(qd)))).reverse();
      $("#hList").innerHTML = invoiceRows(list) || '<p class="muted">No bills found.</p>';
      $("#hSum").textContent = `${list.length} bills · ${money(list.filter(i => i.status !== "cancelled").reduce((s, i) => s + i.totals.total, 0))}`;
      bindInvoiceRows();
    };
    $("#hSearch").oninput = draw; $("#hMonth").onchange = draw; $("#hEway").onchange = draw; draw();
  }

  // ================= CUSTOMERS =================
  function openCustomerForm(c, presetName, after) {
    c = c || { name: presetName || "", address: "", phone: "", gstin: "", state: "Kerala", stateCode: "32" };
    const opts = window.INDIAN_STATES.map(([n, code]) => `<option value="${code}" ${code === String(c.stateCode) ? "selected" : ""}>${n} (${code})</option>`).join("");
    openForm(c.id ? "Edit customer" : "New customer", `
      <div class="full"><label>Name *</label><input id="cName" value="${esc(c.name)}"></div>
      <div class="full"><label>Address</label><textarea id="cAddr" rows="2">${esc(c.address)}</textarea></div>
      <div><label>Phone</label><input id="cPhone" value="${esc(c.phone)}" inputmode="tel"></div>
      <div><label>GSTIN</label><input id="cGst" value="${esc(c.gstin)}" style="text-transform:uppercase" maxlength="15"></div>
      <div class="full"><label>State</label><select id="cState">${opts}</select></div>`, () => {
      if (!fv("cName")) { toast("Name is required", true); return false; }
      const gstin = fv("cGst").toUpperCase(), code = $("#cState").value;
      if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) { toast("GSTIN should be 15 characters", true); return false; }
      if (gstin && gstin.slice(0, 2) !== code && !confirm(`GSTIN starts with ${gstin.slice(0, 2)} but state code is ${code}. Save anyway?`)) return false;
      const data = { name: fv("cName"), address: fv("cAddr"), phone: fv("cPhone"), gstin, stateCode: code, state: window.INDIAN_STATES.find(s => s[1] === code)[0] };
      let saved;
      if (c.id) saved = Object.assign(db.customers.find(x => x.id === c.id), data);
      else { saved = { id: uid(), ...data }; db.customers.push(saved); }
      persist(); toast("Customer saved");
      if (after) after(saved); else route();
    });
    $("#cGst").addEventListener("input", e => {
      const code = e.target.value.slice(0, 2);
      if (window.INDIAN_STATES.some(s => s[1] === code)) $("#cState").value = code;
    });
  }

  function viewCustomers() {
    $("#view").innerHTML = `<div class="row"><h1>Customers</h1><span class="spacer"></span><button class="btn primary" id="addC" type="button">＋ Add customer</button></div>
      <div class="card"><input class="search" id="cSearch" placeholder="Search name, phone, GSTIN"></div><div class="list" id="cList"></div>`;
    const draw = () => {
      const q = norm($("#cSearch").value);
      const list = db.customers.filter(c => !q || [c.name, c.phone, c.gstin, c.address].some(v => norm(v).includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      $("#cList").innerHTML = list.map(c => `<div class="list-item" data-cid="${c.id}">
        <div class="main"><b>${esc(c.name)}</b><small>${esc(c.address)}</small><small>Ph: ${esc(c.phone || "-")} · GSTIN: ${esc(c.gstin || "-")} · ${esc(c.state)}</small></div>
        <div class="row"><button class="btn small" data-a="bill" type="button">New bill</button><button class="btn small" data-a="edit" type="button">Edit</button><button class="btn small danger" data-a="del" type="button">Delete</button></div></div>`).join("") || '<p class="muted">No customers.</p>';
      $$("[data-cid] [data-a]").forEach(b => b.onclick = () => {
        const c = db.customers.find(x => x.id === b.closest("[data-cid]").dataset.cid);
        if (b.dataset.a === "edit") openCustomerForm(c);
        if (b.dataset.a === "bill") { draft = newDraft(); draft.customerId = c.id; draft.customer = { ...c }; saveDraft(); location.hash = "#new"; }
        if (b.dataset.a === "del" && confirm(`Delete ${c.name}? Old bills are not affected.`)) { db.customers = db.customers.filter(x => x !== c); persist(); draw(); }
      });
    };
    $("#cSearch").oninput = draw; $("#addC").onclick = () => openCustomerForm(); draw();
  }

  // ================= PRODUCTS =================
  function openProductForm(p) {
    p = p || { code: "", name: "", hsn: "9703", rate: 0, gst: 5, taxIncluded: false, active: true };
    openForm(p.id ? "Edit product" : "New product", `
      <div><label>Product code</label><input id="pCode" value="${esc(p.code)}" placeholder="e.g. P061"></div>
      <div><label>HSN code</label><input id="pHsn" value="${esc(p.hsn)}" inputmode="numeric"></div>
      <div class="full"><label>Product name *</label><input id="pName" value="${esc(p.name)}"></div>
      <div><label>Default rate ₹</label><input id="pRate" type="number" step="any" min="0" inputmode="decimal" value="${p.rate}"></div>
      <div><label>GST %</label><select id="pGst">${GST_RATES.map(r => `<option ${Number(p.gst) === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="full"><label class="check"><input type="checkbox" id="pIncl" ${p.taxIncluded ? "checked" : ""}> Rate includes tax (GST is inside this price)</label></div>
      <div class="full"><label class="check"><input type="checkbox" id="pAct" ${p.active !== false ? "checked" : ""}> Active (show while billing)</label></div>`, () => {
      if (!fv("pName")) { toast("Product name is required", true); return false; }
      const data = { code: fv("pCode"), name: fv("pName"), hsn: fv("pHsn"), rate: Number(fv("pRate")) || 0, gst: Number($("#pGst").value), taxIncluded: $("#pIncl").checked, active: $("#pAct").checked };
      if (p.id) Object.assign(db.products.find(x => x.id === p.id), data); else db.products.push({ id: uid(), ...data });
      persist(); toast("Product saved"); route();
    });
  }

  function viewProducts() {
    $("#view").innerHTML = `<div class="row"><h1>Products</h1><span class="spacer"></span><button class="btn primary" id="addP" type="button">＋ Add product</button></div>
      <div class="card"><input class="search" id="pSearch" placeholder="Search name, code, HSN"></div><div class="list" id="pList"></div>`;
    const draw = () => {
      const q = norm($("#pSearch").value);
      const list = db.products.filter(p => !q || [p.name, p.code, p.hsn].some(v => norm(v).includes(q)))
        .sort((a, b) => (a.code ? 0 : 1) - (b.code ? 0 : 1) || (a.code || "").localeCompare(b.code || "") || a.name.localeCompare(b.name));
      $("#pList").innerHTML = list.map(p => `<div class="list-item ${p.active === false ? "cancelled" : ""}" data-pid="${p.id}">
        <div class="main"><b>${p.code ? esc(p.code) + " · " : ""}${esc(p.name)}</b>
          <small>HSN ${esc(p.hsn)} · GST ${p.gst}% · ${p.taxIncluded ? "Rate includes tax" : "Tax added on top"}${p.active === false ? " · inactive" : ""}</small></div>
        <div class="money">${p.rate ? "₹" + p.rate : '<span class="badge-c">Set price</span>'}</div>
        <div class="row"><button class="btn small" data-a="edit" type="button">Edit</button><button class="btn small danger" data-a="del" type="button">Delete</button></div></div>`).join("") || '<p class="muted">No products.</p>';
      $$("[data-pid] [data-a]").forEach(b => b.onclick = () => {
        const p = db.products.find(x => x.id === b.closest("[data-pid]").dataset.pid);
        if (b.dataset.a === "edit") openProductForm(p);
        if (b.dataset.a === "del" && confirm(`Delete ${p.name}? Old bills are not affected.`)) { db.products = db.products.filter(x => x !== p); persist(); draw(); }
      });
    };
    $("#pSearch").oninput = draw; $("#addP").onclick = () => openProductForm(); draw();
  }

  // ================= SETTINGS =================
  function viewSettings() {
    const s = db.settings, b = s.business, k = s.bank, fy = B.fyOf(today());
    const nextSeq = B.nextSeq(db.invoices, fy, s.seqStart), fUrl = ewayFolderUrl(fy);
    $("#view").innerHTML = `<h1>Settings</h1>
      <div class="card"><h2>Business details (printed on bill)</h2><div class="form-grid" style="padding:0">
        <div class="full"><label>Name</label><input id="sName" value="${esc(b.name)}"></div>
        <div class="full"><label>Address</label><input id="sAddr" value="${esc(b.address)}"></div>
        <div><label>Phone</label><input id="sPhone" value="${esc(b.phone)}"></div>
        <div><label>GSTIN</label><input id="sGst" value="${esc(b.gstin)}"></div>
        <div><label>State</label><input id="sState" value="${esc(b.state)}"></div>
        <div><label>State code</label><input id="sCode" value="${esc(b.stateCode)}"></div></div></div>
      <div class="card"><h2>Bank details</h2><div class="form-grid" style="padding:0">
        <div><label>Bank</label><input id="kBank" value="${esc(k.bank)}"></div>
        <div><label>A/C name</label><input id="kName" value="${esc(k.accName)}"></div>
        <div><label>A/C number</label><input id="kNo" value="${esc(k.accNo)}"></div>
        <div><label>IFSC</label><input id="kIfsc" value="${esc(k.ifsc)}"></div>
        <div><label>Branch</label><input id="kBr" value="${esc(k.branch)}"></div></div></div>
      <div class="card"><h2>Bill numbering</h2><div class="form-grid" style="padding:0">
        <div><label>Prefix</label><input id="nPre" value="${esc(s.invoicePrefix)}"></div>
        <div><label>Next number for FY ${fy}</label><input id="nNext" type="number" min="1" value="${nextSeq}"></div>
        <div class="full muted">Example: ${esc(B.invoiceNumber(s.invoicePrefix, nextSeq, s.numberDigits, fy))}. Numbers restart from 1 every April.</div></div></div>
      <div class="card"><h2>E-Way Bill</h2><div class="form-grid" style="padding:0">
        <div><label>E-Way Bill needed when bill total is above ₹</label><input id="eLimit" type="number" min="0" step="1" value="${ewayLimit()}"></div>
        <div class="full row"><a class="btn eway" href="${esc(EWAY_URL)}" target="_blank" rel="noopener noreferrer">🚚 E-Way Bill portal</a>
          ${fUrl ? `<a class="btn" href="${esc(fUrl)}" target="_blank" rel="noopener">📁 E-Way Bill folder ${esc(fy)}</a>` : ""}</div></div></div>
      <div class="row"><button class="btn primary" id="sSave" type="button">Save settings</button></div>
      <div class="card" style="margin-top:14px"><h2>Backup</h2>
        <p class="muted">All data is saved automatically to <b>${esc(CFG.driveFolder)}/Data/billing-data.json</b> when Google Drive is connected.</p>
        <div class="row"><button class="btn" id="bExp" type="button">⬇ Download backup</button>
        <label class="btn" style="margin:0;color:var(--text);font-size:15px;font-weight:400">⬆ Restore backup<input type="file" id="bImp" accept=".json" hidden></label></div></div>`;
    $("#sSave").onclick = () => {
      Object.assign(b, { name: fv("sName"), address: fv("sAddr"), phone: fv("sPhone"), gstin: fv("sGst"), state: fv("sState"), stateCode: fv("sCode") });
      Object.assign(k, { bank: fv("kBank"), accName: fv("kName"), accNo: fv("kNo"), ifsc: fv("kIfsc"), branch: fv("kBr") });
      s.invoicePrefix = fv("nPre") || "DC";
      const lim = Number(fv("eLimit")); s.ewayLimit = lim > 0 ? lim : 50000;
      const n = parseInt(fv("nNext"), 10), used = db.invoices.filter(i => i.fy === fy).map(i => i.seq);
      if (n && used.length && n <= Math.max(...used)) { toast(`Number ${n} already used. Must be above ${Math.max(...used)}.`, true); return; }
      s.seqStart = s.seqStart || {}; if (n) s.seqStart[fy] = n;
      persist(); toast("Settings saved"); route();
    };
    $("#bExp").onclick = () => downloadBlob(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }), `st-theresa-backup-${today()}.json`);
    $("#bImp").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d.settings || !Array.isArray(d.invoices)) throw new Error("Not a valid backup file");
        if (!confirm("Replace ALL current data with this backup?")) return;
        db = d; await persist(); toast("Backup restored"); route();
      } catch (err) { toast(err.message, true); }
    };
  }

  // ================= START =================
  function updateAccountUi() {
    const con = OD.isConnected();
    $("#btnSignIn").textContent = con ? "⟳ Sync" : "Connect Google Drive";
    $("#btnSignOut").classList.toggle("hidden", !con);
    $("#btnSignOut").title = OD.userName();
    if (!con) setSync(false);
    else if (localStorage.getItem(LS_PENDING)) setSync(false, "Not synced · tap Sync");
    else setSync(OD.hasToken());
  }

  async function start() {
    loadLocal();
    if (!db.settings.ewayLimit) db.settings.ewayLimit = 50000;
    const c1 = applyCatalog(), c2 = applyOldBills();
    if (c1 || c2) { saveLocal(); if (OD.isConnected()) localStorage.setItem(LS_PENDING, "1"); }
    $("#btnSignIn").onclick = async () => {
      try {
        await OD.ensureToken();
        busy(true, "Syncing with Google Drive…");
        await OD.fetchUser(); await pull();
        toast("Google Drive synced ✔"); route();
      } catch (e) { console.error(e); toast(e.message, true); }
      finally { busy(false); updateAccountUi(); }
    };
    $("#btnSignOut").onclick = () => {
      if (!confirm("Disconnect Google Drive on this device?\n\nNothing is deleted.")) return;
      OD.signOut(); updateAccountUi(); route();
    };
    try {
      await OD.init();
      if (OD.isConnected() && OD.hasToken()) { busy(true, "Loading from Google Drive…"); await pull(); }
    } catch (e) { console.error(e); toast("Google Drive: " + e.message, true); }
    finally { busy(false); updateAccountUi(); }
    route();
  }

  window.__stt = { makePdf, showPreview, merge, db: () => db };   // used by automated tests only
  start();
})();
