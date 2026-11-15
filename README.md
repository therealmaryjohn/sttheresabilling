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

---

## Step 1: Put the files on GitHub

1. Sign in at https://github.com and click **New repository**.
2. Name: `st-theresa-billing`. Choose **Public**. (GitHub Pages is free only for public repositories.)
3. Click **uploading an existing file**. Drag **all files and folders** from this zip into it, including `.nojekyll`. Then click **Commit changes**.

> The repository holds only the website code and starting data. **Your bills and customer list are saved in your Google Drive, not on GitHub.**
> `js/seed.js` contains the starting customers from your sample bills. Anyone can see this file in a public repository. If you don't want that, empty the `customers: [ ... ]` list before uploading and add the customers in the app instead.

## Step 2: Turn on the website

1. In the repository, open **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)`. Click **Save**.
3. Wait 1–2 minutes. Your address will be:
   `https://YOUR-GITHUB-USERNAME.github.io/st-theresa-billing/`

## Step 3: Connect Google Drive (one time, free, no card needed)

Use the **Google account whose Drive should store the bills**.

**A. Create a project**
1. Go to https://console.cloud.google.com and sign in.
2. At the top, click the project selector, then **New project**. Name: `ST THERESA Billing`. Click **Create**, then make sure that project is selected.

**B. Turn on Google Drive API**
1. Search at the top for **Google Drive API** and open it.
2. Click **Enable**.

**C. Set up the sign-in screen**
1. Search for **Google Auth Platform** (it may also be called *OAuth consent screen*) and open it. Click **Get started**.
2. App name: `ST THERESA Billing`. User support email: your email.
3. Audience: **External**.
4. Contact email: your email. Tick the agreement box, then click **Create**.
5. Open **Audience**. Under **Test users**, click **+ Add users**, add your Gmail address (and any other staff Gmail addresses), then click **Save**.

**D. Create the Client ID**
1. Open **Clients** (or *Credentials*), then **+ Create client**.
2. Application type: **Web application**. Name: `Billing website`.
3. Under **Authorised JavaScript origins**, click **+ Add URI** and enter **only** the start of your website address. Don't add a path or a `/` at the end:
   `https://YOUR-GITHUB-USERNAME.github.io`
4. Leave *Authorised redirect URIs* empty. Click **Create**.
5. Copy the **Client ID**. It ends with `.apps.googleusercontent.com`.

**E. Put it in the website**
1. On GitHub, open `js/config.js`, click ✏️ **Edit**, and paste it between the quotes:
   `googleClientId: "123456789-abc....apps.googleusercontent.com",`
2. Click **Commit changes**, wait 1–2 minutes, and open the website.
3. Click **Connect Google Drive**, choose your account, tick the permission box, and click **Continue**.
   If Google shows *"Google hasn't verified this app"*, click **Continue**. That's expected for your own private app.

The app gets permission **only for files it creates itself**. It can't see anything else in your Google Drive.

## Daily use

- **⟳ Sync** at the top gets the latest data. Use it when you switch between phone and computer.
- Google's login is valid for about 1 hour. After that, the Google window appears again when you generate a bill or tap Sync. Choose your account and continue.
- **Phone:** open the website in Chrome, then tap **⋮ → Add to Home screen**. It opens like an app.
- Allow pop-ups for the website if your browser blocks the Google window.

## Where things are saved in Google Drive

```
ST THERESA Billing/
├── Invoices/
│   └── 26-27/
│       ├── DC_0025_26-27.pdf
│       └── DC_0026_26-27.pdf
└── Data/
    └── billing-data.json   ← customers, products, settings, bill history
```

Don't rename or move these files or folders in Google Drive. The app looks for them by name.

## Good to know

- **Bill numbers:** the next number for 2026-27 is set to **25**, continuing after DC/0024/26-27. You can change it in **Settings → Bill numbering**.
- **Changing a rate:** edit it in **Products**. Old bills keep their original rates and address.
- **New product typed while billing:** it's added to Products automatically when you generate the bill.
- **Cancelling a bill:** it stays in the list marked **CANCELLED**, and the number is never reused. The PDF in Drive is updated with a CANCELLED stamp.
- **Duplicate:** creates a new bill with the same customer and items. This is handy for repeat orders.
- **Printing:** open the bill, click **🖨 Print**, and choose A4.
- **Backup:** use **Settings → Download backup** for an extra copy.
