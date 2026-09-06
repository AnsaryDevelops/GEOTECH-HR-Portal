-- Corrective migration on top of 20260906130100_profiles.sql (already committed as 2c60963).
--
-- profiles.employee_number was modeled as an auto-generated EMP-NNNNN identifier. This is
-- wrong: the company already assigns every employee an Employee Code (e.g. "ansary34"), which
-- HR enters manually at account creation and which is the employee's login identifier. Correct
-- this by renaming the column to employee_code and removing the generated-identifier machinery
-- entirely — there is no second identifier serving the same purpose.
--
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.1, §6.1, §6.2, §6.6 (corrected).

DROP TRIGGER profiles_generate_employee_number ON profiles;
DROP FUNCTION generate_employee_number();
DROP SEQUENCE profiles_employee_number_seq;

ALTER TABLE profiles RENAME COLUMN employee_number TO employee_code;
ALTER TABLE profiles RENAME CONSTRAINT profiles_employee_number_key TO profiles_employee_code_key;

COMMENT ON COLUMN profiles.employee_code IS
    'Company-defined Employee Code, entered manually by HR at account creation (e.g. "ansary34") — '
    'never auto-generated. This is the employee''s login identifier (§4.1, §6.1).';
