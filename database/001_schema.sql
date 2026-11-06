-- Normalized LMS schema. This creates a separate database and never modifies
-- snhs_lms or any other existing database.
CREATE DATABASE IF NOT EXISTS `lms_clean`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `lms_clean`;

CREATE TABLE IF NOT EXISTS schema_metadata (
  metadata_key VARCHAR(64) NOT NULL,
  metadata_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (metadata_key)
) ENGINE=InnoDB;

INSERT INTO schema_metadata (metadata_key, metadata_value)
VALUES ('schema_profile', 'normalized_v1')
ON DUPLICATE KEY UPDATE metadata_value = VALUES(metadata_value);

CREATE TABLE IF NOT EXISTS roles (
  role_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_roles_name (role_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(64) NOT NULL,
  role_id SMALLINT UNSIGNED NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles (role_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS academic_years (
  academic_year_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  year_code VARCHAR(16) NOT NULL,
  starts_on DATE NULL,
  ends_on DATE NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'planned',
  is_current TINYINT(1) NOT NULL DEFAULT 0,
  current_year_guard TINYINT
    GENERATED ALWAYS AS (CASE WHEN is_current = 1 THEN 1 ELSE NULL END) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (academic_year_id),
  UNIQUE KEY uq_academic_years_code (year_code),
  UNIQUE KEY uq_academic_years_current (current_year_guard),
  CONSTRAINT chk_academic_year_dates
    CHECK (starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grade_levels (
  grade_level_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  grade_number TINYINT UNSIGNED NOT NULL,
  grade_name VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (grade_level_id),
  UNIQUE KEY uq_grade_levels_number (grade_number),
  UNIQUE KEY uq_grade_levels_name (grade_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS strands (
  strand_id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  strand_code VARCHAR(32) NOT NULL,
  strand_name VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (strand_id),
  UNIQUE KEY uq_strands_code (strand_code),
  UNIQUE KEY uq_strands_name (strand_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS class_sections (
  class_section_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_code VARCHAR(64) NOT NULL,
  section_name VARCHAR(128) NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  grade_level_id SMALLINT UNSIGNED NOT NULL,
  strand_id SMALLINT UNSIGNED NOT NULL,
  section_letter CHAR(1) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (class_section_id),
  UNIQUE KEY uq_class_sections_code (section_code),
  UNIQUE KEY uq_class_sections_name_year (academic_year_id, section_name),
  UNIQUE KEY uq_class_sections_path (academic_year_id, grade_level_id, strand_id, section_letter),
  UNIQUE KEY uq_class_sections_year_pair (class_section_id, academic_year_id),
  CONSTRAINT fk_class_sections_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years (academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_class_sections_grade
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels (grade_level_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_class_sections_strand
    FOREIGN KEY (strand_id) REFERENCES strands (strand_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_class_sections_letter
    CHECK (section_letter IN ('A', 'B'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_enrollments (
  student_enrollment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  enrollment_status VARCHAR(16) NOT NULL DEFAULT 'active',
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (student_enrollment_id),
  UNIQUE KEY uq_student_enrollments_student_year (student_id, academic_year_id),
  CONSTRAINT fk_student_enrollments_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_student_enrollments_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_student_enrollment_status
    CHECK (enrollment_status IN ('active', 'transferred', 'completed', 'withdrawn'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_enrollment_history (
  enrollment_history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  enrollment_status VARCHAR(16) NOT NULL,
  enrolled_at DATETIME NOT NULL,
  ended_at DATETIME NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrollment_history_id),
  CONSTRAINT fk_student_enrollment_history_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_student_enrollment_history_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_student_enrollment_history_status
    CHECK (enrollment_status IN ('transferred', 'completed', 'withdrawn'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teacher_assignments (
  teacher_assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  teacher_id VARCHAR(64) NOT NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  assignment_type VARCHAR(24) NOT NULL DEFAULT 'adviser',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (teacher_assignment_id),
  UNIQUE KEY uq_teacher_section_role_year
    (teacher_id, class_section_id, academic_year_id, assignment_type),
  CONSTRAINT fk_teacher_assignments_teacher
    FOREIGN KEY (teacher_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_teacher_assignments_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_teacher_assignment_type
    CHECK (assignment_type IN ('adviser', 'teacher')),
  CONSTRAINT chk_teacher_assignment_status
    CHECK (status IN ('active', 'ended'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subjects (
  subject_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_code VARCHAR(64) NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  units DECIMAL(5,2) NOT NULL DEFAULT 0,
  grade_level_id SMALLINT UNSIGNED NULL,
  strand_id SMALLINT UNSIGNED NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subject_id),
  UNIQUE KEY uq_subjects_code (subject_code),
  CONSTRAINT fk_subjects_grade
    FOREIGN KEY (grade_level_id) REFERENCES grade_levels (grade_level_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_subjects_strand
    FOREIGN KEY (strand_id) REFERENCES strands (strand_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subject_assignments (
  subject_assignment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  teacher_id VARCHAR(64) NOT NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  semester VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subject_assignment_id),
  UNIQUE KEY uq_subject_assignments_year_pair
    (subject_assignment_id, academic_year_id),
  UNIQUE KEY uq_subject_assignments_scope
    (subject_id, class_section_id, academic_year_id, semester),
  CONSTRAINT fk_subject_assignments_subject
    FOREIGN KEY (subject_id) REFERENCES subjects (subject_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_subject_assignments_teacher
    FOREIGN KEY (teacher_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_subject_assignments_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activities (
  activity_id VARCHAR(64) NOT NULL,
  subject_assignment_id BIGINT UNSIGNED NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  activity_type VARCHAR(24) NOT NULL,
  title VARCHAR(255) NOT NULL,
  instructions TEXT NULL,
  due_at DATETIME NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (activity_id),
  CONSTRAINT fk_activities_assignment
    FOREIGN KEY (subject_assignment_id)
    REFERENCES subject_assignments (subject_assignment_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_activities_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_activities_creator
    FOREIGN KEY (created_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subject_enrollments (
  subject_enrollment_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  subject_assignment_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  enrollment_status VARCHAR(16) NOT NULL DEFAULT 'active',
  enrolled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (subject_enrollment_id),
  UNIQUE KEY uq_subject_enrollments_student_assignment
    (student_id, subject_assignment_id),
  CONSTRAINT fk_subject_enrollments_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_subject_enrollments_assignment_year
    FOREIGN KEY (subject_assignment_id, academic_year_id)
    REFERENCES subject_assignments (subject_assignment_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_subject_enrollment_status
    CHECK (enrollment_status IN ('active', 'ended', 'withdrawn'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submissions (
  submission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  submitted_at DATETIME NULL,
  submission_status VARCHAR(16) NOT NULL DEFAULT 'draft',
  content JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (submission_id),
  UNIQUE KEY uq_submissions_attempt (activity_id, student_id, attempt_number),
  CONSTRAINT fk_submissions_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_submissions_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_questions (
  assessment_question_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id VARCHAR(64) NOT NULL,
  question_order SMALLINT UNSIGNED NOT NULL,
  question_text TEXT NOT NULL,
  options JSON NOT NULL,
  answer_key JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (assessment_question_id),
  UNIQUE KEY uq_assessment_questions_order (activity_id, question_order),
  CONSTRAINT fk_assessment_questions_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assessment_attempts (
  assessment_attempt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  activity_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  correct_answers SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  question_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  score_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answers JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assessment_attempt_id),
  UNIQUE KEY uq_assessment_attempt_number
    (activity_id, student_id, attempt_number),
  CONSTRAINT fk_assessment_attempts_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_assessment_attempts_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_assessment_attempt_score
    CHECK (score_percent >= 0 AND score_percent <= 100)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS grades (
  grade_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  subject_assignment_id BIGINT UNSIGNED NULL,
  activity_id VARCHAR(64) NULL,
  graded_by VARCHAR(64) NOT NULL,
  grading_period VARCHAR(64) NOT NULL DEFAULT '',
  score DECIMAL(7,2) NOT NULL,
  max_score DECIMAL(7,2) NOT NULL DEFAULT 100,
  feedback TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (grade_id),
  CONSTRAINT fk_grades_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_grades_assignment
    FOREIGN KEY (subject_assignment_id)
    REFERENCES subject_assignments (subject_assignment_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_grades_activity
    FOREIGN KEY (activity_id) REFERENCES activities (activity_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_grades_teacher
    FOREIGN KEY (graded_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_grades_scores
    CHECK (score >= 0 AND max_score > 0 AND score <= max_score)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id VARCHAR(64) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  academic_year_id BIGINT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  audience VARCHAR(32) NOT NULL DEFAULT 'all',
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id),
  CONSTRAINT fk_announcements_creator
    FOREIGN KEY (created_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_announcements_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years (academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendance (
  attendance_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id VARCHAR(64) NOT NULL,
  class_section_id BIGINT UNSIGNED NOT NULL,
  academic_year_id BIGINT UNSIGNED NOT NULL,
  recorded_by VARCHAR(64) NOT NULL,
  attendance_date DATE NOT NULL,
  session_key VARCHAR(32) NOT NULL DEFAULT 'day',
  attendance_status VARCHAR(16) NOT NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (attendance_id),
  UNIQUE KEY uq_attendance_student_session
    (student_id, class_section_id, attendance_date, session_key),
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_attendance_section_year
    FOREIGN KEY (class_section_id, academic_year_id)
    REFERENCES class_sections (class_section_id, academic_year_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_attendance_recorder
    FOREIGN KEY (recorded_by) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_attendance_status
    CHECK (attendance_status IN ('present', 'absent', 'late', 'excused'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lms_records (
  resource VARCHAR(64) NOT NULL,
  record_id VARCHAR(128) NOT NULL,
  scope_id VARCHAR(128) NOT NULL DEFAULT '',
  owner_id VARCHAR(64) NOT NULL DEFAULT '',
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (resource, record_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS activity_logs (
  activity_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id VARCHAR(64) NULL,
  action VARCHAR(255) NOT NULL,
  module VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  message VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (activity_log_id),
  CONSTRAINT fk_activity_logs_user
    FOREIGN KEY (user_id) REFERENCES users (user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_id_sequence (
  sequence_name VARCHAR(64) NOT NULL,
  `last_value` BIGINT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (sequence_name)
) ENGINE=InnoDB;
