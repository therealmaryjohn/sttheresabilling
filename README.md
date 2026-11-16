# ST. THERESA Billing

It's a billing website for ST. THERESA that makes GST tax invoices and keeps billing records in Google Drive. It works on both phone and computer.

## What it does:
- Makes bills: pick a saved customer, type a product code (like P044) or name, enter the quantity, and it works out the totals. Every bill is an A4 tax invoice in your usual format, with the logo as a watermark.
- Handles GST automatically: CGST + SGST for Kerala customers, IGST for other states. A Tax incl. tick box covers rates that already include GST.
- Numbers bills in order: DC/0025/26-27, DC/0026/26-27 and so on, restarting each April. No number is ever skipped or lost.
- Saves to Google Drive: each bill is saved as a PDF in ST THERESA Billing → Invoices, ready to print or download later. Phone and computer share the same data.
- Keeps your lists: saved customers, products P001–P060 and other items with their rates, so you don't retype them.
- Tracks e-way bills: bills over ₹50,000 get a button that opens the E-Way Bill portal, a place to record the e-way bill number and PDF, and a warning when one is missing.
- Lets you edit or delete: any bill can be edited and keeps its number. Only the latest bill can be deleted, so the numbering stays continuous.
- Keeps your history: bills DC/0001–DC/0024 are included. You can search by bill number, customer or e-way bill number, and see totals for today, the month and the year.

It runs on GitHub Pages, and data stays in own Google Drive.

## Included
- Old bills DC/0001–DC/0024. New bills continue from DC/0025/26-27.
- E-way bills linked: DC/0003, DC/0010, DC/0013. DC/0020 shows "E-Way Bill missing".
- Products P001–P060 plus the other products, and 9 customers.
