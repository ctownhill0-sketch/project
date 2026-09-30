// Fair-housing checker, layer 1 (brief M14): an editable regex list with pass / warn / block.
// Screening aid, not legal advice. Pure: no I/O.

export type Severity = "warn" | "block";
export type Outcome = "pass" | Severity;

export interface Rule {
  id: string;
  pattern: string;
  category: string;
  severity: Severity;
  explanation: string;
  saferRewrite?: string | null;
}

export interface Match {
  ruleId: string;
  phrase: string;
  category: string;
  severity: Severity;
  explanation: string;
  saferRewrite: string | null;
}

export const SCREENING_LABEL = "Screening aid, not legal advice.";
const MAX_PATTERN = 300;

function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

/** One match per rule (the first phrase it finds). Block beats warn beats pass. */
export function checkText(text: string, rules: readonly Rule[]): { outcome: Outcome; matches: Match[] } {
  const matches: Match[] = [];
  for (const rule of rules) {
    const found = compile(rule.pattern)?.exec(text);
    if (!found || found[0] === "") continue;
    matches.push({
      ruleId: rule.id,
      phrase: found[0],
      category: rule.category,
      severity: rule.severity,
      explanation: rule.explanation,
      saferRewrite: rule.saferRewrite ?? null,
    });
  }
  const outcome: Outcome = matches.some((m) => m.severity === "block")
    ? "block"
    : matches.length
      ? "warn"
      : "pass";
  return { outcome, matches };
}

/** Returns a message when a founder-entered pattern is unsafe to run on every text, else null. */
export function validatePattern(pattern: string): string | null {
  if (!pattern.trim()) return "Enter a pattern.";
  if (pattern.length > MAX_PATTERN) return `Keep patterns to ${MAX_PATTERN} characters or fewer.`;
  const re = compile(pattern);
  if (!re) return "That isn't a valid pattern. Check the brackets and backslashes.";
  // Nested repeats like (a+)+ can backtrack for minutes on a long text.
  if (/\([^()]*[+*}][^()]*\)\s*[+*{]/.test(pattern))
    return "Patterns with nested repeats like (a+)+ can freeze the app.";
  if (re.test("") || re.test("x")) return "This pattern matches everything.";
  return null;
}
