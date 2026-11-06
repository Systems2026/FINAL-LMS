USE `lms_clean`;

INSERT IGNORE INTO roles (role_name)
VALUES ('admin'), ('teacher'), ('student');

INSERT IGNORE INTO grade_levels (grade_number, grade_name)
VALUES (11, 'Grade 11'), (12, 'Grade 12');

INSERT IGNORE INTO strands (strand_code, strand_name)
VALUES
  ('STEM', 'STEM'),
  ('TVL-ICT', 'TVL-ICT'),
  ('HUMSS', 'HUMSS'),
  ('GAS', 'GAS'),
  ('ABM', 'ABM');
