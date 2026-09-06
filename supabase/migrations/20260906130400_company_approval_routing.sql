-- company_approval_routing: singleton table holding the current TM/GM routing slots.
-- 04-DOCS/PRODUCTION-BACKEND-PLAN.md §4.9.
-- Decouples "who currently holds the routing slot" from "what role a profile carries."

CREATE TABLE company_approval_routing (
    id                     SMALLINT PRIMARY KEY DEFAULT 1,
    technical_manager_id   UUID REFERENCES profiles(id),
    general_manager_id     UUID REFERENCES profiles(id),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by             UUID REFERENCES profiles(id),

    CONSTRAINT company_approval_routing_singleton CHECK (id = 1)
);

COMMENT ON TABLE company_approval_routing IS
    'Exactly one row can ever exist (standard Postgres singleton-table trick). No direct client write grant '
    'is ever added — the only writer is set_approval_routing, a later phase (§4.9, §5.7). Not yet writable in '
    'this phase; both slots start unfilled.';

-- The one and only row. Both slots unfilled until HR assigns them via set_approval_routing (a later phase).
-- Not fabricated personnel data — a routing row with NULL slots, matching "production starts clean" (§11).
INSERT INTO company_approval_routing (id) VALUES (1);
