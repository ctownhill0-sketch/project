// Responsiveness complaints in reviews (finder spec §4.5), keyword rules for now.
// AI-HOOK(M3): a Claude classifier can replace flagReview for nuance (sarcasm, negation beyond these rules).

export type ReviewCategory = "never_called_back" | "no_response" | "slow_response";

export const RESPONSIVENESS_RULES: { category: ReviewCategory; pattern: RegExp }[] = [
  { category: "never_called_back", pattern: /never (?:called|call|got a call|heard) back/i },
  { category: "never_called_back", pattern: /never returned (?:my|our|any) (?:calls?|messages?|emails?)/i },
  { category: "never_called_back", pattern: /(?:didn'?t|did not|won'?t|will not) (?:call|get) back/i },
  { category: "no_response", pattern: /no (?:response|reply|answer)/i },
  { category: "no_response", pattern: /(?:doesn'?t|does not|don'?t|do not|never) (?:answer|respond|reply)/i },
  { category: "no_response", pattern: /(?:ignored|ghosted) (?:my|our|me|us)/i },
  {
    category: "slow_response",
    pattern: /hard to reach|impossible to reach|difficult to reach|can'?t reach/i,
  },
  {
    category: "slow_response",
    pattern: /(?:took|takes|waited) (?:days|weeks|forever) to (?:respond|reply|get back|call)/i,
  },
  { category: "slow_response", pattern: /slow to (?:respond|reply)/i },
];

export function flagReview(text: string): { category: ReviewCategory; quote: string } | null {
  if (!text) return null;
  for (const rule of RESPONSIVENESS_RULES) {
    const m = rule.pattern.exec(text);
    if (m) return { category: rule.category, quote: m[0] };
  }
  return null;
}
