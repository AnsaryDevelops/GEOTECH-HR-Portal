-- Phase 3: RLS for notifications.
--
-- No INSERT grant to authenticated at all — notification creation is the
-- job of the transactional RPCs, as part of the same transaction that
-- submits or decides a request (PRODUCTION-BACKEND-PLAN.md §4.5, §8). No
-- DELETE grant to any role, including HR — notification history is
-- preserved permanently (§13.3). UPDATE is column-restricted to `read`
-- only, so no one — HR included — can rewrite message/type/request_id/
-- created_at through this grant.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON notifications TO authenticated;
GRANT UPDATE (read) ON notifications TO authenticated;

-- SELECT: a user reads only their own notifications. No policy grants
-- visibility into anyone else's, for any role other than HR below.
CREATE POLICY notifications_select_own ON notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY notifications_select_hr ON notifications
    FOR SELECT
    TO authenticated
    USING (is_hr());

-- UPDATE: a user may flip their own notification's read state; HR may do
-- the same for any notification (§7: "U: own or any").
CREATE POLICY notifications_update_own_or_hr ON notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR is_hr())
    WITH CHECK (user_id = auth.uid() OR is_hr());
