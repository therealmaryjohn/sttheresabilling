# ST. THERESA Billing

A billing website for phone and computer. It:

- creates GST tax invoices in your existing ST. THERESA format
- keeps saved **customers** (name, address, phone, GSTIN, state) and **products** (code, name, HSN, rate, GST %)
- has a **"Tax incl."** checkbox on each item:
  - ✅ ticked: the rate already includes GST, so the app works out the tax inside it (₹325 stays ₹325)
  - ☐ not ticked: GST is added on top (₹325 + 5% = ₹341.25)
- picks **CGST + SGST** for Kerala customers and **IGST** for customers in other states
- numbers bills automatically: DC/0025/26-27, DC/0026/26-27, … (starts again from 1 every April)
- saves every bill as a **PDF in OneDrive**, ready to print or download again later

---

## Step 1 – Put the files on GitHub

1. Sign in at https://github.com and click **New repository**.
2. Name: `st-theresa-billing`. Choose **Public**. (GitHub Pages is free only for public repositories.)
3. Click **uploading an existing file**. Drag **all files and folders** from this zip into it, including `.nojekyll`. Then click **Commit changes**.

> The repository holds only the website code and starting data. **Your bills and customer list are saved in your OneDrive, not on GitHub.**
> Note: `js/seed.js` contains the starting customers taken from your sample bills. In a public repository anyone can see this file. If you don't want that, empty the `customers: [ ... ]` list before uploading and add the customers in the app instead.

## Step 2 – Turn on the website

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, **Branch** to `main`, and the folder to `/ (root)`. Click **Save**.
3. Wait 1–2 minutes. Your address will be:
   `https://YOUR-GITHUB-USERNAME.github.io/st-theresa-billing/`

The app already works at this point, but data is saved **only on that device**.

## Step 3 – Connect OneDrive (one time)

1. Go to https://portal.azure.com and sign in with the **Microsoft account whose OneDrive should store the bills**.
   Use the business's own account (for example, Outlook/Hotmail), **not** an office or employer account.
   If you're asked to create a free Azure account or directory first, complete that step.
2. Search for **App registrations**, then click **+ New registration**.
   - Name: `ST THERESA Billing`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**
   - Redirect URI: choose **Single-page application (SPA)** and enter your exact website address from Step 2, including the `/` at the end, for example:
     `https://YOUR-GITHUB-USERNAME.github.io/st-theresa-billing/`
   - Click **Register**.
3. Copy the **Application (client) ID**. It looks like `1a2b3c4d-....`
4. On GitHub, open `js/config.js`, click ✏️ **Edit**, paste the ID between the quotes:
   `clientId: "1a2b3c4d-...."`
   and click **Commit changes**.
5. Wait 1–2 minutes, open the website, and click **Connect OneDrive**. Sign in and click **Accept**.

No password or secret key is stored in the code. Microsoft sign-in handles access.

## Using it on your phone

Open the website in Chrome and choose **⋮ → Add to Home screen**. It then opens like an app.
Sign in once on each device (phone and computer). Both devices use the same data from OneDrive.

## Where things are saved in OneDrive

```
ST THERESA Billing/
├── Invoices/
│   └── 26-27/
│       ├── DC_0025_26-27.pdf
│       └── DC_0026_26-27.pdf
└── Data/
    └── billing-data.json   ← customers, products, settings, bill history
```

## Good to know

- **Bill numbers:** the next number for 2026-27 is set to **25**, continuing after DC/0024/26-27. You can change this in **Settings → Bill numbering**.
- **Changing a rate:** edit it in **Products**. Old bills are not changed because each bill stores its own copy of the rates and address.
- **New product typed while billing:** when you generate the bill, it's saved to Products automatically.
- **Cancelling a bill:** the bill stays in the list marked **CANCELLED**, and its number is never used again. The PDF in OneDrive is updated with a CANCELLED stamp.
- **Duplicate:** creates a new bill with the same customer and items. This is useful for repeat orders.
- **Printing:** open the bill, click **🖨 Print**, and choose A4.
- **Backup:** use **Settings → Download backup** for an extra copy.
- **Edit business or bank details:** go to **Settings**. The changes apply to new bills only.
