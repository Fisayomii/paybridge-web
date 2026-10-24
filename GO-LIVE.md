# Going live: PayBridge web + API on Render, with real Paystack, Dojah, OFAC and email

Order matters. Do the parts top to bottom.

```
Part 1  Backend: apply backend-live.patch, push            (GitHub: PayBridge)
Part 2  Accounts: Paystack test keys, Dojah sandbox, Brevo
Part 3  Backend on Render: environment variables, redeploy
Part 4  Frontend: its own GitHub repo, Render Static Site
Part 5  Connect the two (CORS + Paystack callback + webhook)
Part 6  Test everything live from the web app
```

---

## Part 1. Update the backend

From your backend folder (`paybridge`), with this file copied next to it:

```bash
git pull                       # make sure you're on the latest commit
git apply ../paybridge-web/backend-live.patch
./mvnw test                    # or: mvn test
git add -A
git commit -m "Live bank list from Paystack; email alerts over HTTPS"
git push
```

The patch adds:

| Change | Why |
|---|---|
| `GET /api/v1/transfers/banks` (new `BankDirectory`, `TransferGateway.listBanks()`, Paystack `GET /bank?country=nigeria`) | The bank dropdown comes from Paystack instead of a hard-coded list. Cached for 24 hours; if Paystack is down it serves the last good list. In `simulated` mode it serves a short built-in list. |
| `BREVO_API_KEY` option in `NotificationService` | **Render's free plan blocks outgoing SMTP** (ports 25, 465, 587), so Gmail SMTP alerts can never leave a free Render service. With `BREVO_API_KEY` set, alerts go over HTTPS instead. Locally, Gmail SMTP still works as before. |

The CORS change is already in your repo (your commit "added cors configuration for frontend").

> **Zip too large?** Don't zip the project. `node_modules/`, `target/`, `.git/` and `data/` (the OFAC cache) are hundreds of MB. Push to GitHub and share the repo link instead.

---

## Part 2. Get the third-party accounts

### Paystack (test mode)
1. Go to dashboard.paystack.com, switch the toggle at the top to **Test Mode**.
2. **Settings → API Keys & Webhooks**: copy the **Test Secret Key** (`sk_test_…`). You'll paste the webhook URL here in Part 5.
3. On the dashboard's **Transfer approvals** settings (under Settings), untick **"Confirm transfers before sending"**. With that on, every API payout waits for an OTP someone has to type, so automated payouts never complete.

### Dojah (sandbox)
1. Sign up at app.dojah.io and create an app.
2. Copy the **App ID** and the **sandbox Secret Key**.
3. The sandbox test BVN is `22222222222` and it belongs to **John Doe Adamu**. Only a customer whose name matches (register as "John Adamu") gets verified.

### Brevo (email alerts on Render)
1. Sign up at brevo.com (free plan: 300 emails a day).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: add the email you want alerts to come *from* (your Gmail is fine) and click the verification link Brevo emails you.
3. **SMTP & API → API Keys → Generate a new API key**. Copy it (`xkeysib-…`).

---

## Part 3. Backend on Render: environment variables

Render dashboard → your backend service → **Environment**. Set or check:

| Variable | Value | Turns on |
|---|---|---|
| `PAYBRIDGE_PAYMENTS_PROVIDER` | `paystack` | Real Paystack: name enquiry, payouts, checkout, balance, bank list |
| `PAYSTACK_SECRET_KEY` | `sk_test_…` | Same key also verifies webhook signatures |
| `PAYBRIDGE_KYC_PROVIDER` | `dojah` | Real BVN lookups |
| `DOJAH_APP_ID` | your App ID | |
| `DOJAH_SECRET_KEY` | your sandbox secret key | |
| `PAYBRIDGE_OFAC_ENABLED` | `true` (or delete the variable; it defaults to on) | Real OFAC list, about 19,000 names |
| `PAYBRIDGE_FX_FEED_ENABLED` | `true` (or delete it) | Live USD/NGN from open.er-api.com |
| `MAIL_USERNAME` | the sender you verified in Brevo | The "from" address |
| `MAIL_PASSWORD` | your Gmail app password (any value works if you only use Brevo) | Required by the config |
| `BREVO_API_KEY` | `xkeysib-…` | Email alerts over HTTPS |
| `PAYBRIDGE_JWT_SECRET`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `PAYBRIDGE_BOOTSTRAP_ADMIN_*` | as you already have them | |

