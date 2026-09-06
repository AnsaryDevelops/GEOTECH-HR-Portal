-- audit_logs: internal backend-only capability, no V1 frontend surface.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.10.
-- Written only from inside the transactional RPCs (a later phase); no SELECT policy is
-- ever granted to any application role, including HR.

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id    UUID REFERENCES profiles(id),
    action      TEXT,
    table_name  TEXT,
    record_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS
    'Backend security/traceability capability only. Not, and must not become, a V1 frontend feature (§4.10).';
