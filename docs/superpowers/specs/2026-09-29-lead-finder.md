# Lead Finder: design spec (Checkpoint F)

- **Date:** 2026-09-29
- **Status:** SELF-APPROVED under the founder's "Finish the build: autonomous mode" instruction (2026-09-29). Decisions made on the founder's behalf are logged in `docs/decisions.md`.
- **Classification:** ARCHITECTURAL. It adds an external service (Google Places), outbound HTTP (the polite fetcher) and schema changes. The founder authorized all three in the DECISION + UPGRADE BRIEF §4 and the autonomous-mode brief.
- **Source:** DECISION + UPGRADE BRIEF §4 (4.1–4.10) and §5. Where this spec is silent, the original BUILD BRIEF and `2026-09-28-command-center-design.md` apply.

---

## 1. Google facts this design relies on

`developers.google.com` is **blocked** by this container's network policy. The facts below come from two places:

- Google's own pages, as quoted in search-engine snippets of `developers.google.com`, `cloud.google.com` and `mapsplatform.google.com`.
- Independent pricing write-ups, used only as corroboration.

**Action for the founder (once):** open the three links in §1.5 and confirm the numbers. If Google has changed them, only `lib/domain/finder-cost.ts` needs editing. It is the single source for every figure shown in the UI.

### 1.1 Text Search (New)

- **Request:** `POST https://places.googleapis.com/v1/places:searchText`.
  - The body carries `textQuery`, `pageSize` and `pageToken`.
  - The headers are `X-Goog-Api-Key` and `X-Goog-FieldMask`.
- **Pages:** `pageSize` is 1–20, and anything above 20 is capped at 20.
  - When more results exist, the response has a `nextPageToken`.
  - On a follow-up page, every parameter except `pageSize`, `pageToken` and `maxResultCount` must match the first request, or Google returns `INVALID_ARGUMENT`.
- **Billing:** you pay for the **highest SKU among the fields in the field mask**.
  - **Essentials (IDs only):** `places.id`, `places.name`, `places.attributions`, `nextPageToken`, …
  - **Pro:** adds `places.displayName`, `places.formattedAddress`, `places.types`, `places.businessStatus`, `places.googleMapsUri`, …
  - **Enterprise:** adds `places.websiteUri`, `places.nationalPhoneNumber`, `places.internationalPhoneNumber`, `places.rating`, `places.userRatingCount`, opening hours, …

### 1.2 Prices and free usage (pay-as-you-go, per 1,000 billable events)

| SKU                                       | List price | Free per month | We use it for                                   |
| ----------------------------------------- | ---------- | -------------- | ----------------------------------------------- |
| Text Search Essentials (IDs only)         | $0         | unlimited      | **Test key** button (one free request)          |
| Text Search Pro                           | $32.00     | 5,000          | not used                                        |
| **Text Search Enterprise**                | **$35.00** | **1,000**      | **Every search page** (we need website + phone) |
| **Place Details Enterprise + Atmosphere** | **$25.00** | **1,000**      | **Reviews**, on demand only                     |

- Since 1 March 2025, per-SKU free monthly caps have replaced the old $200 monthly credit: Essentials 10,000, Pro 5,000, Enterprise 1,000.
- Free usage is counted **per billing account across all projects**. The app can only count its own requests, and the usage page says so.

### 1.3 Terms that shape the design

- **Place IDs** are exempt from the caching restrictions and **may be stored indefinitely**.
- **Latitude and longitude** may be cached for **up to 30 consecutive calendar days**. We don't request them.
- **Everything else is Google Maps Content.** It must not be pre-fetched, indexed, stored or cached "except as expressly permitted", and must never be scraped or bulk-downloaded.
- **Attribution:** when Places data is shown **without a Google map**, show the Google Maps logo, or the text "Google Maps" where space is tight.
  - Don't alter or obscure the attribution.
  - Visually separate Google content from other content (a border or background).
  - The attribution needs an accessible label: "Google Maps".
