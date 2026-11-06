USE `lms_clean`;

-- Seed the 20 requested sections for academic year 2026-2027.
-- No teachers or students are fabricated or assigned.
INSERT IGNORE INTO class_sections
  (section_code, section_name, academic_year_id, grade_level_id, strand_id,
   section_letter, status)
SELECT
  seed.section_code,
  seed.section_name,
  year_row.academic_year_id,
  grade_row.grade_level_id,
  strand_row.strand_id,
  seed.section_letter,
  'active'
FROM (
  SELECT 'STEM11A' AS section_code, 'STEM 11-A' AS section_name,
    11 AS grade_number, 'STEM' AS strand_code, 'A' AS section_letter
  UNION ALL SELECT 'STEM11B', 'STEM 11-B', 11, 'STEM', 'B'
  UNION ALL SELECT 'TVLICT11A', 'TVL-ICT 11-A', 11, 'TVL-ICT', 'A'
  UNION ALL SELECT 'TVLICT11B', 'TVL-ICT 11-B', 11, 'TVL-ICT', 'B'
  UNION ALL SELECT 'HUMSS11A', 'HUMSS 11-A', 11, 'HUMSS', 'A'
  UNION ALL SELECT 'HUMSS11B', 'HUMSS 11-B', 11, 'HUMSS', 'B'
  UNION ALL SELECT 'GAS11A', 'GAS 11-A', 11, 'GAS', 'A'
  UNION ALL SELECT 'GAS11B', 'GAS 11-B', 11, 'GAS', 'B'
  UNION ALL SELECT 'ABM11A', 'ABM 11-A', 11, 'ABM', 'A'
  UNION ALL SELECT 'ABM11B', 'ABM 11-B', 11, 'ABM', 'B'
  UNION ALL SELECT 'STEM12A', 'STEM 12-A', 12, 'STEM', 'A'
  UNION ALL SELECT 'STEM12B', 'STEM 12-B', 12, 'STEM', 'B'
  UNION ALL SELECT 'TVLICT12A', 'TVL-ICT 12-A', 12, 'TVL-ICT', 'A'
  UNION ALL SELECT 'TVLICT12B', 'TVL-ICT 12-B', 12, 'TVL-ICT', 'B'
  UNION ALL SELECT 'HUMSS12A', 'HUMSS 12-A', 12, 'HUMSS', 'A'
  UNION ALL SELECT 'HUMSS12B', 'HUMSS 12-B', 12, 'HUMSS', 'B'
  UNION ALL SELECT 'GAS12A', 'GAS 12-A', 12, 'GAS', 'A'
  UNION ALL SELECT 'GAS12B', 'GAS 12-B', 12, 'GAS', 'B'
  UNION ALL SELECT 'ABM12A', 'ABM 12-A', 12, 'ABM', 'A'
  UNION ALL SELECT 'ABM12B', 'ABM 12-B', 12, 'ABM', 'B'
) AS seed
JOIN academic_years AS year_row
  ON year_row.year_code = '2026-2027'
JOIN grade_levels AS grade_row
  ON grade_row.grade_number = seed.grade_number
JOIN strands AS strand_row
  ON strand_row.strand_code = seed.strand_code;
