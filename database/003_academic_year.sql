USE `lms_clean`;

-- This initial year matches the current LMS System Settings value.
-- Calendar start/end dates are intentionally not guessed.
INSERT IGNORE INTO academic_years
  (year_code, starts_on, ends_on, status, is_current)
VALUES
  ('2026-2027', NULL, NULL, 'active', 1);
