// ST. THERESA Billing - main application
(function () {
  const B = window.Billing, OD = window.OneDrive, CFG = window.APP_CONFIG || {};
  const LS_KEY = "stt_billing_data_v1";
  const LS_DRAFT = "stt_billing_draft_v1";
  const DATA_FILE = () => `${CFG.oneDriveFolder}/Data/billing-data.json`;
  const GST_RATES = [0, 3, 5, 12, 18, 28, 40];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const dmy = iso => iso ? iso.split("-").reverse().join("-") : "";
  const norm = s => String(s || "").trim().toLowerCase();

  // ================= DATA =================
  let db = null;

  function freshData() {
    const s = window.SEED_DATA;
    return {
      version: 1, updatedAt: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(s.settings)),
      customers: s.customers.map(c => ({ id: uid(), ...c })),
      products: s.products.map(([name, hsn, rate]) => ({ id: uid(), code: "", name, hsn, rate, gst: 5, taxIncluded: false, active: true })),
      invoices: []
    };
  }

  function loadLocal() {
    try { db = JSON.parse(localStorage.getItem(LS_KEY)); } catch { db = null; }
    if (!db || !db.settings) { db = freshData(); saveLocal(); }
  }
  function saveLocal() { localStorage.setItem(LS_KEY, JSON.stringify(db)); }

  async function persist() {
    db.updatedAt = new Date().toISOString();
    saveLocal();
    if (OD.isSignedIn()) {
      try { await OD.writeJson(DATA_FILE(), db); setSync(true); }
      catch (e) { console.error(e); setSync(false, "Sync failed"); toast("Saved on this device. OneDrive sync failed - will retry.", true); }
    }
  }

  // Pull latest from OneDrive (OneDrive is the master copy shared by phone + computer)
  async function pull() {
    if (!OD.isSignedIn()) return;
    const remote = await OD.readJson(DATA_FILE());
    if (remote && remote.settings) {
      if (!db.updatedAt || remote.updatedAt >= db.updatedAt) { db = remote; saveLocal(); }
      else await OD.writeJson(DATA_FILE(), db);   // this device has newer changes (made offline)
    } else {
      await OD.writeJson(DATA_FILE(), db); // first time: upload current data
    }
    setSync(true);
  }

  // ================= UI HELPERS =================
  function toast(msg, err) {
    const t = $("#toast"); t.textContent = msg; t.className = "toast" + (err ? " err" : "");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 3500);
  }
  function busy(on, text) { $("#busy").classList.toggle("hidden", !on); if (text) $("#busyText").textContent = text; }
  function setSync(on, text) {
    const s = $("#syncStatus");
    s.className = "sync " + (on ? "on" : "off");
    s.textContent = text || (on ? "OneDrive synced" : (OD.enabled() ? "Not connected" : "Device only"));
  }
  function openModal(id) { $("#" + id).classList.remove("hidden"); }
  function closeModal(id) { $("#" + id).classList.add("hidden"); }
  document.addEventListener("click", e => { const c = e.target.closest("[data-close]"); if (c) closeModal(c.dataset.close); });

  // ================= NAVIGATION =================
  const ROUTES = [
    ["dashboard", "🏠", "Home"], ["new", "➕", "New Bill"], ["history", "🧾", "Bills"],
    ["customers", "👥", "Customers"], ["products", "📦", "Products"], ["settings", "⚙️", "Settings"]
  ];
  function renderNav() {
    const cur = (location.hash.slice(1) || "dashboard").split("/")[0];
    $("#deskNav").innerHTML = ROUTES.map(([k, , t]) => `<a href="#${k}" class="${k === cur ? "active" : ""}">${t}</a>`).join("");
    $("#mobileNav").innerHTML = ROUTES.filter(r => r[0] !== "settings")
      .map(([k, i, t]) => `<a href="#${k}" class="${k === cur ? "active" : ""}"><span>${i}</span>${t}</a>`).join("");
  }
  function route() {
    renderNav();
    const [page, arg] = (location.hash.slice(1) || "dashboard").split("/");
    const fn = { dashboard: viewDashboard, new: viewEditor, history: viewHistory, customers: viewCustomers, products: viewProducts, settings: viewSettings }[page] || viewDashboard;
    fn(arg); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  // ================= DASHBOARD =================
  function viewDashboard() {
    const act = db.invoices.filter(i => i.status !== "cancelled");
    const t = today(), month = t.slice(0, 7), fy = B.fyOf(t);
    const sum = arr => arr.reduce((s, i) => s + i.totals.total, 0);
    const todays = act.filter(i => i.date === t), monthly = act.filter(i => i.date.startsWith(month)), fyAll = act.filter(i => i.fy === fy);
    const next = B.invoiceNumber(db.settings.invoicePrefix, B.nextSeq(db.invoices, fy, db.settings.seqStart), db.settings.numberDigits, fy);
    $("#view").innerHTML = `
      <div class="row"><h1>Welcome 👋</h1><span class="spacer"></span><a class="btn primary" href="#new">➕ New Bill</a></div>
      <div class="stats">
        <div class="stat"><span class="muted">Today</span><b>${money(sum(todays))}</b><small class="muted">${todays.length} bills</small></div>
        <div class="stat"><span class="muted">This month</span><b>${money(sum(monthly))}</b><small class="muted">${monthly.length} bills</small></div>
        <div class="stat"><span class="muted">FY ${fy}</span><b>${money(sum(fyAll))}</b><small class="muted">${fyAll.length} bills</small></div>
        <div class="stat"><span class="muted">Next bill no.</span><b>${esc(next)}</b></div>
      </div>
      ${!OD.isSignedIn() ? `<div class="card" style="border-color:#f3c98b;background:#fff9ef">
        <b>OneDrive not connected.</b> <span class="muted">${OD.enabled() ? "Tap “Connect OneDrive” on top so bills are saved to OneDrive and shared between phone and computer." : "Finish setup Step 3 in README.md (add clientId in js/config.js). Until then, data is stored only on this device."}</span></div>` : ""}
      <div class="card"><h2>Recent bills</h2><div class="list">${invoiceRows(db.invoices.slice().reverse().slice(0, 8)) || '<p class="muted">No bills yet.</p>'}</div></div>`;
    bindInvoiceRows();
  }

  // ================= INVOICE EDITOR =================
  let draft = null;
  function newDraft() {
    return { customerId: "", customer: null, date: today(), items: [blankItem()] };
  }
  const blankItem = () => ({ key: uid(), name: "", hsn: "", qty: 1, rate: 0, gst: 5, taxIncluded: false });
  function saveDraft() { localStorage.setItem(LS_DRAFT, JSON.stringify(draft)); }

  function isInterState(c) { return !!c && String(c.stateCode || "") !== String(db.settings.business.stateCode); }

  function viewEditor(arg) {
    if (arg === "fresh" || !draft) {
      try { draft = arg === "fresh" ? null : JSON.parse(localStorage.getItem(LS_DRAFT)); } catch { draft = null; }
      if (!draft) draft = newDraft();
      if (arg === "fresh") { saveDraft(); history.replaceState(null, "", "#new"); }
    }
    const fy = B.fyOf(draft.date);
    const nextNo = B.invoiceNumber(db.settings.invoicePrefix, B.nextSeq(db.invoices, fy, db.settings.seqStart), db.settings.numberDigits, fy);
    $("#view").innerHTML = `
      <div class="row"><h1>New Bill</h1><span class="spacer"></span>
        <button class="btn small ghost" id="btnClear" type="button">Clear</button></div>
      <div class="card">
        <div class="editor-head">
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
          <div><label>Invoice number</label><input value="${esc(nextNo)}" disabled title="Given automatically when you generate the bill"></div>
        </div>
      </div>
      <div class="card">
        <div class="row"><h2>Items</h2><span class="spacer"></span>
          <label class="check"><input type="checkbox" id="allIncl"> All rates include tax</label></div>
        <div class="items-head"><div>#</div><div>Particulars</div><div>HSN</div><div>Qty</div><div>Rate</div><div>GST %</div><div style="text-align:center">Tax incl.</div><div style="text-align:right">Amount</div><div></div></div>
        <div id="items"></div>
        <datalist id="prodList">${db.products.filter(p => p.active !== false).map(p => `<option value="${esc(p.name)}">${p.code ? esc(p.code) + " · " : ""}₹${p.rate}</option>`).join("")}</datalist>
        <div class="row" style="margin-top:10px"><button class="btn" id="btnAddItem" type="button">＋ Add item</button></div>
      </div>
      <div class="card"><div id="totals" class="totals"></div><div id="words" class="words"></div></div>
      <div class="action-bar">
        <span class="total-mini" id="miniTotal"></span>
        <button class="btn" id="btnPreview" type="button">👁 Preview</button>
        <button class="btn primary" id="btnGenerate" type="button">✔ Generate & Save</button>
      </div>`;

    renderCustCard(); renderItems(); renderTotals();

    $("#custInput").addEventListener("change", e => {
      const c = db.customers.find(x => norm(x.name) === norm(e.target.value));
      if (c) { draft.customerId = c.id; draft.customer = { ...c }; }
      else if (e.target.value.trim()) { openCustomerForm(null, e.target.value.trim(), saved => selectCustomer(saved)); }
      else { draft.customer = null; draft.customerId = ""; }
      renderCustCard(); renderTotals(); saveDraft();
    });
    $("#btnNewCust").onclick = () => openCustomerForm(null, "", saved => selectCustomer(saved));
    $("#invDate").onchange = e => { draft.date = e.target.value || today(); saveDraft(); viewEditor(); };
    $("#btnAddItem").onclick = () => { draft.items.push(blankItem()); renderItems(); saveDraft(); const ins = $$("#items .f-name input"); ins[ins.length - 1].focus(); };
    $("#allIncl").onchange = e => { draft.items.forEach(i => i.taxIncluded = e.target.checked); renderItems(); renderTotals(); saveDraft(); };
    $("#btnClear").onclick = () => { if (confirm("Clear this bill?")) { draft = newDraft(); saveDraft(); viewEditor(); } };
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
    $("#btnEditCust").onclick = () => {
      const master = db.customers.find(x => x.id === draft.customerId);
      openCustomerForm(master || c, "", saved => selectCustomer(saved));
    };
  }

  function renderItems() {
    const gstOpts = v => GST_RATES.map(r => `<option value="${r}" ${Number(v) === r ? "selected" : ""}>${r}%</option>`).join("");
    $("#items").innerHTML = draft.items.map((it, i) => {
      const l = B.calcLine(it);
      return `<div class="item" data-k="${it.key}">
        <div class="sl">${i + 1}</div>
        <div class="f-name"><label>Particulars</label><input data-f="name" list="prodList" value="${esc(it.name)}" placeholder="Search product" autocomplete="off"></div>
        <div><label>HSN</label><input data-f="hsn" value="${esc(it.hsn)}" inputmode="numeric"></div>
        <div><label>Qty</label><input data-f="qty" type="number" min="0" step="any" inputmode="decimal" value="${it.qty}"></div>
        <div><label>Rate ₹</label><input data-f="rate" type="number" min="0" step="any" inputmode="decimal" value="${it.rate}"></div>
        <div><label>GST</label><select data-f="gst">${gstOpts(it.gst)}</select></div>
        <div class="row incl"><label class="check" style="display:inline-flex"><input type="checkbox" data-f="taxIncluded" ${it.taxIncluded ? "checked" : ""}> <span class="m-only">Tax incl.</span></label></div>
        <div class="amt" data-amt>${lineAmtHtml(l)}</div>
        <button class="icon-btn del" type="button" title="Remove" data-del>🗑</button>
      </div>`;
    }).join("");

    $$("#items .item").forEach(row => {
      const it = draft.items.find(x => x.key === row.dataset.k);
      $$("[data-f]", row).forEach(inp => {
        const f = inp.dataset.f;
        const ev = (f === "name") ? "change" : (inp.type === "checkbox" || inp.tagName === "SELECT") ? "change" : "input";
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
    $$(".m-only").forEach(s => s.style.display = window.innerWidth < 900 ? "inline" : "none");
  }

  function lineAmtHtml(l) {
    const gross = B.r2(l.qty * l.rate);
    if (l.taxIncluded && l.gst > 0) return `${money(gross)}<small>Taxable ${money(l.taxable)} + GST</small>`;
    return `${money(l.taxable)}<small>+ GST ${l.gst}%</small>`;
  }

  function renderTotals() {
    const t = B.calcInvoice(draft.items, isInterState(draft.customer));
    const rows = [`<div><span>Taxable value</span><b>${money(t.taxable)}</b></div>`];
    t.slabs.forEach(s => {
      if (t.interState) rows.push(`<div><span>IGST ${s.rate}%</span><span>${money(s.igst)}</span></div>`);
      else rows.push(`<div><span>SGST ${s.rate / 2}%</span><span>${money(s.sgst)}</span></div><div><span>CGST ${s.rate / 2}%</span><span>${money(s.cgst)}</span></div>`);
    });
    if (t.roundOff) rows.push(`<div><span>Round off</span><span>${t.roundOff > 0 ? "+" : ""}${t.roundOff.toFixed(2)}</span></div>`);
    rows.push(`<div class="grand"><span>TOTAL</span><span>${money(t.total)}</span></div>`);
    $("#totals").innerHTML = rows.join("");
    $("#words").textContent = t.total ? "Rupees " + B.inWords(t.total) : "";
    $("#miniTotal").textContent = money(t.total);
  }

  /** Build the invoice object from the draft. assignNumber=true only when finally saving. */
  function buildInvoice(assignNumber) {
    if (!draft.customer) { toast("Please select a customer", true); return null; }
    const totals = B.calcInvoice(draft.items, isInterState(draft.customer));
    if (!totals.lines.length) { toast("Please add at least one item with quantity", true); return null; }
    const fy = B.fyOf(draft.date);
    const seq = B.nextSeq(db.invoices, fy, db.settings.seqStart);
    return {
      id: uid(), fy, seq: assignNumber ? seq : null,
      number: assignNumber ? B.invoiceNumber(db.settings.invoicePrefix, seq, db.settings.numberDigits, fy) : "(Preview)",
      date: draft.date, customer: { ...draft.customer },
      business: { ...db.settings.business }, bank: { ...db.settings.bank },
      items: totals.lines.map(({ key, ...l }) => l), totals: stripLines(totals),
      status: "active", createdAt: new Date().toISOString()
    };
  }
  const stripLines = t => { const { lines, ...rest } = t; return rest; };

  async function generate() {
    if (!buildInvoice(false)) return;
    if (!OD.isSignedIn() && !confirm("OneDrive is not connected.\n\nThe bill will be saved on this device only and the PDF downloaded. Continue?")) return;
    busy(true, "Creating bill…");
    try {
      if (OD.isSignedIn()) await pull();           // get latest bill numbers from other devices
      const inv = buildInvoice(true);
      // Remember new products typed during billing
      inv.items.forEach(l => {
        if (!db.products.some(p => norm(p.name) === norm(l.name)))
          db.products.push({ id: uid(), code: "", name: l.name.trim(), hsn: l.hsn, rate: l.rate, gst: l.gst, taxIncluded: !!l.taxIncluded, active: true });
      });
      busy(true, "Creating PDF…");
      const blob = await makePdf(inv);
      inv.fileName = inv.number.replace(/\//g, "_") + ".pdf";
      if (OD.isSignedIn()) {
        busy(true, "Saving to OneDrive…");
        const path = `${CFG.oneDriveFolder}/Invoices/${inv.fy}/${inv.fileName}`;
        const item = await OD.upload(path, blob, "application/pdf");
        inv.oneDrivePath = path; inv.webUrl = item.webUrl;
      } else {
        downloadBlob(blob, inv.fileName);
      }
      db.invoices.push(inv);
      await persist();
      draft = newDraft(); saveDraft();
      busy(false);
      toast(`${inv.number} saved ✔`);
      location.hash = "#history";
      showPreview(inv, false);
    } catch (e) {
      console.error(e); busy(false); toast("Could not save bill: " + e.message, true);
    }
  }

  // ================= PRINTED INVOICE =================
  function invoiceHtml(inv) {
    const b = inv.business, bk = inv.bank, c = inv.customer, t = inv.totals, P = B.plain;
    const fillers = Math.max(0, 14 - inv.items.length);
    const rows = inv.items.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.name)}</td><td class="c">${esc(l.hsn)}</td><td class="c">${P(l.qty)}</td><td class="n">${P(l.baseRate)}</td><td class="n">${P(l.taxable)}</td></tr>`).join("")
      + Array.from({ length: fillers }, () => `<tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    const taxLines = t.slabs.map(s => t.interState
      ? `<tr class="sum"><td colspan="5" style="text-align:right">IGST ${s.rate}%</td><td class="n">${P(s.igst)}</td></tr>`
      : `<tr class="sum"><td colspan="5" style="text-align:right">SGST ${s.rate / 2}%</td><td class="n">${P(s.sgst)}</td></tr>
         <tr class="sum"><td colspan="5" style="text-align:right">CGST ${s.rate / 2}%</td><td class="n">${P(s.cgst)}</td></tr>`).join("");
    const taxSum = t.slabs.map(s => `<tr><td>${P(s.taxable)}</td>
      <td>${t.interState ? "" : s.rate / 2}</td><td>${t.interState ? "" : P(s.sgst)}</td>
      <td>${t.interState ? "" : s.rate / 2}</td><td>${t.interState ? "" : P(s.cgst)}</td>
      <td>${t.interState ? s.rate : ""}</td><td>${t.interState ? P(s.igst) : ""}</td><td>${P(s.tax)}</td></tr>`).join("");

    return `<div class="inv">
      ${inv.status === "cancelled" ? '<div class="stamp">CANCELLED</div>' : ""}
      <table>
        <tr><td colspan="2" class="title">Tax Invoice</td></tr>
        <tr>
          <td style="width:60%">
            <div class="biz-name">${esc(b.name)}</div>
            <div>${esc(b.address)}</div><div>Ph: ${esc(b.phone)}</div><div>GSTIN: ${esc(b.gstin)}</div>
          </td>
          <td><table class="kv">
            <tr><td>Invoice Number</td><td>: <b>${esc(inv.number)}</b></td></tr>
            <tr><td>Invoice Date</td><td>: ${dmy(inv.date)}</td></tr>
            <tr><td>State</td><td>: ${esc(b.state)}</td></tr>
            <tr><td>State Code</td><td>: ${esc(b.stateCode)}</td></tr></table></td>
        </tr>
        <tr><td colspan="2"><b>Billed to:</b>
          <table class="kv">
            <tr><td>Name</td><td>: <b>${esc(c.name)}</b></td></tr>
            <tr><td>Address</td><td>: ${esc(c.address)}</td></tr>
            <tr><td>Phone</td><td>: ${esc(c.phone)}</td></tr>
            <tr><td>GSTIN</td><td>: ${esc(c.gstin)}</td></tr>
            <tr><td>State</td><td>: ${esc(c.state)} &nbsp;&nbsp;&nbsp; State Code : ${esc(c.stateCode)}</td></tr>
          </table></td></tr>
      </table>
      <table class="items" style="border-top:0">
        <tr><th style="width:50px">Sl No.</th><th>Particulars</th><th style="width:80px">HSN Code</th><th style="width:55px">Qty</th><th style="width:80px">Rate</th><th style="width:100px">Amount</th></tr>
        ${rows}
        <tr class="sum"><td colspan="5" style="text-align:right">Taxable Value</td><td class="n">${P(t.taxable)}</td></tr>
        ${taxLines}
        <tr class="sum"><td colspan="5" style="text-align:right">Round off</td><td class="n">${t.roundOff ? P(t.roundOff) : ""}</td></tr>
        <tr class="grand"><td colspan="5" style="text-align:right">TOTAL</td><td class="n">${P(t.total)}</td></tr>
        <tr><td colspan="6"><b>Total Invoice Amount in Words:</b> ${esc(B.inWords(t.total))}</td></tr>
      </table>
      <table class="taxsum" style="border-top:0">
        <tr><th rowspan="2">Taxable Value</th><th colspan="2">SGST</th><th colspan="2">CGST</th><th colspan="2">IGST</th><th rowspan="2">Total Tax Amount</th></tr>
        <tr><th>Rate %</th><th>Value</th><th>Rate %</th><th>Value</th><th>Rate %</th><th>Value</th></tr>
        ${taxSum}
      </table>
      <table style="border-top:0">
        <tr>
          <td style="width:55%"><b>BANK DETAILS</b>
            <table class="kv">
              <tr><td>Bank</td><td>: ${esc(bk.bank)}</td></tr>
              <tr><td>A/C Name</td><td>: ${esc(bk.accName)}</td></tr>
              <tr><td>A/C Number</td><td>: ${esc(bk.accNo)}</td></tr>
              <tr><td>IFSC</td><td>: ${esc(bk.ifsc)}</td></tr>
              <tr><td>BRANCH</td><td>: ${esc(bk.branch)}</td></tr></table></td>
          <td style="text-align:right">
            <div style="text-align:left">Certified that the particulars given above are true and correct.</div>
            <div style="margin-top:10px">For <b>${esc(b.name)}</b></div>
            <div class="sign"></div><div>Authorised Signatory</div></td>
        </tr>
      </table>
    </div>`;
  }

  async function makePdf(inv) {
    const stage = $("#pdfStage");
    stage.innerHTML = invoiceHtml(inv);
    const blob = await html2pdf().set({
      margin: [6, 6, 6, 6], filename: "invoice.pdf",
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 794 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(stage.firstElementChild).outputPdf("blob");
    stage.innerHTML = "";
    return blob;
  }

  function downloadBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function fitPreview() {
    const box = $(".preview-scroll"), sc = $("#previewScale");
    const s = Math.min(1, (box.clientWidth - 24) / 794);
    sc.style.transform = `scale(${s})`;
    sc.style.height = ($("#printArea").scrollHeight * s) + "px";
  }
  window.addEventListener("resize", () => { if (!$("#previewModal").classList.contains("hidden")) fitPreview(); });

  function showPreview(inv, isDraft) {
    $("#previewTitle").textContent = isDraft ? "Preview (not saved yet)" : inv.number;
    $("#printArea").innerHTML = invoiceHtml(inv);
    const acts = $("#previewActions");
    acts.innerHTML = isDraft
      ? `<button class="btn" data-close="previewModal">Back to edit</button><button class="btn primary" id="pvGen">✔ Generate & Save</button>`
      : `${inv.webUrl ? `<a class="btn" href="${esc(inv.webUrl)}" target="_blank" rel="noopener">Open in OneDrive</a>` : ""}
         <button class="btn" id="pvPdf">⬇ PDF</button><button class="btn primary" id="pvPrint">🖨 Print</button>`;
    if (isDraft) $("#pvGen").onclick = () => { closeModal("previewModal"); generate(); };
    else {
      $("#pvPrint").onclick = () => window.print();
      $("#pvPdf").onclick = async () => { busy(true, "Creating PDF…"); try { downloadBlob(await makePdf(inv), inv.fileName || "invoice.pdf"); } finally { busy(false); } };
    }
    openModal("previewModal");
    requestAnimationFrame(fitPreview);
  }

  // ================= HISTORY =================
  function invoiceRows(list) {
    return list.map(i => `<div class="list-item ${i.status === "cancelled" ? "cancelled" : ""}" data-id="${i.id}">
      <div class="main"><b>${esc(i.number)}</b> ${i.status === "cancelled" ? '<span class="badge-c">CANCELLED</span>' : ""}
        <small>${dmy(i.date)} · ${esc(i.customer.name)}</small></div>
      <div class="money">${money(i.totals.total)}</div>
      <div class="row">
        <button class="btn small" data-act="view">View / Print</button>
        <button class="btn small" data-act="dup" title="Create a new bill with the same items">Duplicate</button>
        ${i.status !== "cancelled" ? '<button class="btn small danger" data-act="cancel">Cancel</button>' : ""}
      </div></div>`).join("");
  }
  function bindInvoiceRows() {
    $$(".list-item[data-id] [data-act]").forEach(btn => btn.onclick = async () => {
      const inv = db.invoices.find(x => x.id === btn.closest("[data-id]").dataset.id);
      if (btn.dataset.act === "view") showPreview(inv, false);
      if (btn.dataset.act === "dup") {
        const cust = db.customers.find(c => norm(c.name) === norm(inv.customer.name)) || inv.customer;
        draft = { customerId: cust.id || "", customer: { ...cust }, date: today(),
          items: inv.items.map(l => ({ key: uid(), name: l.name, hsn: l.hsn, qty: l.qty, rate: l.rate, gst: l.gst, taxIncluded: !!l.taxIncluded })) };
        saveDraft(); location.hash = "#new";
      }
      if (btn.dataset.act === "cancel") {
        if (!confirm(`Cancel ${inv.number}?\n\nThe number will NOT be reused. The bill stays in history marked CANCELLED.`)) return;
        busy(true, "Updating…");
        try {
          inv.status = "cancelled"; inv.cancelledAt = new Date().toISOString();
          if (OD.isSignedIn() && inv.oneDrivePath) await OD.upload(inv.oneDrivePath, await makePdf(inv), "application/pdf");
          await persist(); route();
        } catch (e) { toast(e.message, true); } finally { busy(false); }
      }
    });
  }

  function viewHistory() {
    $("#view").innerHTML = `<h1>Bills</h1>
      <div class="card row">
        <input class="search" id="hSearch" placeholder="Search bill no., customer, phone">
        <input type="month" id="hMonth" style="max-width:180px">
        <span class="spacer"></span><b id="hSum"></b></div>
      <div class="list" id="hList"></div>`;
    const draw = () => {
      const q = norm($("#hSearch").value), m = $("#hMonth").value;
      const list = db.invoices.filter(i => (!m || i.date.startsWith(m)) &&
        (!q || norm(i.number).includes(q) || norm(i.customer.name).includes(q) || norm(i.customer.phone).includes(q))).reverse();
      $("#hList").innerHTML = invoiceRows(list) || '<p class="muted">No bills found.</p>';
      $("#hSum").textContent = `${list.length} bills · ${money(list.filter(i => i.status !== "cancelled").reduce((s, i) => s + i.totals.total, 0))}`;
      bindInvoiceRows();
    };
    $("#hSearch").oninput = draw; $("#hMonth").onchange = draw; draw();
  }

  // ================= CUSTOMERS =================
  function openForm(title, fieldsHtml, onSave) {
    $("#formTitle").textContent = title;
    $("#formBody").innerHTML = fieldsHtml;
    $("#formSave").onclick = () => { if (onSave() !== false) closeModal("formModal"); };
    openModal("formModal");
    const first = $("#formBody input"); if (first) setTimeout(() => first.focus(), 50);
  }
  const fv = id => ($("#" + id).value || "").trim();

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
      const gstin = fv("cGst").toUpperCase();
      if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin)) { toast("GSTIN should be 15 characters", true); return false; }
      const code = $("#cState").value;
      const data = { name: fv("cName"), address: fv("cAddr"), phone: fv("cPhone"), gstin, stateCode: code,
        state: window.INDIAN_STATES.find(s => s[1] === code)[0] };
      if (gstin && gstin.slice(0, 2) !== code && !confirm(`GSTIN starts with ${gstin.slice(0, 2)} but state code is ${code}. Save anyway?`)) return false;
      let saved;
      if (c.id) { saved = Object.assign(db.customers.find(x => x.id === c.id), data); }
      else { saved = { id: uid(), ...data }; db.customers.push(saved); }
      persist(); toast("Customer saved");
      if (after) after(saved); else route();
    });
    // auto-pick state from GSTIN
    $("#cGst").addEventListener("input", e => {
      const code = e.target.value.slice(0, 2);
      if (window.INDIAN_STATES.some(s => s[1] === code)) $("#cState").value = code;
    });
  }

  function viewCustomers() {
    $("#view").innerHTML = `<div class="row"><h1>Customers</h1><span class="spacer"></span><button class="btn primary" id="addC">＋ Add customer</button></div>
      <div class="card"><input class="search" id="cSearch" placeholder="Search name, phone, GSTIN"></div><div class="list" id="cList"></div>`;
    const draw = () => {
      const q = norm($("#cSearch").value);
      const list = db.customers.filter(c => !q || [c.name, c.phone, c.gstin, c.address].some(v => norm(v).includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name));
      $("#cList").innerHTML = list.map(c => `<div class="list-item" data-cid="${c.id}">
        <div class="main"><b>${esc(c.name)}</b><small>${esc(c.address)}</small><small>Ph: ${esc(c.phone || "-")} · GSTIN: ${esc(c.gstin || "-")} · ${esc(c.state)}</small></div>
        <div class="row"><button class="btn small" data-a="bill">New bill</button><button class="btn small" data-a="edit">Edit</button><button class="btn small danger" data-a="del">Delete</button></div></div>`).join("") || '<p class="muted">No customers.</p>';
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
      <div><label>Product code</label><input id="pCode" value="${esc(p.code)}" placeholder="e.g. P044"></div>
      <div><label>HSN code</label><input id="pHsn" value="${esc(p.hsn)}" inputmode="numeric"></div>
      <div class="full"><label>Product name *</label><input id="pName" value="${esc(p.name)}"></div>
      <div><label>Default rate ₹</label><input id="pRate" type="number" step="any" min="0" inputmode="decimal" value="${p.rate}"></div>
      <div><label>GST %</label><select id="pGst">${GST_RATES.map(r => `<option ${Number(p.gst) === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
      <div class="full"><label class="check"><input type="checkbox" id="pIncl" ${p.taxIncluded ? "checked" : ""}> Rate includes tax (GST is inside this price)</label></div>
      <div class="full"><label class="check"><input type="checkbox" id="pAct" ${p.active !== false ? "checked" : ""}> Active (show while billing)</label></div>`, () => {
      if (!fv("pName")) { toast("Product name is required", true); return false; }
      const data = { code: fv("pCode"), name: fv("pName"), hsn: fv("pHsn"), rate: Number(fv("pRate")) || 0,
        gst: Number($("#pGst").value), taxIncluded: $("#pIncl").checked, active: $("#pAct").checked };
      if (p.id) Object.assign(db.products.find(x => x.id === p.id), data); else db.products.push({ id: uid(), ...data });
      persist(); toast("Product saved"); route();
    });
  }

  function viewProducts() {
    $("#view").innerHTML = `<div class="row"><h1>Products</h1><span class="spacer"></span><button class="btn primary" id="addP">＋ Add product</button></div>
      <div class="card"><input class="search" id="pSearch" placeholder="Search name, code, HSN"></div><div class="list" id="pList"></div>`;
    const draw = () => {
      const q = norm($("#pSearch").value);
      const list = db.products.filter(p => !q || [p.name, p.code, p.hsn].some(v => norm(v).includes(q))).sort((a, b) => a.name.localeCompare(b.name));
      $("#pList").innerHTML = list.map(p => `<div class="list-item ${p.active === false ? "cancelled" : ""}" data-pid="${p.id}">
        <div class="main"><b>${p.code ? esc(p.code) + " · " : ""}${esc(p.name)}</b>
          <small>HSN ${esc(p.hsn)} · GST ${p.gst}% · ${p.taxIncluded ? "Rate includes tax" : "Tax added on top"}${p.active === false ? " · inactive" : ""}</small></div>
        <div class="money">₹${p.rate}</div>
        <div class="row"><button class="btn small" data-a="edit">Edit</button><button class="btn small danger" data-a="del">Delete</button></div></div>`).join("") || '<p class="muted">No products.</p>';
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
    const nextSeq = B.nextSeq(db.invoices, fy, s.seqStart);
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
      <div class="row"><button class="btn primary" id="sSave">Save settings</button></div>
      <div class="card" style="margin-top:14px"><h2>Backup</h2>
        <p class="muted">When OneDrive is connected, all data is saved automatically to <b>${esc(CFG.oneDriveFolder)}/Data/billing-data.json</b> and bills to <b>${esc(CFG.oneDriveFolder)}/Invoices/</b>.</p>
        <div class="row"><button class="btn" id="bExp">⬇ Download backup</button>
        <label class="btn" style="margin:0;color:var(--text);font-size:15px;font-weight:400">⬆ Restore backup<input type="file" id="bImp" accept=".json" hidden></label></div></div>`;
    $("#sSave").onclick = () => {
      Object.assign(b, { name: fv("sName"), address: fv("sAddr"), phone: fv("sPhone"), gstin: fv("sGst"), state: fv("sState"), stateCode: fv("sCode") });
      Object.assign(k, { bank: fv("kBank"), accName: fv("kName"), accNo: fv("kNo"), ifsc: fv("kIfsc"), branch: fv("kBr") });
      s.invoicePrefix = fv("nPre") || "DC";
      const n = parseInt(fv("nNext"), 10);
      const used = db.invoices.filter(i => i.fy === fy).map(i => i.seq);
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
  async function start() {
    loadLocal();
    setSync(false);
    $("#btnSignIn").onclick = () => { try { OD.signIn(); } catch (e) { toast(e.message, true); } };
    $("#btnSignOut").onclick = () => OD.signOut();
    try {
      const acc = await OD.init();
      if (acc) {
        $("#btnSignIn").classList.add("hidden"); $("#btnSignOut").classList.remove("hidden");
        $("#btnSignOut").title = OD.userName();
        busy(true, "Loading from OneDrive…");
        await pull();
      }
    } catch (e) { console.error(e); toast("OneDrive: " + e.message, true); setSync(false, "Sync failed"); }
    finally { busy(false); }
    route();
  }
  start();
})();
