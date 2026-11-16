// Product catalogue P001 - P060. Rates before GST (5%), HSN 9703.
// rate 0 = no price in the catalogue - set it in Products.
window.CATALOG_VERSION = 1;
window.CATALOG = [
  ["P001","Divine Infant Jesus","8.5",430],["P002","Sacred Mary 1","7",430],["P003","Sacred Mary 2","7",430],
  ["P004","Rosa Mystica 1","8",325],["P005","Rosa Mystica 2","12",595],["P006","Rosa Mystica Ivory","12",595],
  ["P007","Holy Cross Standing 1","16",1100],["P008","Holy Cross Standing 2","12",575],["P009","Holy Family 1","14",1250],
  ["P010","Holy Family Ivory","14",1250],["P011","Holy Family 2","8",350],["P012","Holy Family 3","8.5",575],
  ["P013","Holy Family 4","8",365],["P014","Holy Family 5","8",395],["P015","Holy Family 6","8",385],
  ["P016","St. Anthony","8",325],["P017","Blessing Christ","12",625],["P018","Blessing Christ Ivory","12",625],
  ["P019","Jesus Risen 1","12",595],["P020","Jesus Risen Ivory","12",595],["P021","Jesus Risen 2","16",1200],
  ["P022","Our Lady of Grace 1","8",340],["P023","Our Lady of Grace 2","12",595],["P024","Our Lady of Grace 3","16",1200],
  ["P025","Lourd Matha 1","8",340],["P026","Lourd Matha 2","12",595],["P027","Lourd Matha Ivory","12",595],
  ["P028","Lourd Matha 3","17",1200],["P029","St. Joseph 1","8",325],["P030","St. Joseph 2","12",625],
  ["P031","St. Joseph Ivory","12",625],["P032","St. Joseph 3","17",1300],["P033","Infant Jesus 1","13",640],
  ["P034","Infant Jesus 2","16",1200],["P035","Madona Mary 1","8",340],["P036","Madona Mary 2","12",595],
  ["P037","Mother Mary","12",610],["P038","Fatima Matha 1","8",340],["P039","Fatima Matha 2","12",595],
  ["P040","Our Lady of Mount Carmel","12",610],["P041","Velankanni Matha 1","10",420],["P042","Velankanni Matha 2","12",610],
  ["P043","Sacred Heart of Mary","12",595],["P044","Sacred Heart Jesus","8",325],["P045","Jesus Heart (Half)","8",575],
  ["P046","Jesus Heart (Half) Ivory","8",575],["P047","Divine Mercy","8",325],["P048","Immaculate Heart of Mary","8",325],
  ["P049","Baby Infant Jesus","5",0],["P050","Holy Trinity Crucifix Wall Cross 1","9.5",495],
  ["P051","Holy Trinity Crucifix Wall Cross 2","9.5",495],["P052","Holy Trinity Crucifix Wall Cross 3","9.5",495],
  ["P053","Holy Trinity Crucifix Wall Cross 4","9.5",495],["P054","Holy Trinity Crucifix Wall Cross 1","18",1200],
  ["P055","Holy Trinity Crucifix Wall Cross 2","18",1200],["P056","Holy Trinity Crucifix Wall Cross 3","18",1200],
  ["P057","Holy Trinity Crucifix Wall Cross 4","18",1200],["P058","Calvary Prayer","12",875],
  ["P059","Crib Set Color","8",0],["P060","Crib Set Ivory","8",0]
].map(([code, name, size, rate]) => ({ code, name: `${name} ${size} Inch`, hsn: "9703", rate, gst: 5, taxIncluded: false }));

// Old starter statue names (no product code) that this catalogue replaces.
window.CATALOG_REPLACES = ["Divine Infant Jesus 8.5 Inch","Sacred Mary 7 Inch","Rosa Mystica 8 Inch","Holy Cross Standing 12 Inch",
  "Holy Family 2 8 Inch","Holy Family 5 8 Inch","Holy Family 6 8 Inch","St. Antony 8 Inch","Our Lady of Grace 8 Inch",
  "Lourd Matha 8 Inch","St. Joseph 8 Inch","Fathima Matha 8 Inch","Velankanni Matha 10 Inch","Infant Jesus 13 Inch",
  "Sacred Heart of Jesus 8 Inch","Divine Mercy 8 Inch","Madona Mary 8 Inch","Holy Trinity Crucifix Wall Cross 9.5 Inch",
  "Holy Trinity Crucifix Wall Cross 18 Inch"];
