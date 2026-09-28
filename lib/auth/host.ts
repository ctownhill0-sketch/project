const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Free Build: the app only serves this Mac. The dev server binds to 127.0.0.1, and
 * this check also rejects requests whose Host header names another site, which
 * blocks DNS-rebinding attacks from web pages open in the browser.
 */
export function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return LOCAL_HOSTNAMES.has(hostname ?? "");
}