- **Reviews:** always credit the author (their name, plus the profile link when present).

### 1.4 What the app does about it

| Term                        | Implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Place ID storable           | `place_result.place_id` and `company.google_place_id` are kept forever. Dedupe and "re-run shows only new firms" rely on them.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| No caching of other content | Google-sourced display fields (name, address, phone, website, types, review count, reviews) live in a **short-lived cache**: at most **30 days** after `fetched_at`, and each row carries `google_expires_at`. `purgeExpiredGoogleContent()` runs on every Finder, Leads and Calls page load (a few cheap `UPDATE`s, no background job). It blanks the expired Google fields, or **replaces them with the firm's own website data**, and deletes cached reviews. Where only Google had a value, a **"Refresh from Google"** button re-fetches it by place ID (it counts against the caps). |
| No scraping of Google       | Only the official API, and only server-side. Google Maps pages are never fetched. The polite fetcher refuses `google.*` hosts.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Attribution                 | A `<GoogleAttribution>` component ("Google Maps" text with `aria-label="Google Maps"`) sits on every card, row group and panel that shows Places data. Google content sits in a bordered block. Reviews show the author's name and profile link, and are labeled "Sample of up to 5 Google reviews".                                                                                                                                                                                                                                                                                       |
| Minimal fields              | The field mask in §3 lists only fields the UI or the scoring uses. A test pins it exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Why a 30-day window for fields the terms don't explicitly cover:** triaging a batch takes days, so a zero-day cache would make the tool useless. We use the longest window the terms name for any Places data, and we swap in the firm's own public website data (not Google content) as soon as enrichment finds it. This interpretation is flagged in `docs/decisions.md` (D-F3) and in the final report's open issues, for the founder to check against the terms.

### 1.5 Sources

- Text Search (New): https://developers.google.com/maps/documentation/places/web-service/text-search
- Usage and billing: https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- Pricing list: https://developers.google.com/maps/billing-and-pricing/pricing
- March 2025 changes (free caps): https://developers.google.com/maps/billing-and-pricing/march-2025
- Policies and attributions: https://developers.google.com/maps/documentation/places/web-service/policies
- Service-specific terms (caching): https://cloud.google.com/maps-platform/terms/maps-service-terms
- Terms of service (no scraping): https://cloud.google.com/maps-platform/terms

---

## 2. Scope (maps to brief §4)

| Brief | Feature                                                                                                                                                                                                                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1   | **Search modes:** a town, a batch territory (a saved town list run in order with progress) and keyword variants (5 defaults, editable), with results merged. Estimate first, then a live counter. Territory tracker. Saved searches. "Run my territory" button. |
| 4.2   | Exclusion rules: chains, plus a "Probably not a fit" group (HOA, commercial, vacation, single building, sales only). Dedupe four ways. Do-not-call firms show grayed out with the reason and are never re-added.                                                |
| 4.3   | Polite fetcher plus website enrichment: software with evidence and confidence (low goes to a review queue), size signals with a quote, listing count, business phone and general email, service type.                                                           |
| 4.4   | Scoring: +10 review signals and −30 chain or not a fit, plus "Why this lead" on every row.                                                                                                                                                                      |
| 4.5   | Reviews on demand or for the top N, with the keyword flag rules, `AI-HOOK(M3)` and attribution.                                                                                                                                                                 |
| 4.6   | Triage one at a time: A add, S skip, D do-not-call, N not a fit, O open website, U undo, with "12 of 40" progress. Table view with bulk add, not a fit and export CSV.                                                                                          |
| 4.7   | Hand-off: status New, ranked by score in Leads and Today. "Plan mystery shops" checklist. The call prep panel shows the finder's facts.                                                                                                                         |
| 4.8   | Key safety, daily and monthly caps with a hard stop, the usage page, Settings key status plus a Test key button, and the Cloud reminders.                                                                                                                       |

---

## 3. Places client (`lib/finder/places.ts`, server-only)

