// How demo rows are recognized, so "Delete demo data" never touches real data.
// `.example` is a reserved top-level domain (RFC 2606): no real firm can have one.
export const DEMO_DOMAIN_SUFFIX = ".example";
/** 555-0100 to 555-0199 are reserved for fiction (NANP). SQL LIKE pattern on E.164 numbers. */
export const DEMO_PHONE_LIKE = "+1___55501__";
export const DEMO_WEEK_NOTE = "Demo data (fictional)";

/** The same test as the SQL patterns above, for rows already loaded. */
export function isDemoFirm(f: { normalizedDomain: string | null; normalizedPhone: string | null }): boolean {
  return (
    (f.normalizedDomain?.endsWith(DEMO_DOMAIN_SUFFIX) ?? false) ||
    /^\+1\d{3}55501\d{2}$/.test(f.normalizedPhone ?? "")
  );
}
