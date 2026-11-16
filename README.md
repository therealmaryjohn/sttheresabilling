# ST. THERESA Billing

A billing website for phone and computer. It:

- creates GST tax invoices in your existing ST. THERESA format
- keeps saved **customers** (name, address, phone, GSTIN, state) and **products** (code, name, HSN, rate, GST %)
- has a **"Tax incl."** checkbox on each item:
  - ✅ ticked: the rate already includes GST, so the app works out the tax inside it (₹325 stays ₹325)
  - ☐ not ticked: GST is added on top (₹325 + 5% = ₹341.25)
- picks **CGST + SGST** for Kerala customers and **IGST** for customers in other states
- numbers bills automatically: DC/0025/26-27, DC/0026/26-27, … (starts again from 1 every April)
- saves every bill as a **PDF in Google Drive**, ready to print or download again later
- shows a **🚚 Generate E-Way Bill** button for bills **above ₹50,000** and keeps an **E-Way Bills** folder in Google Drive

---

## Step 1: Put the files on GitHub

1. Sign in at https://github.com and open your repository (or click **New repository** and name it `st-theresa-billing`, **Public**).
2. Click **Add file → Upload files**. Drag **all files and folders** from this zip into it, including `.nojekyll`. Replace the old files, then click **Commit changes**.

> ⚠️ If you already set up Google Drive, open `js/config.js` from this zip and paste your **googleClientId** back in **before** uploading. Otherwise the new file will replace your Client ID with an empty one.

## Step 2: Turn on the website

1. In the repository, open **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)`. Click **Save**.
3. Wait 1–2 minutes. Your address will be `https://YOUR-GITHUB-USERNAME.github.io/st-theresa-billing/`.

## Step 3: Connect Google Drive (one time, free, no card needed)

**A. Project:** go to https://console.cloud.google.com → project selector → **New project** → `ST THERESA Billing` → **Create**, then select it.

**B. API:** search **Google Drive API** → **Enable**.

**C. Sign-in screen:** search **Google Auth Platform** → **Get started**. App name `ST THERESA Billing`, your email, Audience **External**, contact email, tick the agreement box, **Create**.
Then go to **Audience → Test users → + Add users**, add every Gmail that will use the site (for example, `sttheresaarchives@gmail.com`), and click **Save**.

**D. Client ID:** **Clients → + Create client** → **Web application**. Under **Authorised JavaScript origins**, add only `https://YOUR-GITHUB-USERNAME.github.io` (no path, no `/` at the end). Click **Create** and copy the Client ID.

**E. Website:** on GitHub, edit `js/config.js` and set `googleClientId: "....apps.googleusercontent.com",`. Commit, wait 1–2 minutes, then click **Connect Google Drive** on the website.
If Google says *"Google hasn't verified this app"*, click **Continue**.

The app gets permission **only for files and folders it creates itself**.

## E-Way Bill (bills above ₹50,000)

When a bill total is **above ₹50,000**:

1. While you're making the bill, an orange note says **E-Way Bill needed**.
2. After **Generate & Save**, the bill opens with an orange bar that has two buttons:
   - **🚚 Generate E-Way Bill** opens https://ewaybillgst.gov.in/Login.aspx in a new tab.
   - **📁 E-Way Bill folder** opens the Google Drive folder `ST THERESA Billing/E-Way Bills/26-27`.
3. Create the E-Way Bill on the portal and download its PDF.
4. Open the **📁 E-Way Bill folder** and upload the PDF there (**+ New → File upload**).
   Name it after the invoice so it's easy to find, for example `EWB_DC_0025_26-27.pdf`.

Also:
- In **Bills**, such bills have an **E-Way Bill** badge and a **🚚 E-Way Bill** button. Tick **Only E-Way Bill bills** to list just them.
- **Settings → E-Way Bill** lets you change the ₹50,000 limit and open the folder.
- A new folder is made for each financial year automatically (26-27, 27-28, …).

## Daily use

- **⟳ Sync** at the top gets the latest data. Use it when you switch between phone and computer.
- Google's login is valid for about 1 hour. After that, a Google window appears again when you generate a bill or tap Sync.
- **Phone:** open the website in Chrome, then tap **⋮ → Add to Home screen**.
- Allow pop-ups for the website if your browser blocks the Google window.

## Where things are saved in Google Drive

```
ST THERESA Billing/
├── Invoices/
│   └── 26-27/
│       ├── DC_0025_26-27.pdf
│       └── DC_0026_26-27.pdf
├── E-Way Bills/
│   └── 26-27/
│       └── EWB_DC_0025_26-27.pdf   ← you upload these
└── Data/
    └── billing-data.json   ← customers, products, settings, bill history
```

Don't rename or move these folders. The app looks for them by name.

## Good to know

- **Bill numbers:** the next number for 2026-27 is set to **25**, continuing after DC/0024/26-27. You can change this in **Settings → Bill numbering**.
- **Changing a rate:** edit it in **Products**. Old bills keep their original rates and address.
- **New product typed while billing:** it's added to Products automatically.
- **Cancelling a bill:** it stays in the list marked **CANCELLED**, and the number is never reused.
- **Duplicate:** creates a new bill with the same customer and items.
- **Printing:** open the bill, click **🖨 Print**, and choose A4.
- **Backup:** use **Settings → Download backup** for an extra copy.
