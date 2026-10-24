# PayBridge web

The React frontend for the PayBridge API. It has three experiences, picked by the role in the login token:

| Role | What they see |
|------|---------------|
| Customer | Balance, send to a PayBridge wallet or a bank account, add money, transfers, statement, saved recipients, BVN verification |
| Partner | USD prefund balance, today's rate, quote with a countdown, travel-rule remittance form, remittance history |
| Admin | Customers (KYC tier, suspend), wallets (freeze, adjust), remittance review queue, settlement (liquidity, FX position, breaks, integrity check, trial balance, prefunds, FX deals, rate publishing) |

Stack: React 18, Vite, React Router, TanStack Query (react-query). Plain CSS, no UI kit. Fonts are bundled, so nothing loads from Google.

---

## Step 1. Let the backend accept calls from a browser (CORS)

A browser on `https://paybridge-web.onrender.com` is blocked from calling `https://paybridge-api.onrender.com` unless the API says that origin is allowed. Your backend has no CORS config yet, so add it.

**Already done in your repo** (commit "added cors configuration for frontend"). For the live bank list and
HTTPS email alerts, apply `backend-live.patch`; see GO-LIVE.md, Part 1. The CORS edits, for reference:

**`src/main/java/com/academy/paybridge/shared/config/SecurityConfig.java`**

Add these imports:

```java
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.time.Duration;
import java.util.Arrays;
```

In `apiSecurity`, right after `.csrf(...)`, add:

```java
                .cors(cors -> {})
```

Then add this bean to the class:

```java
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${paybridge.cors.allowed-origins:http://localhost:5173}") String allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(allowedOrigins.split(","))
                .map(String::trim).filter(o -> !o.isEmpty()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key"));
        config.setAllowCredentials(false);
        config.setMaxAge(Duration.ofHours(1));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
```

**`src/main/resources/application.yml`**, under `paybridge:`:

```yaml
  cors:
    allowed-origins: ${PAYBRIDGE_CORS_ORIGINS:http://localhost:5173}
```

Then run your tests (`./mvnw test`) and commit.

Why `allowCredentials(false)`: the app sends the token in the `Authorization` header, not in a cookie, so the browser never needs to send credentials. `Idempotency-Key` is listed because the browser asks permission for every custom header before sending it.

---

## Step 2. Run it locally

You need Node 18 or newer.

1. Start the backend in sandbox mode. Your `.env` should have:
   ```
   PAYBRIDGE_PAYMENTS_PROVIDER=simulated
   PAYBRIDGE_BOOTSTRAP_ADMIN_EMAIL=admin@paybridge.local
   PAYBRIDGE_BOOTSTRAP_ADMIN_PASSWORD=Admin-pass-2026
   ```
   Then run `./mvnw spring-boot:run`.

2. In this folder:
   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:5173.

In development you don't need CORS at all. `vite.config.js` forwards every `/api/...` request to `localhost:8080`, so the browser sees a single origin.

**To try every screen:**

1. Register Ada and Bola on the sign-up page. Each gets an NGN wallet.
2. As Ada, go to **Add money**, enter ₦20,000, then click **Simulate a successful payment**.
3. Go to **Send money**, enter Bola's wallet number, and check that the app shows his name. Send ₦2,500.
4. Send to a bank account. The simulated provider resolves any 10-digit number. The receipt shows *On its way*.
5. Log in as the admin.
   - On **Settlement**, use **Simulate payout outcome** with that transfer's reference. Ada's receipt updates on its own within a few seconds.
   - Under **Customers**, use **Add partner**.
6. Log in as the partner.
   - The admin has to book a prefund for them first: **Settlement → Book prefund**, using the partner's `PARTNER-USD-…` account number.
   - Then get a quote and send a remittance to Ada's wallet. A sender called *Viktor Sanctionov* lands in the admin's **Review queue**.

---

## Step 3. How the code is built, file by file

Read the files in this order and the app makes sense.

