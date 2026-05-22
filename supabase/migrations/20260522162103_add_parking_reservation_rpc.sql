-- Atomic parking reservation insert with server-side conflict check.
-- Uses a transaction-level advisory lock to prevent concurrent double-bookings
-- that would slip past the client-side isDateConflict check.

CREATE OR REPLACE FUNCTION add_parking_reservation(
  p_house_id    uuid,
  p_requested_by uuid,
  p_date        text,
  p_start_time  text DEFAULT NULL,
  p_end_time    text DEFAULT NULL,
  p_note        text DEFAULT ''
)
RETURNS parking_reservations
LANGUAGE plpgsql
AS $$
DECLARE
  conflict_exists boolean;
  new_row         parking_reservations;
  v_start         time;
  v_end           time;
BEGIN
  -- Validate and parse supplied time range before acquiring the lock.
  IF p_start_time IS NOT NULL OR p_end_time IS NOT NULL THEN
    BEGIN
      v_start := p_start_time::time;
      v_end   := p_end_time::time;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid_time_range: times must be in HH:MM format';
    END;
    IF v_start >= v_end THEN
      RAISE EXCEPTION 'invalid_time_range: start_time must be before end_time';
    END IF;
  END IF;

  -- Serialize concurrent inserts for the same house within this transaction.
  PERFORM pg_advisory_xact_lock(hashtext(p_house_id::text)::bigint);

  SELECT EXISTS (
    SELECT 1
    FROM   parking_reservations
    WHERE  house_id = p_house_id
      AND  date     = p_date
      AND  status   IN ('approved', 'pending')
      AND  (
             -- Either side has no times → treat as all-day conflict
             v_start IS NULL OR v_end IS NULL
             OR start_time IS NULL OR end_time IS NULL
             -- Timed overlap using cast values: new slot starts before existing ends
             -- AND ends after existing starts
             OR (v_start < end_time::time AND v_end > start_time::time)
           )
  ) INTO conflict_exists;

  IF conflict_exists THEN
    RAISE EXCEPTION 'conflicting_reservation: this time slot is already taken';
  END IF;

  INSERT INTO parking_reservations
    (house_id, requested_by, date, start_time, end_time, note, status)
  VALUES
    (p_house_id, p_requested_by, p_date, p_start_time, p_end_time, p_note, 'pending')
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

-- Allow authenticated house members to call this function.
GRANT EXECUTE ON FUNCTION add_parking_reservation(uuid, uuid, text, text, text, text)
  TO authenticated;
