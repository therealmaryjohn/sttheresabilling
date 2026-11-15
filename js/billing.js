// Pure billing logic: tax, totals, invoice numbers, amount in words.
(function () {
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // Number as printed on the invoice: 5100, 127.5, 895.61 (no trailing zeros)
  const plain = n => String(r2(n));

  // Financial year label for a date string "YYYY-MM-DD" -> "26-27"
  function fyOf(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return String(y % 100).padStart(2, "0") + "-" + String((y + 1) % 100).padStart(2, "0");
  }

  /**
   * One invoice line.
   * taxIncluded = true  -> entered rate already contains GST; it is split out.
   * taxIncluded = false -> entered rate is before GST; GST is added on top.
   */
  function calcLine(item) {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gst = Number(item.gst) || 0;
    const gross = qty * rate;
    let baseRate, taxable;
    if (item.taxIncluded && gst > 0) {
      baseRate = r2(rate / (1 + gst / 100));
      taxable = r2(gross / (1 + gst / 100));
    } else {
      baseRate = r2(rate);
      taxable = r2(gross);
    }
    return { ...item, qty, rate, gst, baseRate, taxable };
  }

  /** Full invoice totals. interState = customer state differs from business state -> IGST. */
  function calcInvoice(items, interState) {
    const lines = items.filter(i => (i.name || "").trim() && Number(i.qty) > 0).map(calcLine);
    const groups = {};
    lines.forEach(l => {
      groups[l.gst] = groups[l.gst] || { rate: l.gst, taxable: 0 };
      groups[l.gst].taxable = r2(groups[l.gst].taxable + l.taxable);
    });
    const slabs = Object.values(groups).sort((a, b) => a.rate - b.rate).map(g => {
      if (interState) {
        const igst = r2(g.taxable * g.rate / 100);
        return { ...g, cgst: 0, sgst: 0, igst, tax: igst };
      }
      const half = r2(g.taxable * g.rate / 200);
      return { ...g, cgst: half, sgst: half, igst: 0, tax: r2(half * 2) };
    });
    const taxable = r2(slabs.reduce((s, g) => s + g.taxable, 0));
    const cgst = r2(slabs.reduce((s, g) => s + g.cgst, 0));
    const sgst = r2(slabs.reduce((s, g) => s + g.sgst, 0));
    const igst = r2(slabs.reduce((s, g) => s + g.igst, 0));
    const tax = r2(cgst + sgst + igst);
    const exact = r2(taxable + tax);
    const total = Math.round(exact);
    const roundOff = r2(total - exact);
    return { lines, slabs, taxable, cgst, sgst, igst, tax, exact, total, roundOff, interState };
  }

  // Indian number system words: One Lakh Five Hundred Forty-Eight Only
  const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function two(n) {
    if (n < 20) return ONES[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  }
  function three(n) {
    const h = Math.floor(n / 100), rest = n % 100;
    return [h ? ONES[h] + " Hundred" : "", rest ? two(rest) : ""].filter(Boolean).join(" ");
  }
  function inWords(amount) {
    let n = Math.round(Math.abs(Number(amount) || 0));
    if (n === 0) return "Zero Only";
    const parts = [];
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh = Math.floor(n / 100000); n %= 100000;
    const thousand = Math.floor(n / 1000); n %= 1000;
    if (crore) parts.push((crore < 1000 ? three(crore) : inWords(crore).replace(" Only", "")) + " Crore");
    if (lakh) parts.push(two(lakh) + " Lakh");
    if (thousand) parts.push(two(thousand) + " Thousand");
    if (n) parts.push(three(n));
    return parts.join(" ") + " Only";
  }

  function invoiceNumber(prefix, seq, digits, fy) {
    return `${prefix}/${String(seq).padStart(digits, "0")}/${fy}`;
  }

  function nextSeq(invoices, fy, seqStart) {
    const used = invoices.filter(i => i.fy === fy).map(i => i.seq);
    const maxUsed = used.length ? Math.max(...used) : 0;
    return Math.max((seqStart && seqStart[fy]) || 1, maxUsed + 1);
  }

  window.Billing = { r2, plain, fyOf, calcLine, calcInvoice, inWords, invoiceNumber, nextSeq };
  if (typeof module !== "undefined") module.exports = window.Billing;
})();
