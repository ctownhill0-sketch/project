-- Do-not-call is permanent: a flagged row can't be deleted either, otherwise
-- deleting and re-adding the firm or person would quietly reset the flag.
CREATE OR REPLACE FUNCTION forbid_delete_contact_do_not_call() RETURNS trigger AS $$
BEGIN
  IF OLD.do_not_call THEN
    RAISE EXCEPTION 'do_not_call is permanent: this contact cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION forbid_delete_company_dnc_flag() RETURNS trigger AS $$
BEGIN
  IF OLD.dnc_flag THEN
    RAISE EXCEPTION 'do_not_call is permanent: this company cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER contact_do_not_call_no_delete
  BEFORE DELETE ON contact
  FOR EACH ROW EXECUTE FUNCTION forbid_delete_contact_do_not_call();
--> statement-breakpoint
CREATE TRIGGER company_dnc_flag_no_delete
  BEFORE DELETE ON company
  FOR EACH ROW EXECUTE FUNCTION forbid_delete_company_dnc_flag();