Leave `PAYBRIDGE_CORS_ORIGINS` and `PAYBRIDGE_FUNDING_CALLBACK_URL` for Part 5, once the frontend has a URL.

Save. Render redeploys. In **Logs**, wait for:

- `Started PayBridgeApplication`
- `USD/NGN mid rate … from OPEN_ER_API`
- `OFAC SDN list loaded from …: 18xxx names` (the first download can take a few minutes)

The OFAC cache lives on Render's disk, which is wiped on every deploy, so each deploy downloads the list again. That's expected.

Open `https://<your-backend>.onrender.com/swagger-ui.html` once to check it's up. This is the only time you need Swagger.

---

## Part 4. Deploy the frontend

### 4.1 Fix the folder nesting
Your copy is `paybridge-web/paybridge-web/…`. Render needs `package.json` at the top of the repo. Use the **inner** folder: the one that directly contains `package.json`, `src/` and `index.html`.

Copy the files from this zip over it (they include the live bank list and the alert-email line). Then delete its `node_modules` folder; Render installs its own.

### 4.2 Push it to GitHub
1. On github.com: **New repository** → name `paybridge-web` → Create (no README).
2. In a terminal, inside the inner `paybridge-web` folder:
   ```bash
   git init
   git add .
   git commit -m "PayBridge web frontend"
   git branch -M main
   git remote add origin https://github.com/Fisayomii/paybridge-web.git
   git push -u origin main
   ```
   Check that `git status` before committing doesn't list `node_modules` (the `.gitignore` excludes it).

### 4.3 Create the Render Static Site
1. Render → **New → Static Site** → connect GitHub → pick `paybridge-web`.
2. Settings:
   - **Branch:** `main`
   - **Root directory:** leave empty
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `dist`
3. **Environment variables → Add:** `VITE_API_URL` = `https://<your-backend>.onrender.com` (no slash at the end).
4. **Create Static Site**. When it finishes, copy its URL, e.g. `https://paybridge-web.onrender.com`.
5. Service → **Redirects/Rewrites → Add rule:** Source `/*`, Destination `/index.html`, Action **Rewrite** → Save.

Static sites on Render are free and don't sleep. Only the backend sleeps.

---

## Part 5. Connect the two

**Backend → Environment:**

| Variable | Value |
|---|---|
| `PAYBRIDGE_CORS_ORIGINS` | `https://paybridge-web.onrender.com` (your exact frontend URL, no trailing slash) |
| `PAYBRIDGE_FUNDING_CALLBACK_URL` | `https://paybridge-web.onrender.com/add-money/complete` |

Save; the backend redeploys.

**Paystack → Settings → API Keys & Webhooks (Test Mode) → Test Webhook URL:**
```
https://<your-backend>.onrender.com/api/v1/webhooks/paystack
```
Save.

The links between the services:
```
web app  ──VITE_API_URL──────────────▶  backend
backend  ──PAYBRIDGE_CORS_ORIGINS────▶  allows the web app
Paystack ──callback URL──────────────▶  web app /add-money/complete
Paystack ──webhook───────────────────▶  backend /api/v1/webhooks/paystack
```

---

## Part 6. Test everything live, from the web app

Open the frontend URL. If the backend was asleep, the first request takes up to a minute, and the app shows "The server is waking up".

### 6.1 Admin: confirm live data
1. Log in as your bootstrap admin → **Settlement**.
2. **Live data** shows **Ready**:
   - OFAC: Loaded *Yes*, about 19,000 names.
   - Rate source: *Live feed (open.er-api.com)*.
3. **Screen name:** type `Osama bin Laden` → a match on `BIN LADIN, Usama`.
4. **Payout liquidity** shows provider *Paystack* and your test balance. The *Simulate payout outcome* button is gone, because the backend is on real Paystack.

