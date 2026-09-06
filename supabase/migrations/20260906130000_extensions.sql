-- Phase 2: PostgreSQL extensions required by the production schema.
-- btree_gist backs the leave-overlap EXCLUDE constraint on `requests`
-- (04-DOCS/PRODUCTION-BACKEND-PLAN.md §9, §13.4).
-- gen_random_uuid() is built into PostgreSQL core (v13+) and needs no extension.

CREATE EXTENSION IF NOT EXISTS btree_gist;