```
src/
  api/client.js        the only code that calls fetch
  api/endpoints.js     every backend endpoint as a named function
  auth/session.js      where the tokens are stored
  auth/AuthContext.jsx login, register, logout, current user
  main.jsx             providers: react-query, router, auth
  App.jsx              routes, and which role may open each one
  components/          Layout (black side rail), ui.jsx (Balance, Status, Field…), ActionDialog
  lib/                 money/date formatting, bank codes, debounce
  pages/               one file per screen; pages/partner and pages/admin by role
  styles.css           the whole look: tokens at the top, then components
```

### 3.1 `api/client.js`: one door to the API

Every request goes through `request()`. It does four jobs:

- **Adds the token.** It sends `Authorization: Bearer <accessToken>`, except on login, register and refresh, which are called with `auth: false`. Sending an expired token to login is what gave you 401s in Swagger; this skips that problem entirely.
- **Refreshes tokens silently.** When a call comes back `401`, it posts the refresh token to `/api/v1/auth/refresh` once, stores the new pair, and retries the call. If several calls fail at the same moment they share one refresh (`refreshInFlight`), because your refresh tokens are single-use and a second refresh would revoke the session. If the refresh fails, it clears the session and the router sends you to the login page.
- **Shows readable errors.** Your `GlobalExceptionHandler` returns `{ "error": "..." }`, and that message is what users see.
- **Explains cold starts.** If a call takes over 6 seconds it fires `pb:slow`, and `Layout` shows "The server is waking up". Render's free plan sleeps after 15 idle minutes.

`pageOf()` reads Spring's `Page` responses in both formats (`{content, totalPages}` and the newer `{content, page: {...}}`), so a Spring Data upgrade won't break the pager.

### 3.2 `api/endpoints.js`: the API, named

There's one function per controller method, with the same paths and request bodies. When you add an endpoint to the backend, add one line here.

### 3.3 `auth/`: sessions

`session.js` keeps `{ accessToken, refreshToken, customer }` in `localStorage` and announces every change with a `pb:session` event. `AuthContext` listens for that event, so a token refresh or an expired session updates the UI everywhere.

`homeFor(role)` sends customers to `/`, partners to `/partner` and admins to `/admin`.

### 3.4 `App.jsx`: routes guarded by role

`RequireRole` mirrors your `SecurityConfig` rules. A partner who types `/send` is sent back to `/partner` instead of seeing a page full of 403 errors.

### 3.5 Pages, and the money-safety ideas in them

- **Idempotency keys** (`SendMoney`, `AddMoney`, `PartnerHome`, admin adjustments). A key is created when the form opens, kept if a request fails, and replaced only after success. If the network drops and the user presses Send again, your backend gets the same key and returns the original transfer instead of paying twice.
- **Name enquiry before paying** (`SendMoney`). After 10 digits, it calls `/accounts/lookup` for a wallet or `/transfers/banks/resolve` for a bank account, and shows "Sending to CHIDI OKEKE". The Send button stays disabled until a name comes back.
- **Fee quote as you type.** `/transfers/fees` is called through `useDebounced`, so it fires once you stop typing, not on every key.
- **Polling bank payouts** (`TransferDetail`). While the status is `PENDING` or `PROCESSING`, react-query refetches every 4 seconds. It stops by itself when the webhook or the reconciler settles the payout.
- **Sandbox awareness** (`AddMoney`). If the checkout URL is the simulated one, the page offers "Simulate a successful payment" instead of a Paystack link.
- **Paystack return page** (`FundingComplete`, at `/add-money/complete`). This page calls `/fundings/{reference}/verify` when Paystack redirects back.
- **Audited admin actions** (`ActionDialog`). Every admin change asks for the reason your API requires and then refreshes the affected list.

### 3.6 `styles.css`: the look

- **Base colours:** black and white.
- **Green** (`#008751`, the flag green) means money arriving or a finished success.
- **Amber** means waiting; **red** means failed or blocked.
- **Fonts:** Bricolage Grotesque for headings and the oversized balance (kobo set small), Public Sans for everything else.
- **Mobile:** below 860px wide, the black side rail becomes a top bar with scrollable tabs.

