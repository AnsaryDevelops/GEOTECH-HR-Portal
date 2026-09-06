-- notifications: unchanged in shape from the existing (unapplied) migration, type constraint corrected.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.5.
-- No client INSERT grant is ever added — only the transactional RPCs write notifications (§5, §7).
-- No DELETE grant either — notification history is preserved permanently (§13.3).

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    request_id  UUID REFERENCES requests(id) ON DELETE CASCADE,
    message     TEXT NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT notifications_type_check CHECK (type IN ('REQUEST_SUBMITTED', 'REQUEST_ADVANCED', 'REQUEST_APPROVED', 'REQUEST_REJECTED'))
);

COMMENT ON TABLE notifications IS
    'REQUEST_ADVANCED (fired on every intermediate-stage approval) is the corrected addition over '
    'the historical migration''s three-value constraint (§2.11, §4.5).';

CREATE INDEX notifications_user_id_idx ON notifications (user_id);
CREATE INDEX notifications_user_id_read_idx ON notifications (user_id, read);
CREATE INDEX notifications_created_at_idx ON notifications (created_at);
