# ST. THERESA Billing

## Update steps
1. Open `js/config.js` from this zip and paste your **googleClientId** back in. The file in this zip has it empty.
2. Upload **all** files and folders to GitHub, replacing the old ones. Include the new **img** folder (`img/logo.png`).
3. Open the site and press **Ctrl + F5** (on a phone, close and reopen the page) to load the new version.

## Bill layout
- Exactly one A4 page (210 × 297 mm) with even ~10 mm margins. The item box stretches to fill the page.
- The ST. THERESA logo is printed faintly in the middle as a watermark.
  To change how dark it is, edit `watermarkOpacity` in `js/config.js` (0.10 is the default; 0.15 is darker).
  To change the logo, replace `img/logo.png`.
- The signature box ("For ST. THERESA … Authorised Signatory") is centred.
- When printing, choose **A4**, margins **None/Default**, and turn on **Background graphics** if the watermark doesn't show.

## Edit and Delete (no bill number is ever lost)
- **✏️ Edit** works on any bill, old or new. Change the customer, date (within the same financial year), items or rates.
  The bill **keeps its number**, and the new PDF replaces the old one in Google Drive. E-way bill details stay linked.
- **🗑 Delete** works only on the **latest** bill (for example, DC/0026 when it's the last one).
  Its number is given to the next new bill, so the series stays continuous. The PDF moves to the Google Drive bin.
- Older bills can't be deleted. Use **✏️ Edit** and reuse the number for the correct bill.
- The old **Cancel** option has been removed.

## Included
- Old bills DC/0001–DC/0024. New bills continue from DC/0025/26-27.
- E-way bills linked: DC/0003, DC/0010, DC/0013. DC/0020 shows "E-Way Bill missing".
- Products P001–P060 plus the other products, and 9 customers.