### 6.2 Customer: register with a real email
1. Log out → **Create an account**:
   - **Full name:** `John Adamu` (so Dojah's sandbox BVN matches)
   - **Email:** a real inbox you can open, **not** `.local`
2. The home page says *Alerts for money in and out go to …*. A welcome email arrives (check spam the first time).

### 6.3 Dojah BVN
1. **Verify identity** → BVN `22222222222` → **Verify BVN**.
2. You should see *Verified. You're now on tier 2.* Any other name gives *does not match your profile name*. That's the real Dojah answer.

### 6.4 Add money with Paystack checkout
1. **Add money** → ₦5,000 → **Continue to payment** → **Pay ₦5,000.00 on Paystack**.
2. On Paystack's page, choose **Card** and use the test card:
   - Number: `4084 0840 8408 4081`
   - CVV: `408`
   - Expiry: any future date
3. Paystack sends you back to `/add-money/complete`. It shows **Money added**, and a credit alert email arrives.
4. The **Statement** shows the credit.

### 6.5 Live bank list and name enquiry
1. **Send money → To a bank account.**
   - The bank list shows the full set of banks *from Paystack*.
   - Type in the search box to find yours.
2. Enter **your own real account number** at your real bank. Paystack returns your name.
   - Test mode only allows a few real-bank lookups a day (reportedly 3), so don't burn them on typos.
   - Paystack's always-working test account is **Zenith Bank** with account number **0000000000**.
3. Amount ₦1,000, a description → **Send**. Test transfers succeed straight away, so the receipt moves to **Transfer complete**. A debit alert email arrives.
   - No real money moves in test mode.

### 6.6 Wallet-to-wallet with an email alert to the receiver
1. In a private window, register a second customer with another real email.
2. Copy their wallet number from their home page.
3. As John, **Send money → To a PayBridge wallet** → paste the number; the name appears → send ₦500.
4. John gets a **debit** email and the receiver gets a **credit** email. That's the receiver-email notification: it goes to the email the receiver registered with.

### 6.7 Partner remittance with live FX and OFAC
1. Admin → **Customers → Add partner** (real or `.local` email).
2. Log in as the partner. Their page shows the account number `PARTNER-USD-…`.
3. Admin → **Settlement → Book prefund** with that account number, $1,000, bank reference `TEST-WIRE-1`.
4. As the partner, get a quote for $50. Note the countdown and today's live rate.
5. Fill in the sender and recipient:
   - Sender: any name, `US`, ID, address.
   - Recipient: John's wallet.
6. Send. It shows **Delivered**, and John gets a credit email for money from abroad.
7. Send another with sender **Osama bin Laden** → **Held for a compliance review**.
8. Admin → **Review queue** shows the OFAC match → **Reject**.

### 6.8 End of day
Admin → **Settlement → Run integrity check**. All checks should pass.

---

## If something fails

| Symptom | Likely cause |
|---|---|
| Browser console: *blocked by CORS policy* | `PAYBRIDGE_CORS_ORIGINS` doesn't exactly match the frontend URL |
| Requests go to `…static site…/api/…` | `VITE_API_URL` was empty at build time → set it, then **Manual Deploy → Clear build cache & deploy** |
| "Not Found" after refreshing a page | The rewrite rule from 4.3 step 5 is missing |
| Bank list hint says *Showing a short list* | Backend isn't on `paystack`, or `PAYSTACK_SECRET_KEY` is wrong (check the backend logs for `list banks`) |
| Name enquiry error after a few tries | The Paystack test-mode daily lookup limit. Use Zenith `0000000000`, or try tomorrow |
| Payout fails with a balance error | Your Paystack test balance is too low. Admin → Settlement → Payout liquidity shows what Paystack reports |
| Payout stuck on *On its way* | Transfer OTP is still on in Paystack (Part 2), or the webhook URL is wrong. The reconciler also settles it within a few minutes |
| *BVN not found by DOJAH* / 503 | Wrong Dojah keys, or `DOJAH_BASE_URL` points at live instead of sandbox |
| No emails | `.local` address; `BREVO_API_KEY` missing; sender not verified in Brevo (logs say *Brevo refused*); or check spam |
| Live data stuck on *Warming up* | The OFAC download is slow the first time; wait a few minutes or click *Download the list again* |