---

## Step 4. Put it on GitHub

Keep the frontend in its own repo so Render can build each part separately.

```bash
cd paybridge-web
git init
git add .
git commit -m "PayBridge web frontend"
git branch -M main
git remote add origin https://github.com/<you>/paybridge-web.git
git push -u origin main
```

(Create the empty `paybridge-web` repo on GitHub first.)

---

## Step 5. Deploy the frontend to Render (Static Site)

1. In Render, go to **New → Static Site** and pick the `paybridge-web` repo.
2. Use these settings:
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `dist`
3. Under **Environment**, add `VITE_API_URL` = your backend URL, for example `https://paybridge-api.onrender.com`. Don't include a trailing slash.
4. Under **Redirects/Rewrites**, add a rule: source `/*`, destination `/index.html`, action **Rewrite**. Without it, refreshing on `/transfers` gives "Not Found", because that file doesn't exist on the server and React Router has to handle the path.
5. Click **Create Static Site**. You get a URL like `https://paybridge-web.onrender.com`.

Instead of steps 1–4, you can use **New → Blueprint**: `render.yaml` in this repo already holds these settings, including the rewrite.

`VITE_` variables are baked in **when the site builds**. If you change `VITE_API_URL`, trigger a new deploy (Manual Deploy → Clear build cache & deploy) for it to take effect.

---

## Step 6. Connect the backend to the frontend

On the **backend** service in Render, open **Environment** and add:

| Variable | Value |
|---|---|
| `PAYBRIDGE_CORS_ORIGINS` | `https://paybridge-web.onrender.com` (your exact frontend URL, no trailing slash). Add `,http://localhost:5173` if you also develop against the live API. |
| `PAYBRIDGE_FUNDING_CALLBACK_URL` | `https://paybridge-web.onrender.com/add-money/complete`. This is where Paystack sends customers after paying. |

Save the variables; Render restarts the backend. Then:

1. Open the frontend URL and log in. The first request may take up to a minute while the backend wakes up; the app says so.
2. If login fails, open the browser dev tools (F12), go to the **Console** tab, and match the message against the table below.

The two services must agree in both directions:

```
frontend VITE_API_URL           ──>  https://paybridge-api.onrender.com
backend  PAYBRIDGE_CORS_ORIGINS ──>  https://paybridge-web.onrender.com
```

---

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Console: *blocked by CORS policy: No 'Access-Control-Allow-Origin'* | The frontend's URL isn't in `PAYBRIDGE_CORS_ORIGINS`, or Step 1 isn't deployed | Check the exact origin: `https` vs `http`, and no trailing slash |
| Requests go to `paybridge-web.onrender.com/api/...` and fail | `VITE_API_URL` was empty when the site was built | Set it, then **Clear build cache & deploy** |
| "Not Found" when refreshing a page | The rewrite rule is missing | Add `/*` → `/index.html` (Rewrite) |
| Every page sends you back to login | The refresh token was used twice, or the JWT secret changed between backend deploys | Log in again; keep `PAYBRIDGE_JWT_SECRET` fixed on Render |
| *Simulate payment* returns 404 | The backend runs with `PAYBRIDGE_PAYMENTS_PROVIDER=paystack`; the simulation endpoints only exist in sandbox mode | Expected in production. Use real Paystack test cards |
| First load takes ~50 seconds | Render's free plan wakes from sleep | Normal; a paid instance stays awake |

---

## Notes and next steps

- **Token storage.** Tokens are in `localStorage`, which is fine for a project but readable by any script on the page. A production bank would keep the refresh token in an `httpOnly` cookie, which needs backend changes (and CORS `allowCredentials(true)`).
- **Bank list.** `src/lib/banks.js` lists common Nigerian banks. For the full list, add a backend endpoint that proxies Paystack's `GET /bank?country=nigeria`.
- **TypeScript.** The code is plain JavaScript to keep it short. To convert it, rename files to `.tsx` and add types for the DTOs (`AccountDto`, `TransferDto`…).
