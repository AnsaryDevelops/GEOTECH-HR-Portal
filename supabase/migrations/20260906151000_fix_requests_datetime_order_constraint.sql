-- Corrective migration on top of 20260906130600_requests.sql (already
-- committed as 2c60963) — does not edit that file.
--
-- requests_time_order_check compared start_time/end_time alone, regardless
-- of date: `end_time > start_time`. This incorrectly rejects a valid Mission
-- that crosses midnight (e.g. 2026-09-10 22:00 -> 2026-09-11 02:00), since
-- 02:00 is not later than 22:00 as bare times, even though the mission ends
-- after it starts. The correct rule is end_datetime > start_datetime.
--
-- Replaces it with a constraint that combines date and time into a full
-- timestamp before comparing (`date + time` is a valid Postgres timestamp
-- expression), so the comparison is correct regardless of whether the
-- mission spans midnight. Strict `>` (not `>=`) means an identical start and
-- end datetime is still rejected, matching the original rule's intent.

ALTER TABLE requests DROP CONSTRAINT requests_time_order_check;

ALTER TABLE requests
    ADD CONSTRAINT requests_datetime_order_check
    CHECK (
        start_date IS NULL OR end_date IS NULL OR start_time IS NULL OR end_time IS NULL
        OR (end_date + end_time) > (start_date + start_time)
    );

COMMENT ON CONSTRAINT requests_datetime_order_check ON requests IS
    'Corrects requests_time_order_check (20260906130600_requests.sql): compares the full '
    'start/end datetime, not bare TIME values, so a mission spanning midnight is accepted '
    'while identical or reversed start/end datetimes are still rejected.';
