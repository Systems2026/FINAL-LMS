# LMS database migration plan

## Status and safety boundary

- Source database: `snhs_lms`.
- Target database: `lms_clean`, created independently with the normalized
  schema scripts.
- No source data has been copied, changed, or deleted.
- The legacy API is still selected by `DB_NAME=snhs_lms`. It refuses to start
  against a database marked `normalized_v1` so it cannot silently add legacy
  tables to the clean schema.
- No migration may be run until the user explicitly approves a reviewed
  migration run.

## Source inventory observed

Only aggregate counts and non-secret schema/data fields were inspected. No
password hashes or credentials were read or reported.

| Legacy table | Current rows | Notes |
|---|---:|---|
| `users` | 3 | One admin, one teacher, one student. Password field exists; its value was not inspected. |
| `class_sections` | 4 | Four sections for 2026–2027; adviser is free text. |
| `classes` | 4 | Duplicated class/section-facing data keyed by the same section codes. |
| `subjects` | 4 | Grade/strand/year/semester are text fields. |
| `subject_sections` | 0 | Legacy subject-to-class offerings. |
| `enrollments` | 0 | Legacy student-to-subject enrollment, not homeroom enrollment. |
| `lms_records` | 1 | One `settings` record. The current school year is 2026–2027. |
| `activity_logs` | 28 | User reference and timestamps need reconciliation. |
| `student_id_sequence` | 2 | Includes student and teacher sequences. |

The current student row has Grade 11, an empty strand, an empty
`classSectionCode`, and the legacy section value `A`. That letter is not enough
to infer a class section; no student enrollment will be invented. The current
section adviser names do not resolve to a teacher user by exact name.

## Proposed mapping

| Legacy source | Normalized target | Migration rule |
|---|---|---|
| `users.role` | `roles` + `users.role_id` | Map exact supported role names. Quarantine unknown roles. |
| `users.id`, `name`, `email`, `password`, `status` | `users.user_id`, `full_name`, `email`, `password_hash`, `status` | Copy stable IDs; preserve password hash bytes exactly without logging or rehashing. Resolve duplicate/case-colliding email values before insert. |
| `users.gradeLevel`, `strand`, `classSectionCode` for students | `student_enrollments` through the matching `class_sections` row | Create only when section code, grade, strand, and year resolve consistently. Missing/invalid relationships require manual review; never infer from a section letter. On a later within-year section move, archive the prior assignment in `student_enrollment_history` before updating the current row. |
| `class_sections` | `academic_years`, `grade_levels`, `strands`, `class_sections` | Resolve exact labels/codes. Record unmatched values. Map adviser only when a unique teacher user is confirmed; otherwise leave unassigned for review. |
| `classes` | Section display/schedule fields and/or `subject_assignments` after reconciliation | Compare each shared code with `class_sections`. Do not duplicate or overwrite canonical values when records conflict; review differences first. |
| `subjects` | `subjects` | Map subject code and name; resolve grade/strand/year/semester text to reference rows or leave optional dimensions unset for review. |
| `subject_sections` | `subject_assignments` | Resolve subject, class section, teacher user, academic year, and semester. Ambiguous or missing teacher/name matches are quarantined. |
| `enrollments` | `subject_enrollments` | Resolve the legacy offering to a unique `subject_assignment`; preserve dates/status. This table is distinct from homeroom `student_enrollments`. |
| `lms_records` resources | Typed tables where unambiguous; otherwise `lms_records` | Preserve original `(resource,id,scopeId,ownerId,payload)` and payload JSON. Move records to typed activities/submissions/grades/announcements/attendance only after resource-specific transforms are validated. |
| `activity_logs` | `activity_logs` | Map user IDs only when present; retain actorless rows as nullable user references and preserve timestamps. The target uses a generated numeric log ID, so the legacy string ID is retained in migration audit metadata rather than treated as the new primary key. |
| `student_id_sequence` | `student_id_sequence` | Preserve sequence values, and verify they are not below migrated numeric IDs. |

Known `lms_records` resource names in the application include settings,
assignments, assessments, assessment questions/attempts, announcements,
submissions, scores, notifications, materials, calendar events, and profile
photos. Generic payload compatibility must be retained for records that are
not yet represented by validated typed transformations. The current source
has no attendance records/table to migrate.

## Required migration stages

1. Implement and review the normalized-schema API adapter for every existing
   endpoint before switching the application. This is not complete yet.
2. Take and verify a restorable backup of `snhs_lms`; keep the original
   database available and unchanged.
3. Generate a read-only migration report with source/target counts, duplicate
   keys, unresolved foreign keys, conflicting section/class data, and
   resource-by-resource JSON validation. Exclude password values/hashes.
4. Require the user's explicit approval of that report and the exact migration
   execution.
5. Run the migration into `lms_clean` in a transaction where possible; preserve
   all user password hashes unchanged. Record exceptions in a quarantine
   report rather than guessing relationships.
6. Validate row counts, foreign keys, active/historical enrollments, section
   and subject assignments, authentication, and all API/UI workflows. Compare
   migrated IDs and records against the source before any cutover.
7. Cut over only after separate explicit approval. Change `DB_NAME` in the
   local environment to `lms_clean`, retain the old DB and backup, and define a
   rollback procedure before deployment.

Until stages 1–4 are complete, keep production on `snhs_lms`.