- `import "server-only"`. The key is read from `process.env.GOOGLE_PLACES_API_KEY` inside the request function only. It is never returned, stored, logged or passed to a component.
- **Field mask for search** (a test pins this exact string):
  `places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.userRatingCount,places.googleMapsUri,nextPageToken`
  - The highest SKU in it is **Text Search Enterprise**. `websiteUri` and `nationalPhoneNumber` are what make a lead callable and enrichable.
  - `userRatingCount` ranks firms for "reviews for the top N" and is shown as "N Google reviews".
  - `googleMapsUri` is the attribution link.
  - `rating`, `location`, hours and photos are **not** requested.
- **Review details mask:** `id,reviews` on `GET /v1/places/{id}`, which is Place Details Enterprise + Atmosphere.
- **Test key mask:** `places.id` with `pageSize: 1`. This is Essentials (IDs only), so it's free.
- **Request body:** `{ textQuery: "<keyword> in <Town>, <ST>", pageSize: 20, regionCode: "US" }`. Pages follow `nextPageToken` until it's absent, with a hard stop at 5 pages.
- **Errors map to typed results** (never thrown to the UI):
  - `ok`;
  - `empty`;
  - `quota_exceeded` (HTTP 429 or `RESOURCE_EXHAUSTED`);
  - `invalid_key` (403 `PERMISSION_DENIED`, or 400 `API_KEY_INVALID`);
  - `bad_request`;
  - `network`;
  - `cap_reached` (our own cap, checked before sending).
- **Transport:** it is injectable (`fetchImpl`). Tests and CI use **recorded fixtures** in `lib/finder/fixtures/*.json`.
  - These are synthetic but match the documented response shape, and use fictional `.example` firms and `+1…55501xx` phones.
  - No live call happens in any test.
  - `pnpm finder:record` (founder-only, needs the key) records real responses into `.data/fixtures/`, which is git-ignored.
- **Caps are checked before every request** from `api_usage` rows:
  - daily default **100**, monthly default **900** Text Search requests (below the 1,000 free);
  - reviews default **20 a day and 200 a month**.
  - Reaching a cap stops the run with the message "Daily cap of 100 Google requests reached. Nothing more will be sent today. Change it in Settings."
  - Every request (sent, failed or blocked) writes an `api_usage` row, so the usage page is exact.

## 4. Polite fetcher (`lib/fetcher/`, server-only)

- **Honest user agent:** `VacancyDeskBot/1.0 (+mailto:<OWNER_EMAIL or founder@vacancy-desk.example>)`.
- **Allowed targets:**
  - `http`/`https` only, on ports 80/443;
  - never private, loopback or link-local addresses (checked after DNS lookup), and never `google.*` or `goo.gl`;
  - no forms, no logins, no cookies, no JavaScript and no headless browser.
- **robots.txt:**
  - Fetched once per host, cached 24h in memory.
  - Longest-match `Allow`/`Disallow` for the group `VacancyDeskBot`, falling back to `*`.
  - A 4xx robots response means everything is allowed; 5xx or a network failure means **disallow** (conservative).
- **Rate limit:** one request per host every **5s**, through a per-host promise queue. `Retry-After` is honored (capped at 60s).
- **Retries:** exponential backoff over 3 tries, on 429/5xx/network errors only.
- **Size and time limits:** a **10s** timeout via `AbortSignal`, and a **2 MB** cap enforced while streaming (the read is aborted beyond it).
  - Only `text/html`, `application/xhtml+xml` and `text/plain` bodies are kept.
- **Pages:** the homepage plus up to **3** likely pages found in its links:
  - `/rentals`, `/available`, `/vacancies`, `/listings`, `/pay-rent`, `/residents`, `/tenants`, `/owners`, `/about`;
  - same host only.
- **Record keeping:** every fetch is written to `enrichment_run.pages` (url, status, bytes, ms, skipped reason). Failures are recorded, never hidden.
- **Speed:** time and the network are injectable (a `clock` and `fetchImpl`), so the tests are instant.

