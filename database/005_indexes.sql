USE `lms_clean`;

-- CREATE INDEX in MySQL has no IF NOT EXISTS form. Each block checks the
-- catalog first so this script can be safely rerun.

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users'
    AND index_name = 'ix_users_role_status'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_users_role_status ON users (role_id, status)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'class_sections'
    AND index_name = 'ix_class_sections_year_grade_strand_status'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_class_sections_year_grade_strand_status ON class_sections (academic_year_id, grade_level_id, strand_id, status)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'student_enrollments'
    AND index_name = 'ix_student_enrollments_student_year'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_student_enrollments_student_year ON student_enrollments (student_id, academic_year_id)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'teacher_assignments'
    AND index_name = 'ix_teacher_assignments_section_year_status'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_teacher_assignments_section_year_status ON teacher_assignments (class_section_id, academic_year_id, status)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'subject_assignments'
    AND index_name = 'ix_subject_assignments_section_term'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_subject_assignments_section_term ON subject_assignments (class_section_id, academic_year_id, semester, status)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'subject_enrollments'
    AND index_name = 'ix_subject_enrollments_student_status'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_subject_enrollments_student_status ON subject_enrollments (student_id, enrollment_status)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'activities'
    AND index_name = 'ix_activities_section_year_status_due'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_activities_section_year_status_due ON activities (class_section_id, academic_year_id, status, due_at)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'submissions'
    AND index_name = 'ix_submissions_student_activity'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_submissions_student_activity ON submissions (student_id, activity_id)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'grades'
    AND index_name = 'ix_grades_student_period'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_grades_student_period ON grades (student_id, grading_period)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'announcements'
    AND index_name = 'ix_announcements_status_created'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_announcements_status_created ON announcements (status, created_at)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'attendance'
    AND index_name = 'ix_attendance_section_date'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_attendance_section_date ON attendance (class_section_id, attendance_date)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'lms_records'
    AND index_name = 'ix_lms_records_owner_resource'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_lms_records_owner_resource ON lms_records (owner_id, resource)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;

SET @index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'activity_logs'
    AND index_name = 'ix_activity_logs_user_created'
);
SET @ddl = IF(@index_exists = 0,
  'CREATE INDEX ix_activity_logs_user_created ON activity_logs (user_id, created_at)',
  'SELECT 1');
PREPARE index_stmt FROM @ddl;
EXECUTE index_stmt;
DEALLOCATE PREPARE index_stmt;
