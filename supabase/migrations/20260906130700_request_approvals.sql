-- request_approvals: one row per approval stage, preserving each decision permanently.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.4.
-- No direct client write grant is ever added (§5). "Current stage" is computed on read
-- (MIN(stage) WHERE status = 'PENDING'), never a separate pointer column.

CREATE TABLE request_approvals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id     UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    stage          SMALLINT NOT NULL,
    role           TEXT NOT NULL,
    title          TEXT NOT NULL,
    approver_id    UUID NOT NULL REFERENCES profiles(id),
    approver_name  TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'PENDING',
    decided_at     TIMESTAMPTZ,
    comment        TEXT,

    CONSTRAINT request_approvals_stage_check CHECK (stage IN (1, 2, 3)),
    CONSTRAINT request_approvals_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT request_approvals_unique_request_stage UNIQUE (request_id, stage)
);

COMMENT ON TABLE request_approvals IS
    'approver_id/approver_name are snapshotted once, at submission time, and never rewritten by '
    'anything other than that row''s own decision — preserves historical approver identity through '
    'later routing/role/manager changes (§4.9).';

CREATE INDEX request_approvals_approver_status_idx ON request_approvals (approver_id, status);
