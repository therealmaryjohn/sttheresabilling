// Bills made BEFORE the billing website (2026-27), copied from the original invoice PDFs.
// Added automatically. Fixed ids, so phone + computer never duplicate them.
// ewb = E-Way Bill details taken from the e-way bill PDFs.
window.OLD_BILLS_VERSION = 3;
(function () {
  const K = (name, address, phone, gstin) => ({ name, address, phone, gstin, state: "Kerala", stateCode: "32" });
  const C = {
    cac: K("CATHOLIC ART CENTRE", "Broadway, Ernakulam, Kochi - 682031", "+91 8089007117", "32AEAPS6518K1ZE"),
    angel: K("ANGEL CREATIONS", "35/238A-1, A-2, A-3, P A BEERAKUTTY ROAD, KOONAMTHAI, EDAPALLY P.O, ERNAKULAM, Kerala - 682024", "+91 9447060719", "32ABJFA9533A1ZU"),
    holy: K("HOLY CITY", "Near Prof. P.C. Thomas Classes, Ambakkadan Jn., Thrissur-5", "0487 - 2320948, 2321959", "32ADJPJ6264B1ZW"),
    crs: K("CATECHETICAL RELIGIOUS STALL", "DBCLC ARCHBISHOP HOUSE, EAST FORT, THRISSUR", "+91 8281784445", "32AABTC8447L1ZJ"),
    stpaul: K("St. Paul Book & Art Centre", "Broadway, Ernakulam - 682031", "+91 8606920850", "32AASCS7293L1ZJ"),
    chenn: K("CHENNAMPALLIL FURNITURE & PHOTO FRAMES", "VETTUKALLEL ARCADE, BHARANANGANAM, PALA - 686578", "+91 9526668231", "32DGMPM8376J1ZR"),
    deepika: K("DEEPIKA PRINTERS", "DEEPIKA JUNCTION, KATTAPPANA - 685508", "04868272670", "32AAGAD6081R2Z9"),
    peedi: K("PEEDIKAYIL BOOK HOUSE", "Parumala p.o, Near Parumala Church, PIN: 689626", "+91 9447356646", "32ABYPT0170D1ZM"),
    sebco: { name: "SEBCO I&E PRIVATE LIMITED", address: "66A, MORAIS AVENUE, UDAYAMPATTI ROAD, KK NAGAR, THIRUCHIRAPALLI - 620021", phone: "+919061955534", gstin: "33AAJCS0858A2ZN", state: "Tamil Nadu", stateCode: "33" }
  };
  window.OLD_CUSTOMERS = Object.values(C);

  const S = "9703";
  const cloth = [["Tablecloth 1 Meter", "6101", 10, 200], ["Tablecloth 1 1/2 Meter", "6101", 10, 300], ["Tablecloth 2 Meter", "6101", 10, 400],
    ["Tablecloth 2 1/2 Meter", "6101", 10, 500], ["Tablecloth 3 Meter", "6101", 10, 600], ["Tablecloth 3 1/2 Meter", "6101", 10, 700],
    ["Tablecloth 4 Meter", "6101", 10, 800]];

  // [seq, date, customer, [[name, hsn, qty, rate, gst?], ...], printed total, ewb?]
  window.OLD_BILLS = [
    [1, "2026-09-02", C.crs, [["Holy Trinity Crucifix Wall Cross 18 Inch", S, 2, 1200], ["Holy Trinity Crucifix Wall Cross 9.5 Inch", S, 4, 495],
      ["Divine Infant Jesus 8.5 Inch", S, 6, 430]], 7308],
    [2, "2026-09-02", C.peedi, [
      ["Sacred Heart Jesus 8 Inch", S, 6, 575], ["Lourd Matha (Ivory) 12 Inch", S, 6, 595], ["Lourd Matha (Colour) 12 Inch", S, 6, 595],
      ["Jesus Risen 12 Inch", S, 6, 595], ["Holy Cross Standing 12 Inch", S, 6, 575], ["Our Lady of Grace 8 Inch", S, 6, 340],
      ["Mother Mary 12 Inch", S, 6, 610], ["Holy Family - 1 8.5 Inch", S, 6, 575], ["Madonna Mary 8.5 Inch", S, 6, 375],
      ["Holy Family - 3 7 inch", S, 6, 350], ["Holy Family - 4 14 Inch", S, 6, 1250], ["Rosa Mystica - 12 Inch", S, 6, 595]], 44289],
    [3, "2026-09-02", C.cac, [
      ["Our lady of Mount Carmel 12 Inch", S, 10, 610], ["Fathima Matha 12 Inch", S, 10, 595], ["St. Antony 8 Inch", S, 10, 325],
      ["Holy Family (3) 7 Inch", S, 10, 350], ["Madona Mary 8.5 Inch", S, 10, 375], ["Mother Mary 12 Inch", S, 10, 610],
      ["Holy Family (1) 8.5 Inch", S, 10, 575], ["St. Joseph (Ivory) 12 Inch", S, 10, 625], ["Lourd Matha (Colour) 12 Inch", S, 10, 595],
      ["Lourd Matha (Ivory) 12 Inch", S, 10, 595], ["Our Lady of Grace (Colour) 12 Inch", S, 10, 595], ["Our Lady of Grace (Ivory) 12 Inch", S, 10, 595],
      ["Our Lady of Grace 8 Inch", S, 10, 340]], 71243,
      { no: "502065554428", date: "2026-09-02", vehicle: "KL24B9036", validUntil: "2026-09-03" }],
    [4, "2026-09-07", C.crs, [["DECO 5 1/4 x 5 1/4", "4420", 153, 75]], 12049],
    [5, "2026-09-07", C.cac, [["Candle Stand", "7326", 75, 85]], 6694],
    [6, "2026-09-16", C.angel, [["CANDLE STAND GLASS", "70139900", 96, 150, 18]], 16992],
    [7, "2026-09-22", C.holy, [
      ["Holy Family (4) - 8 Inch", S, 25, 346.75], ["Holy Family (3) - 8.5 Inch", S, 10, 546.25], ["Our Lady of Grace - 8 Inch", S, 6, 323],
      ["St. Joseph - 13 Inch", S, 10, 593.75], ["Holy Family (1) - 14 Inch", S, 6, 1187.5], ["Holy Family (1) - 14 Inch (Gold)", S, 6, 1187.5],
      ["St. Joseph - 17 Inch", S, 1, 1235], ["St. Joseph - 17 Inch (Gold)", S, 1, 1235], ["Jesus Risen - 16 Inch", S, 1, 1140],
      ["Jesus Risen - 16 Inch (Gold)", S, 1, 1140], ["Lourd Matha - 12 Inch", S, 1, 565.25], ["Lourd Matha - 12 Inch (Gold)", S, 1, 565.25],
      ["Lourd Matha - 17 Inch", S, 1, 1140], ["Lourd Matha - 17 Inch (Gold)", S, 1, 1140], ["Holy Family (2) - 8 Inch", S, 6, 332.5]], 48733],
    [8, "2026-10-01", C.crs, [["Holy Trinity Crucifix Wall Cross 9.5 Inch", S, 12, 495]], 6237],
    [9, "2026-10-02", C.stpaul, [["5 1/4\" x 5 1/4\"", "4420", 154, 77], ["10\" x 13\" Oval Shape", "4420", 24, 390]], 22279],
    [10, "2026-10-12", C.chenn, [["St Joseph 17 Inch", S, 36, 1235], ["Jesus Risen 16 Inch", S, 36, 1140],
      ["Our Lady of Grace 16 Inch", S, 18, 1140], ["Lourd Matha 17 Inch", S, 36, 1140]], 154413,
      { no: "512088139333", date: "2026-10-12", vehicle: "KL24B9036", validUntil: "2026-10-13" }],
    [11, "2026-10-12", C.holy, [["Holy Family 1", S, 10, 1187.5], ["Holy Family 1 - IVORY", S, 10, 1187.5]], 24938],
    [12, "2026-10-12", C.crs, [["Calvary Prayer 12 Inch", S, 6, 875]], 5513],
    [13, "2026-10-15", C.crs, [["Alter Cloth 5 Feet", "6101", 6, 1375], ["Alter Cloth 7 Feet", "6101", 6, 1925], ["Alter Cloth 9 Feet", "6101", 6, 2475],
      ["Tablecloth 1/2 Meter", "6101", 12, 600], ["Tablecloth 2 Meter", "6101", 12, 800], ["Tablecloth 2 1/2 Meter", "6101", 12, 1000],
      ["Tablecloth 3 1/2 Meter", "6101", 12, 1400], ["Tablecloth 4 Meter", "6101", 12, 1600], ["Kappa Urala (Stole)", "6101", 60, 275],
      ["Kappa Urala (Stole) - Double Side", "6101", 12, 350], ["Latin Urala (Stole) - Single Side", "6101", 24, 400]], 136238,
      { no: "572089640353", date: "2026-10-15", vehicle: "KL24B9036", validUntil: "2026-10-16" }],
    [14, "2026-10-15", C.holy, [["Tablecloth 3 Meter", "6101", 12, 1260], ["Kathana", "6101", 200, 40]], 24276],
    [15, "2026-10-15", C.stpaul, [["Candle Stand", "7326", 4, 650], ["Candle Stand", "7326", 4, 625]], 5355],
    [16, "2026-10-17", C.crs, [["Angel Statue", S, 144, 125], ["Angel Statue", S, 192, 95]], 38052],
    [17, "2026-10-23", C.crs, [["Holy Trinity Crucifix wall cross 1 - 18 Inch", S, 6, 1200]], 7560],
    [18, "2026-10-24", C.deepika, [["Candle Stand", "7326", 4, 650], ["Candle Stand", "7326", 4, 625]], 5355],
    [19, "2026-10-29", C.sebco, cloth, 36750],
    [20, "2026-10-31", C.chenn, [
      ["Divine Infant Jesus 8.5 Inch", S, 12, 430], ["Sacred Mary 7 Inch", S, 12, 430], ["Rosa Mystica 8 Inch", S, 18, 325],
      ["Holy Cross Standing 12 Inch", S, 6, 575], ["Holy Family 2 8 Inch", S, 12, 350], ["Holy Family 5 8 Inch", S, 12, 395],
      ["St. Antony 8 Inch", S, 18, 325], ["Our Lady of Grace 8 Inch", S, 18, 340], ["Lourd Matha 8 Inch", S, 36, 340],
      ["St. Joseph 8 Inch", S, 36, 325], ["Fathima Matha 8 Inch", S, 12, 340], ["Velankanni Matha 10 Inch", S, 6, 420],
      ["Infant Jesus 13 Inch", S, 6, 640], ["Sacred Heart of Jesus 8 Inch", S, 24, 595], ["Divine Mercy 8 Inch", S, 6, 325],
      ["Holy Family 6 8 Inch", S, 12, 385]], 100548],
    [21, "2026-10-31", C.holy, [["Holy Trinity Crucifix Wall Cross 1 9.5 Inch", S, 18, 470.25], ["Holy Trinity Crucifix Wall Cross 1 18 Inch", S, 24, 1140]], 37616],
    [22, "2026-10-31", C.cac, [["Infant Jesus 13 Inch", S, 13, 640]], 8736],
    [23, "2026-10-31", C.sebco, cloth, 36750],
    [24, "2026-11-04", C.chenn, [["Holy Trinity Crucifix Wall Cross 9.5 Inch", S, 12, 495], ["Madona Mary 8 Inch", S, 18, 340]], 12663]
  ].map(([seq, date, customer, items, printedTotal, ewb]) => ({
    seq, date, customer, printedTotal, ewb: ewb || null,
    items: items.map(([name, hsn, qty, rate, gst]) => ({ name, hsn, qty, rate, gst: gst || 5, taxIncluded: false }))
  }));
})();
