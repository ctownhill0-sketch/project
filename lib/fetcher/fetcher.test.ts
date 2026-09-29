import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FETCHER_OPTIONS,
  PoliteFetcher,
  isPrivateAddress,
  type FetcherDeps,
} from "@/lib/fetcher/fetcher";

type Route = (req: Request) => Response | Promise<Response>;

function setup(routes: Record<string, Route>, options: Partial<typeof DEFAULT_FETCHER_OPTIONS> = {}) {
  let clock = 1_000_000;
  const sleeps: number[] = [];
  const requests: Request[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    requests.push(req);
    const route = routes[req.url] ?? routes["*"];
    if (!route) return new Response("not found", { status: 404 });
    return route(req);
  });
  const deps: FetcherDeps = {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    lookup: async (host) => (host.endsWith(".internal.example") ? ["10.0.0.5"] : ["93.184.216.34"]),
    userAgent: "VacancyDeskBot/1.0 (+mailto:founder@vacancy-desk.example)",
  };
  const fetcher = new PoliteFetcher(deps, options);
  return { fetcher, sleeps, requests, fetchImpl, advance: (ms: number) => (clock += ms) };
}

const html = (body: string, init: ResponseInit = {}) =>
  new Response(`<html><body>${body}</body></html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
const noRobots: Route = () => new Response("", { status: 404 });

describe("PoliteFetcher", () => {
  it("uses the documented defaults", () => {
    expect(DEFAULT_FETCHER_OPTIONS).toMatchObject({
      minIntervalMs: 5000,
      timeoutMs: 10_000,
      maxBytes: 2 * 1024 * 1024,
      maxAttempts: 3,
    });
  });

  it("fetches a public page with the honest user agent", async () => {
    const { fetcher, requests } = setup({
      "https://harborline.example/robots.txt": noRobots,
      "https://harborline.example/": () => html("Hello"),
    });
    const res = await fetcher.get("https://harborline.example/");
    expect(res).toMatchObject({ ok: true, status: 200 });
    expect(res.ok && res.html).toContain("Hello");
    expect(requests.every((r) => r.headers.get("user-agent")?.startsWith("VacancyDeskBot/1.0"))).toBe(true);
  });

  it("obeys robots.txt and records the reason", async () => {
    const { fetcher, requests } = setup({
      "https://harborline.example/robots.txt": () => new Response("User-agent: *\nDisallow: /owners"),
      "https://harborline.example/owners": () => html("secret"),
    });
    const res = await fetcher.get("https://harborline.example/owners");
    expect(res).toMatchObject({ ok: false, reason: "robots" });
    expect(requests.map((r) => r.url)).toEqual(["https://harborline.example/robots.txt"]);
  });

  it("treats a robots.txt server error as disallow-all", async () => {
    const { fetcher } = setup({
      "https://harborline.example/robots.txt": () => new Response("", { status: 503 }),
      "https://harborline.example/": () => html("x"),
    });
    expect(await fetcher.get("https://harborline.example/")).toMatchObject({ ok: false, reason: "robots" });
  });

  it("spaces requests to one host 5 seconds apart, but not across hosts", async () => {
    const { fetcher, sleeps } = setup({
      "*": (req) => (req.url.endsWith("robots.txt") ? noRobots(req) : html("ok")),
    });
    await fetcher.get("https://a.example/");
    await fetcher.get("https://a.example/about");
    expect(sleeps.filter((ms) => ms > 0)).toEqual([5000, 5000]); // robots → page, page → page
    const before = sleeps.length;
    await fetcher.get("https://b.example/");
    expect(sleeps.slice(before).filter((ms) => ms > 0)).toEqual([5000]); // only b's robots → page
  });

  it("gives up after the timeout", async () => {
    const { fetcher } = setup(
      {
        "https://slow.example/robots.txt": noRobots,
        "https://slow.example/": (req) =>
          new Promise<Response>((_, reject) =>
            req.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
          ),
      },
      { timeoutMs: 20, maxAttempts: 1 },
    );
    expect(await fetcher.get("https://slow.example/")).toMatchObject({ ok: false, reason: "timeout" });
  });

  it("stops reading past the size cap", async () => {
    const big = "x".repeat(4096);
    const { fetcher } = setup(
      {
        "https://big.example/robots.txt": noRobots,
        "https://big.example/": () =>
          new Response(
            new ReadableStream({
              start(c) {
                for (let i = 0; i < 10; i += 1) c.enqueue(new TextEncoder().encode(big));
                c.close();
              },
            }),
            { headers: { "content-type": "text/html" } },
          ),
      },
      { maxBytes: 10_000 },
    );
    expect(await fetcher.get("https://big.example/")).toMatchObject({ ok: false, reason: "too_large" });
  });

  it("rejects non-HTML bodies", async () => {
    const { fetcher } = setup({
      "https://pdf.example/robots.txt": noRobots,
      "https://pdf.example/": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
    });
    expect(await fetcher.get("https://pdf.example/")).toMatchObject({ ok: false, reason: "bad_type" });
  });

  it("honors Retry-After, then retries", async () => {
    let calls = 0;
    const { fetcher, sleeps } = setup({
      "https://busy.example/robots.txt": noRobots,
      "https://busy.example/": () =>
        ++calls === 1 ? new Response("", { status: 429, headers: { "retry-after": "7" } }) : html("ok"),
    });
    expect(await fetcher.get("https://busy.example/")).toMatchObject({ ok: true });
    expect(sleeps).toContain(7000);
  });

  it("stops after 3 attempts on server errors", async () => {
    let calls = 0;
    const { fetcher } = setup({
      "https://down.example/robots.txt": noRobots,
      "https://down.example/": () => {
        calls += 1;
        return new Response("", { status: 503 });
      },
    });
    expect(await fetcher.get("https://down.example/")).toMatchObject({
      ok: false,
      reason: "http",
      status: 503,
    });
    expect(calls).toBe(3);
  });

  it("refuses private networks, Google hosts and non-web schemes", async () => {
    const { fetcher, fetchImpl } = setup({ "*": () => html("x") });
    expect(await fetcher.get("https://intranet.internal.example/")).toMatchObject({
      ok: false,
      reason: "blocked_host",
    });
    expect(await fetcher.get("http://127.0.0.1/")).toMatchObject({ ok: false, reason: "blocked_host" });
    expect(await fetcher.get("https://www.google.com/maps/place/x")).toMatchObject({
      ok: false,
      reason: "blocked_host",
    });
    expect(await fetcher.get("https://maps.app.goo.gl/abc")).toMatchObject({
      ok: false,
      reason: "blocked_host",
    });
    expect(await fetcher.get("ftp://files.example/")).toMatchObject({ ok: false, reason: "blocked_host" });
    expect(await fetcher.get("https://ok.example:8443/")).toMatchObject({
      ok: false,
      reason: "blocked_host",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("re-checks every redirect hop and refuses one into a private network", async () => {
    const { fetcher } = setup({
      "https://hop.example/robots.txt": noRobots,
      "https://hop.example/": () =>
        new Response(null, { status: 301, headers: { location: "https://db.internal.example/" } }),
    });
    expect(await fetcher.get("https://hop.example/")).toMatchObject({ ok: false, reason: "blocked_host" });
  });

  it("follows a same-site redirect", async () => {
    const { fetcher } = setup({
      "https://hop.example/robots.txt": noRobots,
      "https://hop.example/": () => new Response(null, { status: 301, headers: { location: "/home" } }),
      "https://hop.example/home": () => html("home"),
    });
    const res = await fetcher.get("https://hop.example/");
    expect(res).toMatchObject({ ok: true, url: "https://hop.example/home" });
  });
});

describe("isPrivateAddress", () => {
  it.each([
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "127.0.0.1",
    "169.254.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"])("%s is public", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});
