-- The do-not-call list for firms that aren't leads is as permanent as company.dnc_flag
-- (TCPA guardrail, brief Part 11): entries can't be changed or removed.
CREATE OR REPLACE FUNCTION forbid_change_dnc_entry() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'do_not_call is permanent: this do-not-call entry cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER dnc_entry_no_update
  BEFORE UPDATE ON dnc_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_change_dnc_entry();
--> statement-breakpoint
CREATE TRIGGER dnc_entry_no_delete
  BEFORE DELETE ON dnc_entry
  FOR EACH ROW EXECUTE FUNCTION forbid_change_dnc_entry();
