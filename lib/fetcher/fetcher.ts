// The polite fetcher (finder spec §4). Every outbound request to a firm's website goes through here:
// an honest user agent, robots.txt, 1 request per host every 5s, Retry-After and backoff, a 10s timeout,
// a 2 MB cap, and no private networks, no Google hosts, no forms, logins, cookies or JavaScript.
import { isIP } from "node:net";
import { isAllowedByRobots, parseRobots, type RobotsRules } from "@/lib/domain/robots";

export interface FetcherDeps {
  fetchImpl: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** DNS lookup returning the host's addresses (checked against private ranges). */
  lookup: (host: string) => Promise<string[]>;
  userAgent: string;
}

export const DEFAULT_FETCHER_OPTIONS = {
  minIntervalMs: 5000,
  timeoutMs: 10_000,
  maxBytes: 2 * 1024 * 1024,
  maxAttempts: 3,
  maxRedirects: 5,
  robotsTtlMs: 24 * 60 * 60 * 1000,
  maxRetryAfterMs: 60_000,
};
export type FetcherOptions = typeof DEFAULT_FETCHER_OPTIONS;

export type FetchFailure =
  "robots" | "blocked_host" | "timeout" | "too_large" | "bad_type" | "http" | "network";

export type FetchResult =
  | { ok: true; url: string; status: number; html: string; bytes: number; ms: number }
  | {
      ok: false;
      url: string;
      reason: FetchFailure;
      status: number | null;
      bytes: number;
      ms: number;
      message?: string;
    };

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml|text\/plain)\b/i;
const GOOGLE_HOST = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page|googleusercontent\.com|gstatic\.com)$/i;

/** Loopback, private, link-local, CGNAT and unspecified addresses (IPv4, IPv6 and v4-mapped). */
export function isPrivateAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const v4 = mapped ? mapped[1]! : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return lower === "::1" || lower === "::" || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

class TooLarge extends Error {}

export class PoliteFetcher {
  private readonly options: FetcherOptions;
  private readonly lastRequestAt = new Map<string, number>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly robots = new Map<string, { rules: RobotsRules | "disallow_all"; at: number }>();

  constructor(
    private readonly deps: FetcherDeps,
    options: Partial<FetcherOptions> = {},
  ) {
    this.options = { ...DEFAULT_FETCHER_OPTIONS, ...options };
  }

  async get(url: string): Promise<FetchResult> {
    const started = this.deps.now();
    let current = url;
    for (let hop = 0; hop <= this.options.maxRedirects; hop += 1) {
      const blocked = await this.checkTarget(current);
      if (blocked) return this.fail(current, "blocked_host", started, null, blocked);
      const target = new URL(current);
      if (!(await this.robotsAllow(target))) return this.fail(current, "robots", started, null);
      const res = await this.request(current, started);
      if ("reason" in res) return res;
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, current).toString();
        continue;
      }
      return this.readBody(current, res, started);
    }
    return this.fail(current, "http", started, null, "Too many redirects");
  }

  private fail(
    url: string,
    reason: FetchFailure,
    started: number,
    status: number | null,
    message?: string,
  ): FetchResult {
    return {
      ok: false,
      url,
      reason,
      status,
      bytes: 0,
      ms: this.deps.now() - started,
      ...(message ? { message } : {}),
    };
  }

  /** Returns a reason when the URL must not be fetched. */
  private async checkTarget(url: string): Promise<string | null> {
    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return "Not a valid URL";
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") return "Only web pages are fetched";
    if (target.port && target.port !== "80" && target.port !== "443") return "Only standard web ports";
    if (target.username || target.password) return "No credentials in URLs";
    const host = target.hostname.replace(/^\[|\]$/g, "");
    if (GOOGLE_HOST.test(host)) return "Google is used through its official API only";
    if (isIP(host)) return isPrivateAddress(host) ? "Private network address" : null;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local"))
      return "Private network address";
    try {
      const addresses = await this.deps.lookup(host);
      if (addresses.length === 0) return "Host not found";
      if (addresses.some(isPrivateAddress)) return "Private network address";
    } catch {
      return "Host not found";
    }
    return null;
  }

  private async robotsAllow(target: URL): Promise<boolean> {
    const key = target.origin;
    const cached = this.robots.get(key);
    let rules = cached && this.deps.now() - cached.at < this.options.robotsTtlMs ? cached.rules : null;
    if (!rules) {
      const res = await this.request(`${key}/robots.txt`, this.deps.now(), 1);
      if ("reason" in res) rules = "disallow_all";
      else if (res.status >= 500) rules = "disallow_all";
      else if (res.status >= 400) rules = parseRobots("");
      else rules = parseRobots((await this.readText(res, 512 * 1024).catch(() => "")) ?? "");
      this.robots.set(key, { rules, at: this.deps.now() });
    }
    if (rules === "disallow_all") return false;
    return isAllowedByRobots(rules, this.deps.userAgent, `${target.pathname}${target.search}`);
  }

  /** One host at a time, at least minIntervalMs apart. */
  private async throttle<T>(host: string, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(host) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        const last = this.lastRequestAt.get(host);
        if (last !== undefined) {
          const wait = last + this.options.minIntervalMs - this.deps.now();
          if (wait > 0) await this.deps.sleep(wait);
        }
        this.lastRequestAt.set(host, this.deps.now());
        return work();
      });
    this.queues.set(host, run);
    return run;
  }

  private async request(
    url: string,
    started: number,
    maxAttempts = this.options.maxAttempts,
  ): Promise<Response | Extract<FetchResult, { ok: false }>> {
    const host = new URL(url).host;
    let lastStatus: number | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const outcome = await this.throttle(host, async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
          return await this.deps.fetchImpl(url, {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            credentials: "omit",
            headers: {
              "user-agent": this.deps.userAgent,
              accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
            },
          });
        } catch (error) {
          return controller.signal.aborted ? ("timeout" as const) : ("network" as const);
        } finally {
          clearTimeout(timer);
        }
      });
      if (outcome === "timeout" || outcome === "network") {
        if (attempt === maxAttempts)
          return this.fail(url, outcome, started, null) as Extract<FetchResult, { ok: false }>;
        await this.deps.sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      lastStatus = outcome.status;
      if (outcome.status === 429 || outcome.status >= 500) {
        if (attempt === maxAttempts) break;
        const retryAfter = Number(outcome.headers.get("retry-after"));
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** (attempt - 1);
        await this.deps.sleep(Math.min(wait, this.options.maxRetryAfterMs));
        continue;
      }
      return outcome;
    }
    return this.fail(url, "http", started, lastStatus) as Extract<FetchResult, { ok: false }>;
  }

  private async readText(res: Response, maxBytes: number): Promise<string> {
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) throw new TooLarge();
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new TooLarge();
      }
      chunks.push(value);
    }
    const all = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      all.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder().decode(all);
  }

  private async readBody(url: string, res: Response, started: number): Promise<FetchResult> {
    if (res.status >= 400) return this.fail(url, "http", started, res.status);
    const type = res.headers.get("content-type") ?? "text/html";
    if (!HTML_TYPES.test(type)) {
      await res.body?.cancel();
      return this.fail(url, "bad_type", started, res.status, type);
    }
    try {
      const html = await this.readText(res, this.options.maxBytes);
      return {
        ok: true,
        url,
        status: res.status,
        html,
        bytes: new TextEncoder().encode(html).byteLength,
        ms: this.deps.now() - started,
      };
    } catch (error) {
      if (error instanceof TooLarge) return this.fail(url, "too_large", started, res.status);
      return this.fail(url, "network", started, res.status);
    }
  }
}
