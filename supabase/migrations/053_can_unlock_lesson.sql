-- Adaptive routing: can user unlock next lesson/module based on progression_rules.

SET search_path TO public;

CREATE OR REPLACE FUNCTION can_unlock_lesson(p_user_email TEXT, p_lesson_id UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rules JSONB;
  v_max_reviews_due INT;
  v_due_count INT;
BEGIN
  SELECT value INTO v_rules FROM site_settings WHERE key = 'progression_rules' LIMIT 1;
  v_max_reviews_due := COALESCE((v_rules->>'max_reviews_due_before_advance')::int, 20);
  SELECT COUNT(*)::int INTO v_due_count
  FROM review_schedule
  WHERE user_email = p_user_email AND next_review_at <= NOW();
  IF v_due_count > v_max_reviews_due THEN
    RETURN QUERY SELECT false, 'Complete ' || (v_due_count - v_max_reviews_due)::text || ' more reviews before advancing.'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, NULL::text;
END;
$$;

COMMENT ON FUNCTION can_unlock_lesson(TEXT, UUID) IS 'Returns allowed=true if user has fewer due reviews than progression_rules.max_reviews_due_before_advance';