## 5. Enrichment (`lib/finder/enrich.ts`, pure given the HTML)

Every result is `{ kind, value, confidence: "high" | "medium" | "low", sourceUrl, quote }`.

- **Software:** editable `software_pattern` rows, matched against link `href`s and script `src`s.
  - **High** confidence: a portal or listing link to a known vendor domain. For example `*.appfolio.com`, `*.managebuilding.com`, `*.doorloop.com`, `*.rentmanager.com`/`*.rmresident.com`, `*.rentcafe.com`/`*.securecafe.com`, `*.propertyware.com`, `*.rentvine.com`, `*.tenantcloud.com`.
  - **Medium:** the vendor's name appears only in the page text.
  - **Low:** it's ambiguous, or two vendors match. Low confidence goes to the **software review queue**.
  - "None found" is recorded as `none` only when the homepage and at least one other page were fetched without any vendor match. Otherwise it's `unknown`.
- **Size:**
  - Regexes pick up "we manage over 300 doors", "150+ units", "1,200 homes", "managing 45 properties", and so on.
  - The value, the quote and the page URL are stored, and the value is labeled Estimated.
  - The largest plausible value between 5 and 50,000 wins.
- **Listing count:** vendor listing widgets (AppFolio `listing-item`, Buildium, RentCafe cards) are counted on the rentals page. The count is Estimated and carries its source.
- **Contact:**
  - **Phone:** the `tel:` links (or visible numbers) on the homepage, business numbers only.
  - **Email:** only `mailto:` addresses whose local part is generic: `info|office|leasing|rentals|contact|hello|admin|management|pm|properties|support|team`.
  - **Personal-looking addresses** (a first name, or `first.last`) are **dropped**, and no email formats are ever guessed.
- **Name:** `og:site_name`, or else `<title>` cleaned of " | Home" style suffixes. It's used when Google content expires.
- **Service type:** keyword hints for residential, HOA, commercial and vacation. More than one hint can be stored, each with its quote.

## 6. Filtering, dedupe and scoring

- **Exclusion rules** (`exclusion_rule`, editable in Settings and seeded):
  - **Chains:** Greystar, Invitation Homes, Progress Residential, AvalonBay, Equity Residential, Related Management, Lincoln Property, Bozzuto, Cushman & Wakefield, CBRE, JLL, FirstService Residential, Associa, Roofstock, Mynd, Pathlight, Real Property Management, Keyrenter, BH Management, Camden, Mid-America, UDR, Essex, and others.
  - **Not a fit:** HOA/condo association, commercial-only, vacation/short-term rental, a single building ("The ____ Apartments" with no management wording), and sales-only brokerage.
  - Rules match on name (case-insensitive substring or word), domain or Google type.
  - A match marks the place `excluded` (chain) or `not_a_fit`, with the rule shown. The founder can override per place in triage.
- **Dedupe** (`lib/domain/dedupe.ts`), in priority order:
  1. Same place ID.
  2. Same normalized domain (strip `www.`, lowercase, drop the path).
  3. Same normalized phone (10 digits).
  4. Jaro-Winkler ≥ 0.90 on the normalized name (legal suffixes and "property management" style words stripped) **and** the same town.

  Methods 1–3 mean a **duplicate** (links to the existing company). Method 4 means a **possible duplicate** (shown in the merge screen, Step 2).

- **Do-not-call protection:** if any method matches a company with `dnc_flag` (or a place ID or domain on the do-not-call list), the place gets `dedupe_status = "dnc"`. It is shown grayed out with "Do not call (since {date})" and **can never be added**. The server action rejects it as well as the UI.
- **Scoring:** the existing `scoreLead` gains `reviewSignals` (+10 when ≥ 1 review flag) and `chainOrNotFit` (−30). Both weights are editable. `whyThisLead` adds "{n} reviews mention no callback" and "Probably not a fit: {reason}".

## 7. Data model (migration `0004_lead_finder`)

