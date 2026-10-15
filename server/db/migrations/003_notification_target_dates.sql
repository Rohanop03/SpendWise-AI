ALTER TABLE notifications
  ADD COLUMN target_event_date DATE;

UPDATE notifications
SET target_event_date = (scheduled_for AT TIME ZONE 'UTC')::DATE
WHERE notification_type IN ('renewal', 'trial_expiration')
  AND target_event_date IS NULL;

ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_target_event_date
  CHECK (
    notification_type = 'system'
    OR target_event_date IS NOT NULL
  );

CREATE UNIQUE INDEX uq_notifications_reminder_event
  ON notifications (user_id, subscription_id, notification_type, target_event_date)
  WHERE notification_type IN ('renewal', 'trial_expiration');

