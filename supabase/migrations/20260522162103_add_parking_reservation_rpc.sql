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
BEGIN
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
             p_start_time IS NULL OR p_end_time IS NULL
             OR start_time IS NULL OR end_time IS NULL
             -- Timed overlap: new slot starts before existing ends AND ends after existing starts
             OR (p_start_time < end_time AND p_end_time > start_time)
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
