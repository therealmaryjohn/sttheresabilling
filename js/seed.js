// Starting data taken from the sample invoices DC/0018 to DC/0024 (2026-27).
// Used only on the very first run. After that everything is edited in the app
// and saved in Google Drive.
window.SEED_DATA = {
  settings: {
    business: {
      name: "ST. THERESA",
      address: "Kodakara, Vallappady, Door No.: V/303C, Thrissur - 680 684",
      phone: "9447597838, 9142111884",
      gstin: "32AYMPC2292A1ZZ",
      state: "Kerala",
      stateCode: "32"
    },
    bank: {
      bank: "State Bank of India",
      accName: "ST. THERESA",
      accNo: "44308809801",
      ifsc: "SBIN0015040",
      branch: "KODAKARA"
    },
    invoicePrefix: "DC",
    numberDigits: 4,
    // Next invoice for 2026-27 continues after DC/0024/26-27
    seqStart: { "26-27": 25 },
    // Bills ABOVE this amount (₹) show the E-Way Bill button
    ewayLimit: 50000
  },
  customers: [
    { name: "DEEPIKA PRINTERS", address: "DEEPIKA JUNCTION, KATTAPPANA - 685508", phone: "04868272670", gstin: "32AAGAD6081R2Z9", state: "Kerala", stateCode: "32" },
    { name: "SEBCO I&E PRIVATE LIMITED", address: "66A, MORAIS AVENUE, UDAYAMPATTI ROAD, KK NAGAR, THIRUCHIRAPALLI - 620021", phone: "+919061955534", gstin: "33AAJCS0858A2ZN", state: "Tamil Nadu", stateCode: "33" },
    { name: "CHENNAMPALLIL FURNITURE & PHOTO FRAMES", address: "VETTUKALLEL ARCADE, BHARANANGANAM, PALA - 686578", phone: "+91 9526668231", gstin: "32DGMPM8376J1ZR", state: "Kerala", stateCode: "32" },
    { name: "HOLY CITY", address: "Near Prof. P.C. Thomas Classes, Ambakkadan Jn., Thrissur-5", phone: "0487 - 2320948, 2321959", gstin: "32ADJPJ6264B1ZW", state: "Kerala", stateCode: "32" },
    { name: "CATHOLIC ART CENTRE", address: "Broadway, Ernakulam, Kochi - 682031", phone: "+91 8089007117", gstin: "32AEAPS6518K1ZE", state: "Kerala", stateCode: "32" }
  ],
  // [name, hsn, rate]  - statues come from catalog.js; all at 5% GST, rate excluding tax (as in the sample bills)
  products: [
    ["Candle Stand", "7326", 650],
    ["Tablecloth 1 Meter", "6101", 200],
    ["Tablecloth 1 1/2 Meter", "6101", 300],
    ["Tablecloth 2 Meter", "6101", 400],
    ["Tablecloth 2 1/2 Meter", "6101", 500],
    ["Tablecloth 3 Meter", "6101", 600],
    ["Tablecloth 3 1/2 Meter", "6101", 700],
    ["Tablecloth 4 Meter", "6101", 800]
  ]
};

window.INDIAN_STATES = [
  ["Jammu and Kashmir","01"],["Himachal Pradesh","02"],["Punjab","03"],["Chandigarh","04"],
  ["Uttarakhand","05"],["Haryana","06"],["Delhi","07"],["Rajasthan","08"],["Uttar Pradesh","09"],
  ["Bihar","10"],["Sikkim","11"],["Arunachal Pradesh","12"],["Nagaland","13"],["Manipur","14"],
  ["Mizoram","15"],["Tripura","16"],["Meghalaya","17"],["Assam","18"],["West Bengal","19"],
  ["Jharkhand","20"],["Odisha","21"],["Chhattisgarh","22"],["Madhya Pradesh","23"],["Gujarat","24"],
  ["Dadra and Nagar Haveli and Daman and Diu","26"],["Maharashtra","27"],["Karnataka","29"],
  ["Goa","30"],["Lakshadweep","31"],["Kerala","32"],["Tamil Nadu","33"],["Puducherry","34"],
  ["Andaman and Nicobar Islands","35"],["Telangana","36"],["Andhra Pradesh","37"],["Ladakh","38"]
];
