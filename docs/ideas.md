# Ideas and deferred work

Things kept out of scope on purpose. **Nothing here gets built without the founder's go-ahead** (a Checkpoint E decision). Most of it waits until there's revenue, because it costs money or needs an account or API key.

## Deferred until revenue (from the "$0 Free Build" scope change)

| Item | What it needs | Hook left in the code |
|---|---|---|
| M2 Listings monitor | Background jobs + the polite fetcher running on a schedule | none |
| M3 Review pain finder (+10 score boost) | Google Places API (needs a billing account with a card) + Claude | `Review` tables empty |
| M5 AI call briefs | Anthropic API key | `AI-HOOK(M5)` in call prep |
| M11 Owner Vacancy Report + emails | Deployment (public `/r/[token]`), Resend, a mailing address | none |
| M12 "Why it didn't rent" tagger (and its 20 seed transcripts) | Anthropic API key | `Transcript` tables empty |
| M13 Company Brain + export to Avery | Anthropic API key | none |
| M14 layer 2 (Claude classifier) | Anthropic API key | `AI-HOOK(M14-L2)` |
| M15 Metro Response Index | Enough shop data + an anonymization scanner | none |
| M16 Content engine | Anthropic API key + 3 writing samples | none |
| AI wrapper `lib/ai/client.ts` | Anthropic API key | `lib/ai/hooks.ts` interfaces |
| Background jobs (Inngest) | Deployment | `JobRun` table empty |
| Deployment (Netlify or Vercel Pro, Neon, Google sign-in) | Accounts; Vercel Hobby prohibits commercial use | `DATABASE_DRIVER`, `requireUser()` |
| Polite fetcher (`lib/fetcher`) | Nothing, it's free. Cut because nothing calls it yet. Rules: honest user agent `VacancyDeskBot/1.0 (+contact email)`, robots.txt, per-domain rate limit, Retry-After, backoff, 3 tries, 10s timeout, 2 MB cap, and never forms, logins, CAPTCHAs or headless browsers. | none |
| Automatic software detection | The polite fetcher | `SoftwarePattern` rows seeded |
| Public ROI share link | Deployment | ROI inputs already live in the URL |

## Other ideas
- **GoHighLevel sync.** A `CrmAdapter` backed by GHL, authenticated with a Private Integration Token. Dry run first. Pull-only sync, and never SMS or workflows. Parked because the founder doesn't use GHL.
- **Second metro.** Add it from Settings once NYC lead volume is known.
