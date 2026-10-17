-- 009: concurrent payments for one subscription must not deadlock.
--
-- Each INSERT into payment_history takes a KEY SHARE lock on the parent subscription row (the
-- foreign key check). The renewal trigger then asked for FOR UPDATE on that row, which conflicts
-- with KEY SHARE: two concurrent payments each held KEY SHARE and waited for the other, and
-- PostgreSQL aborted one with a deadlock (40P01). FOR NO KEY UPDATE does not conflict with
-- KEY SHARE, so the second payment now simply waits for the first to commit and then advances
-- the renewal date from the already-advanced value. The trigger's UPDATE touches only non-key
-- columns, so NO KEY UPDATE is the strongest lock it needs.
CREATE OR REPLACE FUNCTION spendwise_advance_renewal_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_subscription subscription%ROWTYPE;
  v_anchor_day INTEGER;
  v_periods INTEGER := 1;
  v_next DATE;
BEGIN
  IF NEW.payment_status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_subscription
  FROM subscription
  WHERE subscription_id = NEW.subscription_id
  FOR NO KEY UPDATE;

  IF v_subscription.status <> 'Active' THEN
    RETURN NEW;
  END IF;

  -- Keep the original day of month once a renewal has been clamped to a shorter month.
  v_anchor_day := EXTRACT(DAY FROM v_subscription.renewal_date)::INTEGER;
  IF v_subscription.renewal_date
       = (date_trunc('month', v_subscription.renewal_date) + INTERVAL '1 month - 1 day')::DATE
     AND EXTRACT(DAY FROM v_subscription.start_date) > v_anchor_day THEN
    v_anchor_day := EXTRACT(DAY FROM v_subscription.start_date)::INTEGER;
  END IF;

  -- One cycle forward; a late payment keeps advancing until the date is after the payment.
  LOOP
    v_next := spendwise_add_billing_periods(
      v_subscription.renewal_date, v_subscription.billing_cycle, v_anchor_day, v_periods
    );
    EXIT WHEN v_next > NEW.payment_date;
    v_periods := v_periods + 1;
  END LOOP;

  UPDATE subscription
  SET renewal_date = v_next,
      updated_at = CURRENT_TIMESTAMP
  WHERE subscription_id = NEW.subscription_id;

  RETURN NEW;
END;
$$;
