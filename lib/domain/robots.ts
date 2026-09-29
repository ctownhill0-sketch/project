// robots.txt parsing and matching (RFC 9309): the most specific user-agent group wins,
// then the longest matching rule; Allow wins a tie. Supports * and $.

interface Rule {
  allow: boolean;
  path: string;
}

export interface RobotsRules {
  groups: { agents: string[]; rules: Rule[] }[];
}

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsRules["groups"] = [];
  let current: RobotsRules["groups"][number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      lastWasAgent = false;
      if (key === "disallow" && value === "") continue; // empty Disallow = allow all
      current.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

export function isAllowedByRobots(rules: RobotsRules, userAgent: string, path: string): boolean {
  const product = userAgent.split("/")[0]!.toLowerCase();
  const own = rules.groups.filter((g) => g.agents.some((a) => a !== "*" && product.startsWith(a)));
  const group = own.length > 0 ? own : rules.groups.filter((g) => g.agents.includes("*"));
  let best: Rule | null = null;
  for (const rule of group.flatMap((g) => g.rules)) {
    if (!pathMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))
      best = rule;
  }
  return best ? best.allow : true;
}