All new tables use `...baseColumns()` and snake_case, and are covered by the invariants test. Every create, update and delete goes through `withAudit()`.

| Table                 | Key columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `territory`           | name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `territory_town`      | territory_id, town, state (2 letters), position, last_searched_at, results_found, leads_added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `saved_search`        | name, towns jsonb `[{town,state}]`, keywords jsonb `string[]`, territory_id?                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `search_run`          | saved_search_id?, territory_id?, towns, keywords, status (`planned\|running\|done\|stopped_cap\|stopped\|failed`), planned_queries, estimated_requests, estimated_cost_usd, requests_used, results_found, new_found, error, finished_at                                                                                                                                                                                                                                                                                                                                                                                            |
| `search_query`        | search_run_id, town, state, keyword, position, status (`pending\|done\|failed\|skipped_cap`), pages, result_count, error                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `place_result`        | place_id (unique per workspace), first_run_id, last_run_id, town, state, **Google cache:** display_name, formatted_address, types jsonb, business_status, website_uri, national_phone, user_rating_count, google_maps_uri, google_fetched_at, google_expires_at; **ours:** normalized_domain, normalized_phone, fit_status (`ok\|excluded\|not_a_fit`), fit_reason, fit_rule_id, dedupe_status (`new\|duplicate\|possible_duplicate\|dnc`), dedupe_company_id, dedupe_reason, triage_status (`pending\|added\|skipped\|not_a_fit\|dnc`), company_id, score, score_breakdown, why, enrichment_status (`none\|queued\|done\|failed`) |
| `enrichment_run`      | place_result_id?, company_id?, url, status (`done\|failed\|blocked_robots\|skipped`), pages jsonb, error, finished_at                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `enrichment_evidence` | enrichment_run_id, place_result_id?, company_id?, kind (`software\|size_units\|listing_count\|phone\|email\|name\|service_type`), value, confidence, source_url, quote                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `exclusion_rule`      | kind (`chain\|not_a_fit`), category, match (`name\|domain\|type`), pattern, is_active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `triage_decision`     | place_result_id, decision (`add\|skip\|not_a_fit\|dnc`), previous_status, company_id?, undone_at                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `api_usage`           | sku (`text_search_enterprise\|text_search_ids\|place_details_atmosphere`), outcome (`sent\|failed\|blocked_cap`), http_status, search_run_id?, company_id?, requested_at                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `dnc_entry`           | kind (`place_id\|domain\|phone`), value, reason. Permanent: the migration adds the same delete and update triggers as `company.dnc_flag`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Company additions:**

- `source` (`csv|finder|manual`);
- `field_sources` jsonb (`{ name, phone, websiteUrl, address }` → `google|website|csv|manual`);
- `google_expires_at`, `address`, `business_email`, `service_types` jsonb;
- `review_flag_count` (default 0), `fit_status`, `fit_reason`, `size_quote`, `software_confidence`;
- `needs_software_review` (bool, the review queue).

**Enums and review table:**

- `software_kind` gains `propertyware`, `rentvine`, `tenantcloud` and `other`.
- `review` gains `author_name`, `author_uri` and `expires_at`.

**Settings keys:**

- `finder.caps` `{ dailySearch: 100, monthlySearch: 900, dailyDetails: 20, monthlyDetails: 200 }`;
- `finder.keywords` (the 5 defaults);
- `finder.reviewTopN` (10);
- `scoring.weights` gains `reviewSignals: 10` and `chainOrNotFit: -30`.

## 8. Flows and UI (Direction C patterns)

- **`/finder`:**
  - **Page header:** "Lead finder". Key numbers: requests today / cap, this month / cap, places pending triage, and leads added this week. Primary action: "Run search".
  - **Search panel:** mode tabs (Town | Territory | Saved), town + state, keyword chips, and "Estimate" (requests = towns × keywords × up to 3 pages, cost ≤ requests × $0.035 before free usage).
  - "Run" steps through the queries one server action at a time (no background jobs). It shows a live counter ("Query 4 of 15 · 38 requests · 112 places") and a Stop button.
  - The territory tracker table, plus saved searches.
