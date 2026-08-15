# Affiliate Program Setup Guide

Covers the six shopping affiliate programs ButlerOS integrates against: Amazon
Associates, Rakuten Advertising, Skimlinks, Walmart, Best Buy, and Target.
Pair this with `INTEGRATIONS.md` for API-level details (auth, rate limits, env
vars) — this doc is about the *account setup and link-generation* side.

---

## 1. Amazon Associates

**Sign up:**
1. Go to https://affiliate-program.amazon.com/ and sign in with (or create) an Amazon account.
2. Add your website/app/social presence — Amazon requires a live, reviewable property before approval.
3. Enter your preferred **Associate ID (tracking tag)**, e.g. `butleros-20`.
4. Complete tax interview and payment info (bank account or Amazon gift card payout).
5. Amazon typically grants provisional approval immediately, but you must generate **3 qualifying sales within 180 days** or the account is closed.

**⚠️ 2026 change to be aware of:** the classic Product Advertising API (PA-API) is being sunset (May 15, 2026) in favor of the new **Creators API**, and both require **10 qualified referral sales in the trailing 30 days** to get/keep programmatic product-data access. A brand-new site will not have API access on day one — see `INTEGRATIONS.md` for the recommended workaround (use Rakuten/Skimlinks link-rewriting for Amazon links until you clear that bar).

**Generating affiliate links (no API needed):**
- Manually: append `?tag=YOUR_ASSOCIATE_ID` to any `amazon.com` product URL.
  ```
  https://www.amazon.com/dp/B08N5WRWNW?tag=butleros-20
  ```
