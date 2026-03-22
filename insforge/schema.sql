-- Smart Parking: InsForge Postgres schema
-- Apply with: insforge db query --file insforge/schema.sql
-- Or paste sections into: insforge db query "<sql>"

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'incharger')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  location TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'occupied')),
  UNIQUE (label, location)
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.slots(id),
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  customer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_slots_location ON public.slots(location);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: own row
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Slots: read for booking UI; writes via RPC only
DROP POLICY IF EXISTS "slots_select_authenticated" ON public.slots;
CREATE POLICY "slots_select_authenticated" ON public.slots
  FOR SELECT TO authenticated
  USING (true);

-- Bookings: customers see own; inchargers see all
DROP POLICY IF EXISTS "bookings_select_customer" ON public.bookings;
CREATE POLICY "bookings_select_customer" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'incharger'
    )
  );

-- No direct insert/update on bookings from client (use RPC)
-- ---------------------------------------------------------------------------
-- RPC: create_booking
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking(
  p_slot_id UUID,
  p_vehicle_number TEXT,
  p_vehicle_type TEXT,
  p_start_time TIMESTAMPTZ,
  p_duration INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_booking_id TEXT;
  v_overlap BOOLEAN;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND role = 'customer') THEN
    RAISE EXCEPTION 'Only customers can create bookings';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  -- Overlap check for same vehicle (active bookings)
  v_start := p_start_time;
  v_end := v_start + (p_duration || ' hours')::interval;

  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_number = p_vehicle_number
      AND b.status = 'active'
      AND (b.start_time, b.start_time + (b.duration || ' hours')::interval)
          OVERLAPS (v_start, v_end)
  ) INTO v_overlap;

  IF v_overlap THEN
    RAISE EXCEPTION 'Vehicle already has an overlapping active booking';
  END IF;

  UPDATE public.slots
  SET status = 'booked'
  WHERE id = p_slot_id AND status = 'available';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not available';
  END IF;

  v_booking_id := 'BK-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 9));

  INSERT INTO public.bookings (
    id, user_id, slot_id, vehicle_number, vehicle_type, start_time, duration, status, customer_email
  ) VALUES (
    v_booking_id, v_uid, p_slot_id, p_vehicle_number, p_vehicle_type, p_start_time, p_duration, 'active', v_email
  );

  RETURN jsonb_build_object('booking_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: verify_booking (incharger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_booking(p_booking_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND role = 'incharger') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT
    b.id,
    b.user_id,
    b.slot_id,
    b.vehicle_number,
    b.vehicle_type,
    b.start_time,
    b.duration,
    b.status,
    b.customer_email,
    b.created_at,
    s.label AS slot_label,
    s.location,
    s.tier,
    s.status AS slot_status
  INTO r
  FROM public.bookings b
  JOIN public.slots s ON s.id = b.slot_id
  WHERE upper(trim(b.id)) = upper(trim(p_booking_id));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF r.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Ticket is not active';
  END IF;

  IF r.slot_status = 'booked' THEN
    UPDATE public.slots SET status = 'occupied' WHERE id = r.slot_id;
  END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'user_id', r.user_id,
    'slot_id', r.slot_id,
    'vehicle_number', r.vehicle_number,
    'vehicle_type', r.vehicle_type,
    'start_time', r.start_time,
    'duration', r.duration,
    'status', r.status,
    'user_email', r.customer_email,
    'slot_label', r.slot_label,
    'location', r.location,
    'tier', r.tier,
    'slot_status', r.slot_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_booking(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: update_slot_status (incharger)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_slot_status(p_slot_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_uid AND role = 'incharger') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_status NOT IN ('available', 'booked', 'occupied') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.slots SET status = p_status WHERE id = p_slot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_slot_status(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed slots (idempotent: only if empty)
-- ---------------------------------------------------------------------------

INSERT INTO public.slots (label, location, tier, status)
SELECT * FROM (
  VALUES
    -- Trichy LA Cinema
    ('G-01', 'Trichy LA Cinema', 'gold', 'available'),
    ('G-02', 'Trichy LA Cinema', 'gold', 'available'),
    ('G-03', 'Trichy LA Cinema', 'gold', 'available'),
    ('G-04', 'Trichy LA Cinema', 'gold', 'available'),
    ('S-01', 'Trichy LA Cinema', 'silver', 'available'),
    ('S-02', 'Trichy LA Cinema', 'silver', 'available'),
    ('S-03', 'Trichy LA Cinema', 'silver', 'available'),
    ('S-04', 'Trichy LA Cinema', 'silver', 'available'),
    ('S-05', 'Trichy LA Cinema', 'silver', 'available'),
    ('S-06', 'Trichy LA Cinema', 'silver', 'available'),
    ('B-01', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-02', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-03', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-04', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-05', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-06', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-07', 'Trichy LA Cinema', 'bronze', 'available'),
    ('B-08', 'Trichy LA Cinema', 'bronze', 'available'),
    -- Trichy Bus Stand
    ('G-01', 'Trichy Bus Stand', 'gold', 'available'),
    ('G-02', 'Trichy Bus Stand', 'gold', 'available'),
    ('G-03', 'Trichy Bus Stand', 'gold', 'available'),
    ('G-04', 'Trichy Bus Stand', 'gold', 'available'),
    ('S-01', 'Trichy Bus Stand', 'silver', 'available'),
    ('S-02', 'Trichy Bus Stand', 'silver', 'available'),
    ('S-03', 'Trichy Bus Stand', 'silver', 'available'),
    ('S-04', 'Trichy Bus Stand', 'silver', 'available'),
    ('S-05', 'Trichy Bus Stand', 'silver', 'available'),
    ('S-06', 'Trichy Bus Stand', 'silver', 'available'),
    ('B-01', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-02', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-03', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-04', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-05', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-06', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-07', 'Trichy Bus Stand', 'bronze', 'available'),
    ('B-08', 'Trichy Bus Stand', 'bronze', 'available'),
    -- Trichy Railway Station
    ('G-01', 'Trichy Railway Station', 'gold', 'available'),
    ('G-02', 'Trichy Railway Station', 'gold', 'available'),
    ('G-03', 'Trichy Railway Station', 'gold', 'available'),
    ('G-04', 'Trichy Railway Station', 'gold', 'available'),
    ('S-01', 'Trichy Railway Station', 'silver', 'available'),
    ('S-02', 'Trichy Railway Station', 'silver', 'available'),
    ('S-03', 'Trichy Railway Station', 'silver', 'available'),
    ('S-04', 'Trichy Railway Station', 'silver', 'available'),
    ('S-05', 'Trichy Railway Station', 'silver', 'available'),
    ('S-06', 'Trichy Railway Station', 'silver', 'available'),
    ('B-01', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-02', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-03', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-04', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-05', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-06', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-07', 'Trichy Railway Station', 'bronze', 'available'),
    ('B-08', 'Trichy Railway Station', 'bronze', 'available')
) AS v(label, location, tier, status)
WHERE NOT EXISTS (SELECT 1 FROM public.slots LIMIT 1);

-- Allow authenticated to read slots (already have policy). Seed runs as migration user.
