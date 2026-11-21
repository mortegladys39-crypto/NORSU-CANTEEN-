NORSU CANTEEN - GITHUB PAGES + FIREBASE SETUP
================================================

FILES
-----
index.html       Customer ordering page
style.css        Original cream/green design styling
script.js        Customer cart, checkout, and live order tracking
admin.html       Owner login and dashboard
admin.js         Product upload and order management
firebase.js      Firebase configuration and SDK imports
products.js      The 23 starter products and latest prices
firestore.rules  Database security rules
storage.rules    Product image security rules

IMPORTANT NOTES
---------------
1. Replace the Firebase config placeholders in firebase.js.
2. Replace REPLACE_WITH_YOUR_OWNER_EMAIL in admin.js, firestore.rules, and storage.rules.
   Use the exact same owner email in all three files.
3. Do not publish the Firebase service-account private key. This project does not need one.
4. GitHub Pages is a static host. Firebase provides the database, authentication, and storage.
5. The old localStorage picture uploads are browser-local base64 data. They cannot automatically
   become shared Firebase Storage images. Re-upload them once from the new owner dashboard.
6. The customer page uses anonymous Firebase Authentication so each browser can track its own
   orders. Customers cannot read other customers' orders through the provided rules.
7. GCash details are displayed as supplied. Confirm the recipient name and number before taking
   real payments. The website does not verify a GCash transfer; the owner checks the reference.

STEP 1 - CREATE FIREBASE PROJECT
-------------------------------
1. Open https://console.firebase.google.com/
2. Sign in and choose Add project.
3. Name it NORSU-CANTEEN.
4. Finish the project creation steps.
5. In Project Overview, click the Web icon (</>) to add a Web App.
6. App nickname: NORSU CANTEEN.
7. Register the app.
8. Copy the Firebase web configuration object shown.
9. Open firebase.js and replace the placeholder values in firebaseConfig.
   Keep the quotes and commas. Do not paste a service account key.

STEP 2 - ENABLE AUTHENTICATION
------------------------------
1. Firebase Console > Build > Authentication.
2. Click Get started.
3. Open Sign-in method.
4. Enable Email/Password.
5. Also enable Anonymous.
6. Save.

STEP 3 - CREATE OWNER ACCOUNT
-----------------------------
1. Authentication > Users > Add user.
2. Enter the owner's email and a strong password.
3. Create the user.
4. Verify the email if Firebase sends a verification email.
5. Copy that exact email into:
   - admin.js: OWNER_EMAIL
   - firestore.rules: REPLACE_WITH_YOUR_OWNER_EMAIL
   - storage.rules: REPLACE_WITH_YOUR_OWNER_EMAIL
6. Replace the placeholder with the actual email, including quotes.
7. Do not put your password in any website file.

STEP 4 - CREATE FIRESTORE DATABASE
----------------------------------
1. Firebase Console > Build > Firestore Database.
2. Click Create database.
3. Choose Production mode.
4. Select a database location near your users, if available.
5. Create the database.
6. Open the Rules tab.
7. Replace the rules with the content of firestore.rules.
8. Replace the owner email placeholder.
9. Publish the rules.

STEP 5 - ENABLE FIREBASE STORAGE
--------------------------------
1. Firebase Console > Build > Storage.
2. Click Get started and follow the setup.
3. Open Storage > Rules.
4. Replace the rules with storage.rules.
5. Replace the owner email placeholder.
6. Publish the rules.
Note: Firebase Storage availability and billing requirements depend on your Firebase project
and current Google plan. Follow the console's prompts if a billing upgrade is required.

STEP 6 - PUBLISH THE STARTER MENU
---------------------------------
1. Upload all website files to the same GitHub repository folder:
   index.html, admin.html, style.css, script.js, admin.js, firebase.js, products.js.
2. Keep your images folder too, if you have it:
   images/1-cheeseburger.jpg, images/2-chicken-burger.jpg, etc.
3. Open the deployed website's admin.html page.
4. Sign in with the owner email and password.
5. Click "Publish Starter Menu (23 products)".
6. The 23 products and latest prices will be written to Firestore.
7. Upload any missing food pictures through the admin picture manager.

STEP 7 - ENABLE GITHUB PAGES
----------------------------
1. Open your GitHub repository.
2. Go to Settings > Pages.
3. Under Build and deployment, choose Deploy from a branch.
4. Choose branch main and folder /(root), then Save.
5. Wait for GitHub Pages to publish.
6. Your site URL will look like:
   https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/
7. Open that URL and test the customer page.
8. Admin page:
   https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/admin.html

STEP 8 - AUTHORIZE YOUR GITHUB DOMAIN IN FIREBASE
-------------------------------------------------
1. Firebase Console > Authentication > Settings > Authorized domains.
2. Add your GitHub Pages hostname, for example:
   YOUR-GITHUB-USERNAME.github.io
   Do not include https:// or the repository path.
3. Save.

STEP 9 - TEST
-------------
1. Open the customer page in one browser/device and place a test order.
2. Open admin.html and sign in as the owner on another browser/device.
3. Confirm the order appears.
4. Change it to Preparing, then Ready.
5. Return to the customer browser and confirm the status changes.
6. Test Cash and GCash form validation.
7. Test product image upload and confirm the image appears on the customer page.

TROUBLESHOOTING
---------------
- "auth/unauthorized-domain": add your github.io hostname to Firebase Authentication
  Authorized domains.
- "Missing or insufficient permissions": check that the owner email in all rules and admin.js
  matches the Firebase Authentication account exactly, and republish the rules.
- Menu shows starter data but admin sees no products: sign in as owner and publish the starter menu.
- Image upload fails: confirm Firebase Storage is initialized, Storage rules are published,
  and your Firebase project meets Storage's current plan requirements.
- Blank page/module errors: make sure all .js files are uploaded to the same folder and opened
  through the GitHub Pages HTTPS URL, not by opening index.html as a local file.
- Product images not found: preserve the images/ folder and exact filenames, or upload pictures
  from the admin panel.

SECURITY / PAYMENT NOTES
------------------------
- The owner email is an identifier, not a password. The actual permission check is enforced by
  Firebase Security Rules and Firebase Authentication.
- Never use test mode / allow read, write: if true rules for a live ordering site.
- Customer orders are not payment-verified. For GCash, owner must confirm the payment separately.
- Do not store card details, passwords, or private credentials in Firestore.
- The provided rules limit customer order reads to their own anonymous-auth UID. This is suitable
  for a basic project demo, but production systems should add server-side validation / App Check
  and stricter rate limiting to reduce spam.