- Via SiteStripe (Amazon's browser toolbar for Associates) for one-off links.
- Programmatically (once API-eligible): PA-API `SearchItems`/`GetItems` responses include a `DetailPageURL` that already has your tag appended.

**Storing the credential:** `AMAZON_ASSOC_KEY` (associate tag) and, once eligible, `AMAZON_CREATORS_API_KEY` — see [Secure storage](#secure-storage-of-affiliate-ids) below.

---

## 2. Rakuten Advertising

**Sign up:**
1. Go to https://rakutenadvertising.com/ and click **Become a Publisher**.
2. Fill out the publisher application (site/app details, promotional methods, audience).
3. Approval is typically fast for legitimate sites; you'll get a **Publisher ID**.
4. Log into the Publisher Dashboard, open the nine-dot menu → **Developer Portal** (or go directly to https://developers.rakutenadvertising.com/ and sign in with your dashboard credentials).
5. In the Developer Portal, create an **Application** — this issues a **Client ID** and **Client Secret**.
6. Individually apply to join each retailer's affiliate program inside the dashboard (e.g., search for "Best Buy," "Macy's," etc. and click Join) — Rakuten is a network of many merchant programs, not one blanket relationship.

**Generating affiliate links:**
- Use the **Link Locator** in the dashboard to hand-generate a tracked link for any joined merchant.
- Programmatically: call the Product Search / Link Generation endpoints with your API token to build links dynamically, e.g.
  ```
  GET https://api.linksynergy.com/productsearch/1.0?keyword=headphones&token={token}
  ```
  The response includes a `linkurl` field that's already tracked to your Publisher ID.

**Tracking conversions:** Rakuten's dashboard shows clicks, orders, and commissions per merchant, updated daily. Use the **Advanced Reports API** (`GET /reports`) to pull conversion data programmatically instead of manual CSV export.

**Storing the credential:** `RAKUTEN_KEY` (store the Client Secret / access token, not the Client ID alone — see below).

---

## 3. Skimlinks

**Sign up:**
1. Go to https://skimlinks.com/ and click **Sign Up** (publisher signup is free and self-serve).
2. Add your site/app.
3. You'll receive a **Publisher ID** immediately — no manual review gate for basic access, though payouts may require additional verification.

**Generating affiliate links:**
- The simplest approach: drop Skimlinks' JavaScript snippet on any customer-facing page and it auto-rewrites outbound merchant links to tracked Skimlinks links at click-time. Not applicable to a headless backend like ButlerOS's API server.
- For server-side link generation (what ButlerOS needs), use the **Skimlinks API**: pass a raw merchant URL to their link-generation endpoint and get back a tracked redirect URL, e.g.
  ```
  https://go.skimresources.com?id=PUBLISHER_ID&url=https://www.some-retailer.com/product/123
  ```
- Skimlinks auto-detects which of its thousands of merchant programs the destination domain belongs to — you don't need a separate approval per retailer like Rakuten.

**Tracking conversions:** Skimlinks' dashboard reports clicks/sales per domain. There's also a reporting API for programmatic pulls.

**Storing the credential:** `SKIMLINKS_KEY` (Publisher ID).

---

## 4. Walmart

**Sign up:**
1. Go to https://affiliates.walmart.com/.
2. Apply through the **Impact**-powered application (Walmart's affiliate program runs on the Impact platform, not a Walmart-branded dashboard).
3. Approval is fast — typically within ~24 hours.
4. Once approved, log into your Impact account to get your **Account SID** and **Auth Token** (used for both reporting and link generation via Impact's API).

**Generating affiliate links:**
- Manually: use Impact's **Deep Link Generator** inside the dashboard — paste any `walmart.com` product URL, get back a tracked link.
- Programmatically: call Impact's Reporting/Media API with your Account SID + Auth Token to generate tracked links at scale.
- Note: separate from the affiliate link program, `developer.walmart.com` also hosts Marketplace/Item APIs for structured product data, but those require an approved seller/partner relationship — not the same signup as the affiliate program.

**Tracking conversions:** Impact's dashboard shows clicks/orders/commission per campaign; Walmart's standard commission is roughly 1–4% depending on category, paid out via Impact (PayPal or direct deposit), typically around the 15th of the month for the prior month.

**Storing the credential:** `WALMART_KEY` plus the shared `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN` (Impact credentials are reused for Target below, since both run on the same network).

---

## 5. Best Buy

**Sign up:**
1. Go to https://developer.bestbuy.com/.
2. Create a developer account and register an application to get an **API key** — this is a straightforward self-serve signup, distinct from an "affiliate" program (Best Buy's product API is free to query; monetization typically happens by also joining Best Buy's affiliate program on a network like Rakuten Advertising for the tracked-link/commission side).
3. If you want commission tracking (not just product data), separately join **Best Buy's affiliate program through Rakuten Advertising** (see section 2) — Best Buy runs its affiliate program there rather than in-house.

**Generating affiliate links:**
- Product data comes from the Best Buy Developer API (`api.bestbuy.com`); the product URLs returned are not pre-tracked.
- To monetize, pass the Best Buy product URL through your Rakuten-generated tracked link for the Best Buy merchant program.

**Tracking conversions:** Handled through Rakuten Advertising's reporting (see section 2), since that's where the commission relationship lives.

**Storing the credential:** `BESTBUY_KEY` (developer API key) — commission tracking uses your existing `RAKUTEN_KEY`.

---

## 6. Target

**Sign up:**
1. Go to https://partners.target.com/ and click **Apply Now**.
2. This routes to an **Impact**-powered application — same underlying network as Walmart.
3. Fill in personal info, company/site info, and your promotional channels (website URL, social handles, etc.).
4. Free to join; approval criteria favor a professional, on-brand site.

**Generating affiliate links:**
- Same mechanism as Walmart: use Impact's Deep Link Generator (manual) or Media/Reporting API (programmatic) with your Impact Account SID/Auth Token to wrap any `target.com` product URL.

**Tracking conversions:** Impact dashboard, same as Walmart. Commission is up to ~8% in qualifying categories; 0% on groceries, electronics, toys, pets, sporting goods, and books.

**Note on "Club Target":** in May 2026 Target launched a separate, points-based creator rewards program (500+ social followers, gamified rewards) called Club Target. That program is unrelated to — and not a replacement for — the Impact-based affiliate program described above; ButlerOS should use the classic Impact program for product links.

**Storing the credential:** `TARGET_AFFILIATE_ID` plus the shared `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN`.

---

## How affiliate link generation fits into ButlerOS

`src/integrations/shopping.ts`'s `getAffiliateLink(productId)` is the single choke
point where all of this lands. In production, the real implementation should:

1. Look up which retailer the product belongs to (`amazon`, `walmart`, `bestbuy`, `target`, or "other").
2. Route Amazon links through the Associates tag (or Skimlinks as a fallback if the 10-sale API bar isn't cleared yet).
3. Route Walmart/Target links through Impact's Deep Link API.
4. Route Best Buy links through Rakuten Advertising.
5. Route anything else through Skimlinks, which auto-detects the merchant.

That keeps the orchestrator and routes layer retailer-agnostic — they just call `getAffiliateLink()` and get back a working tracked URL regardless of which network handled it underneath.

---

## Tracking conversions (general pattern)

Every network above works the same way at a high level:

1. A user clicks a ButlerOS-generated affiliate link, which redirects through the network's tracking domain (e.g., `linksynergy.com`, `go.skimresources.com`, Impact's tracking domain) before landing on the retailer.
2. The network drops a cookie (windows vary: Amazon ~24 hours, Walmart ~3 days, Target ~7 days basket-wide) attributing any purchase in that window to your account.
3. The retailer reports the sale back to the network, which credits your account and exposes it via their dashboard/reporting API.
4. Pull conversion data periodically (daily is typical) via each network's reporting API and store it alongside the original `ButlerResults` request that generated the link, so ButlerOS can eventually show "Isabella earned you $X in rewards" or similar back to the user if desired.

Because cookie windows are short (hours to about a week), ButlerOS should generate affiliate links at the moment of recommendation, not pre-generate and cache them for long periods.

---

## Secure storage of affiliate IDs

None of these credentials should ever be committed to source control or hardcoded in `apiClients.ts`. Recommended handling, in increasing order of production-readiness:

1. **Local dev:** `.env` file (already gitignored — see `.env.example` for the full variable list) loaded via `dotenv`.
2. **Staging/production:** a secrets manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, or your host's built-in environment variable encryption, e.g. Render/Fly/Heroku config vars) rather than plaintext `.env` files on disk.
3. **Rotation:** treat affiliate/API credentials like any other secret — rotate them if a key ever appears in a log, error message, or client-side bundle. Several of these (Rakuten, Impact) let you regenerate a token without losing your account history.
4. **Least privilege:** where a network supports scoped tokens (e.g., read-only reporting vs. link-generation), give ButlerOS's backend only the scope it needs.
5. **Never expose in the frontend:** all affiliate link generation happens server-side in `shopping.ts` — the frontend only ever receives the final tracked URL, never the underlying API keys/tokens. This matches how `butleros-app.html` already consumes `affiliateLink` fields from the backend rather than calling any affiliate network directly.