- **`/finder/results?run=`:**
  - DataGrid with columns: name, town, fit, dedupe, software, units, listings, score, triage. Filter chips for Pending / Ready / Duplicates / Not a fit / Do not call.
  - Bulk bar: Add, Not a fit, Export CSV. "Enrich pending" runs in chunks with progress.
  - Detail split panel: every source visible, plus Google attribution.
- **`/finder/triage?run=`:** one place at a time with name, address, website info, software + evidence, size signals, review flags, score and "Why this lead".
  - Keys **A S D N O U**, plus "12 of 40". Undo reverts the last decision, including deleting a company created by Add.
  - **D (do-not-call) is permanent** by law and by the database trigger. It asks for confirmation (press D again within 3s, or click Confirm), and U can't undo it; the toast says so.
- **`/finder/usage`:** requests by day (a table plus a bar chart), estimated cost at list price and after free usage, which searches used them, and the caps.
- **Settings > Google Places:**
  - key status ✓/✗ with the last 4 characters (computed server-side, only those 4 characters sent);
  - a Test key button;
  - cap inputs;
  - a checklist: "Restrict the key to Places API (New)", "Set a $1 budget alert", with links to the Cloud console.

## 9. Tests (written first)

- `places.test.ts` (fixtures):
  - pagination across 3 pages, stopping when there's no token;
  - empty results, a 429 quota response, an invalid key and a network error;
  - the field mask string matches exactly;
  - the key is sent only in the header, and is absent from errors and logs.
- `caps.test.ts`: the daily cap blocks the 101st request and writes `blocked_cap`; the monthly cap works the same way; review caps are separate.
- `dedupe.test.ts`: all four methods, priority order, the Jaro-Winkler threshold, and do-not-call protection (a place matching a do-not-call company by phone gets `dnc`, and the add action throws).
- `exclusion.test.ts`: chain by name, not a fit by type and name, false positives ("Greystone Realty" isn't Greystar; "Condo rentals" managers aren't HOA-only), and overrides.
- `robots.test.ts`, `fetcher.test.ts`: robots rules, the 5s spacing with a fake clock, the 10s timeout, the 2 MB cap, Retry-After, private-IP and google-host refusal, and the honest user agent.
- `enrich.test.ts`: one fixture page per vendor (evidence URL and confidence), size phrases ("we manage over 300 doors", "150+ units"), listing counts, generic email only, and service type.
- `scoring.test.ts`: the +10 and −30 cases, and the why line.
- `purge.test.ts`: expired Google fields are replaced by website values or blanked, reviews are deleted, and place IDs are kept.
- **e2e** `finder.spec.ts`, with fixture transport via `PLACES_TRANSPORT=fixtures`:
  - search 2 fixture towns → dedupe → enrich (fixture sites) → score → triage 10 by keyboard, including undo → the leads appear in Leads and Today with a why line;
  - axe in both themes.
- **Key-safety scan** (`scripts/scan-client-bundle.mjs`, also a CI step): build with a canary `GOOGLE_PLACES_API_KEY`, then fail if the canary appears anywhere in `.next/static` or the RSC payloads.

## 10. Risks

| Risk                                                      | Mitigation                                                                                                                                                |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing drifts from §1.2                                  | One file, `lib/domain/finder-cost.ts`, plus the founder's one-time check. Caps are counted in requests, not dollars, so a price change can't raise usage. |
| Free usage is shared across the founder's billing account | The usage page says so. Default caps sit under the free tier, and a $1 budget alert is the backstop.                                                      |
| Website enrichment is slow (5s per host)                  | Different hosts run in parallel (4 at a time), in chunks of 5 places per server action, with progress shown.                                              |
| The cache-window interpretation (§1.4)                    | Logged as D-F3, and it can be tightened to 0 days with one setting (`finder.googleCacheDays`).                                                            |
