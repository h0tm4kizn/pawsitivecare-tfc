-- ============================================================================
-- PawsitiveCare Booking System - Database Setup Script
-- Run this script in your PostgreSQL database to set up schedules and data
-- ============================================================================

-- Step 1: Configure Clinic Schedules
-- ============================================================================

-- Grooming Schedule (Mon-Sat, 9AM-5PM, 60min slots, max 8 per day)
INSERT INTO shop_hours (key, value, updated_at) VALUES (
  'schedule.grooming',
  '{"days": [1,2,3,4,5,6], "open": "09:00", "close": "17:00", "interval_mins": 60, "max_slots": 8}',
  NOW()
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Daycare Schedule (Mon-Fri, 8AM-6PM, 60min slots, max 10 per day)
INSERT INTO shop_hours (key, value, updated_at) VALUES (
  'schedule.daycare',
  '{"days": [1,2,3,4,5], "open": "08:00", "close": "18:00", "interval_mins": 60, "max_slots": 10}',
  NOW()
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Hotel Schedule (All days, check-in 10AM, check-out 10AM, max 30 nights)
INSERT INTO shop_hours (key, value, updated_at) VALUES (
  'schedule.hotel',
  '{"days": [0,1,2,3,4,5,6], "check_in": "10:00", "check_out": "10:00", "max_nights": 30}',
  NOW()
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Blocked Dates (empty by default - add holidays as needed)
INSERT INTO shop_hours (key, value, updated_at) VALUES (
  'blocked_dates',
  '[]',
  NOW()
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Step 2: Create Hotel Suites (if not exists)
-- ============================================================================

-- Small Suites
INSERT INTO hotel_suites (id, name, species_type, size_range, price_per_night, capacity, is_available, description)
SELECT gen_random_uuid(), 'Small Suite ' || i, 'Dog', 'small', 200.00, 1, true, 'Cozy suite for small dogs'
FROM generate_series(1, 2) i
WHERE NOT EXISTS (SELECT 1 FROM hotel_suites WHERE size_range = 'small' LIMIT 1);

-- Medium Suites
INSERT INTO hotel_suites (id, name, species_type, size_range, price_per_night, capacity, is_available, description)
SELECT gen_random_uuid(), 'Medium Suite ' || i, 'Dog', 'medium', 350.00, 1, true, 'Spacious suite for medium dogs'
FROM generate_series(1, 2) i
WHERE NOT EXISTS (SELECT 1 FROM hotel_suites WHERE size_range = 'medium' LIMIT 1);

-- Large Suites
INSERT INTO hotel_suites (id, name, species_type, size_range, price_per_night, capacity, is_available, description)
SELECT gen_random_uuid(), 'Large Suite ' || i, 'Dog', 'large', 500.00, 1, true, 'Premium suite for large dogs'
FROM generate_series(1, 2) i
WHERE NOT EXISTS (SELECT 1 FROM hotel_suites WHERE size_range = 'large' LIMIT 1);

-- Step 3: Verify Setup
-- ============================================================================

-- Check schedules
SELECT key, value FROM shop_hours WHERE key LIKE 'schedule%' OR key = 'blocked_dates';

-- Check hotel suites
SELECT name, size_range, price_per_night, is_available FROM hotel_suites ORDER BY size_range, name;

-- ============================================================================
-- Setup Complete!
-- ============================================================================
-- Next steps:
-- 1. Update frontend to use ImprovedBookingModal (already done if you followed guide)
-- 2. Test booking flow
-- 3. Configure schedules via Admin Settings page
-- ============================================================================
