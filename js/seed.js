// Starting data (used only on the very first run). After that everything is
// edited in the app and saved in Google Drive.
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
    bank: { bank: "State Bank of India", accName: "ST. THERESA", accNo: "44308809801", ifsc: "SBIN0015040", branch: "KODAKARA" },
    invoicePrefix: "DC",
    numberDigits: 4,
    seqStart: { "26-27": 25 },   // next bill after DC/0024/26-27
    ewayLimit: 50000             // bills ABOVE this need an E-Way Bill
  },
  customers: [],                 // filled from oldbills.js
  // [name, hsn, rate, gst]  - statues come from catalog.js
  products: [
    ["Candle Stand", "7326", 650, 5],
    ["Candle Stand Glass", "70139900", 150, 18],
    ["Tablecloth 1 Meter", "6101", 200, 5],
    ["Tablecloth 1 1/2 Meter", "6101", 300, 5],
    ["Tablecloth 2 Meter", "6101", 400, 5],
    ["Tablecloth 2 1/2 Meter", "6101", 500, 5],
    ["Tablecloth 3 Meter", "6101", 600, 5],
    ["Tablecloth 3 1/2 Meter", "6101", 700, 5],
    ["Tablecloth 4 Meter", "6101", 800, 5],
    ["Alter Cloth 5 Feet", "6101", 1375, 5],
    ["Alter Cloth 7 Feet", "6101", 1925, 5],
    ["Alter Cloth 9 Feet", "6101", 2475, 5],
    ["Kappa Urala (Stole)", "6101", 275, 5],
    ["Kappa Urala (Stole) - Double Side", "6101", 350, 5],
    ["Latin Urala (Stole) - Single Side", "6101", 400, 5],
    ["Kathana", "6101", 40, 5],
    ["Angel Statue", "9703", 125, 5],
    ["Photo Frame 5 1/4\" x 5 1/4\"", "4420", 77, 5],
    ["Photo Frame 10\" x 13\" Oval Shape", "4420", 390, 5],
    ["Madona Mary 8.5 Inch", "9703", 375, 5],
    ["Holy Family 3 7 Inch", "9703", 350, 5]
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
