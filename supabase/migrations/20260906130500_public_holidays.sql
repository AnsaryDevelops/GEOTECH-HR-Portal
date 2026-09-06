-- public_holidays: HR-maintained fixed dates.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.7.
-- Islamic dates move yearly and are entered manually, exactly as today.

CREATE TABLE public_holidays (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date  DATE NOT NULL,
    name  TEXT NOT NULL,

    CONSTRAINT public_holidays_date_key UNIQUE (date)
);

COMMENT ON TABLE public_holidays IS
    'Add/remove only, no in-place edit — matches the frontend Settings page exactly (§4.7).';
