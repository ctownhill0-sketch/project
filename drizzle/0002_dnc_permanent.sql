-- Do-not-call flags are permanent (TCPA guardrail, brief Part 11).
-- Once set, no update may clear them. Other columns stay editable.
-- One function per table: PL/pgSQL resolves every column in an expression,
-- so a shared function can't reference columns that only one table has.
CREATE OR REPLACE FUNCTION enforce_contact_do_not_call_permanent() RETURNS trigger AS $$
BEGIN
  IF OLD.do_not_call AND NOT NEW.do_not_call THEN
    RAISE EXCEPTION 'do_not_call is permanent and cannot be cleared';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_company_dnc_flag_permanent() RETURNS trigger AS $$
BEGIN
  IF OLD.dnc_flag AND NOT NEW.dnc_flag THEN
    RAISE EXCEPTION 'do_not_call is permanent and cannot be cleared';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contact_do_not_call_permanent
  BEFORE UPDATE ON contact
  FOR EACH ROW EXECUTE FUNCTION enforce_contact_do_not_call_permanent();
--> statement-breakpoint
CREATE TRIGGER company_dnc_flag_permanent
  BEFORE UPDATE ON company
  FOR EACH ROW EXECUTE FUNCTION enforce_company_dnc_flag_permanent();
