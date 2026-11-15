// ===============================================================
//  ST. THERESA Billing - CONFIGURATION
//  Only this file needs editing after you create the Microsoft
//  "App registration" (see README.md, Step 3).
// ===============================================================
window.APP_CONFIG = {
  // Paste the "Application (client) ID" from Azure App registration here.
  // Leave empty to use the app in offline mode (data saved only on this device).
  clientId: "",

  // "common" works for both personal Microsoft (Outlook/Hotmail) and work accounts.
  authority: "https://login.microsoftonline.com/common",

  // Main folder that will be created in your OneDrive
  oneDriveFolder: "ST THERESA Billing"
};
