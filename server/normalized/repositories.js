function normalizeText(value) {
  return String(value || "").trim()
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeStatus(value, fallback = "active") {
  return normalizeText(value).toLowerCase() || fallback
}

function toLegacyUser(row) {
  if (!row) return null

  return {
    id: row.user_id,

    name: row.full_name,

    email: row.email,

    role: row.role_name,

    status: row.status,

    password: row.password_hash,
  }
}

export function createNormalizedRepositories(pool) {
  const users = {
    async findForAuthentication(identifier) {
      const [rows] = await pool.query(
        `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.status,
                r.role_name
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         WHERE (u.user_id = ? OR LOWER(u.email) = LOWER(?))
         LIMIT 1`,

        [normalizeText(identifier), normalizeText(identifier)],
      )

      return toLegacyUser(rows[0])
    },

    async list(roleName) {
      const [rows] = await pool.query(
        `SELECT u.user_id AS id, u.full_name AS name, u.email, u.status,
                r.role_name AS role
         FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE (? = '' OR r.role_name = ?)
         ORDER BY u.full_name, u.user_id`,

        [roleName || "", roleName || ""],
      )

      return rows
    },

    async findById(userId) {
      const [rows] = await pool.query(
        `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.status,
                r.role_name
         FROM users u JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = ? LIMIT 1`,

        [userId],
      )

      return toLegacyUser(rows[0])
    },

    async updateProfile(userId, { name, email }) {
      const [result] = await pool.query(
        `UPDATE users SET full_name = ?, email = ?
         WHERE user_id = ?`,

        [normalizeText(name), normalizeText(email).toLowerCase(), userId],
      )

      return result.affectedRows > 0
    },

    async updatePassword(userId, passwordHash) {
      const [result] = await pool.query(
        "UPDATE users SET password_hash = ? WHERE user_id = ?",

        [passwordHash, userId],
      )

      return result.affectedRows > 0
    },

    async create(connection, { id, role, name, email, passwordHash, status }) {
      const [roles] = await connection.query(
        "SELECT role_id FROM roles WHERE role_name = ? LIMIT 1",

        [role],
      )

      if (!roles.length)
        throw new Error("Requested account role is not configured.")

      await connection.query(
        `INSERT INTO users
          (user_id, role_id, full_name, email, password_hash, status)
         VALUES (?, ?, ?, ?, ?, ?)`,

        [
          id,

          roles[0].role_id,

          normalizeText(name),

          normalizeText(email).toLowerCase(),

          passwordHash,

          normalizeText(status) || "active",
        ],
      )
    },
  }

  const academics = {
    async listYears() {
      const [rows] = await pool.query(
        `SELECT academic_year_id AS id, year_code AS code, starts_on AS startsOn,
                ends_on AS endsOn, status, is_current AS isCurrent
         FROM academic_years ORDER BY year_code DESC`,
      )

      return rows
    },

    async listGrades() {
      const [rows] = await pool.query(
        "SELECT grade_level_id AS id, grade_number AS number, grade_name AS name FROM grade_levels ORDER BY grade_number",
      )

      return rows
    },

    async listStrands() {
      const [rows] = await pool.query(
        "SELECT strand_id AS id, strand_code AS code, strand_name AS name FROM strands ORDER BY strand_name",
      )

      return rows
    },

    async currentYear(connection = pool) {
      const [rows] = await connection.query(
        `SELECT academic_year_id AS id, year_code AS code
         FROM academic_years WHERE is_current = 1 LIMIT 1`,
      )

      return rows[0] || null
    },
  }

  const sections = {
    async find(code, connection = pool, lock = false) {
      const [rows] = await connection.query(
        `SELECT cs.class_section_id AS id, cs.section_code AS code,
                cs.section_name AS name, cs.section_letter AS section,
                cs.status, cs.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear, ay.is_current AS isCurrent,
                gl.grade_level_id AS gradeLevelId, gl.grade_name AS gradeLevel,
                gl.grade_number AS gradeNumber, s.strand_id AS strandId,
                s.strand_code AS strand, s.strand_name AS strandName,
                adviser.user_id AS adviserId, adviser.full_name AS adviser
         FROM class_sections cs
         JOIN academic_years ay ON ay.academic_year_id = cs.academic_year_id
         JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         JOIN strands s ON s.strand_id = cs.strand_id
         LEFT JOIN teacher_assignments ta
           ON ta.class_section_id = cs.class_section_id
          AND ta.academic_year_id = cs.academic_year_id
          AND ta.assignment_type = 'adviser' AND ta.status = 'active'
         LEFT JOIN users adviser ON adviser.user_id = ta.teacher_id
         WHERE cs.section_code = ?
         LIMIT 1${lock ? " FOR UPDATE" : ""}`,

        [normalizeCode(code)],
      )

      return rows[0] || null
    },

    async list({
      academicYearId,
      gradeLevelId,
      strandId,
      activeOnly = false,
    } = {}) {
      const filters = []

      const values = []

      if (academicYearId) {
        filters.push("cs.academic_year_id = ?")

        values.push(academicYearId)
      } else {
        filters.push("ay.is_current = 1")
      }

      if (gradeLevelId) {
        filters.push("cs.grade_level_id = ?")

        values.push(gradeLevelId)
      }

      if (strandId) {
        filters.push("cs.strand_id = ?")

        values.push(strandId)
      }

      if (activeOnly) {
        filters.push("cs.status = 'active'")

        filters.push("ay.status = 'active'")
      }

      const [rows] = await pool.query(
        `SELECT cs.class_section_id AS id, cs.section_code AS code,
                cs.section_name AS name, cs.section_letter AS section,
                cs.status, cs.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear, ay.is_current AS isCurrent,
                gl.grade_level_id AS gradeLevelId, gl.grade_name AS gradeLevel,
                gl.grade_number AS gradeNumber, s.strand_id AS strandId,
                s.strand_code AS strand, s.strand_name AS strandName,
                adviser.user_id AS adviserId, adviser.full_name AS adviser
         FROM class_sections cs
         JOIN academic_years ay ON ay.academic_year_id = cs.academic_year_id
         JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         JOIN strands s ON s.strand_id = cs.strand_id
         LEFT JOIN teacher_assignments ta
           ON ta.class_section_id = cs.class_section_id
          AND ta.academic_year_id = cs.academic_year_id
          AND ta.assignment_type = 'adviser' AND ta.status = 'active'
         LEFT JOIN users adviser ON adviser.user_id = ta.teacher_id
         WHERE ${filters.join(" AND ")}
         ORDER BY gl.grade_number, s.strand_name, cs.section_letter`,

        values,
      )

      return rows
    },

    async create(input) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        if (input.adviserId) {
          const [teachers] = await connection.query(
            `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = ? AND r.role_name = 'teacher'
               AND u.status = 'active' FOR UPDATE`,

            [input.adviserId],
          )

          if (!teachers.length)
            throw new Error("Choose an active teacher account.")
        }

        const [result] = await connection.query(
          `INSERT INTO class_sections
            (section_code, section_name, academic_year_id, grade_level_id,
             strand_id, section_letter, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,

          [
            normalizeCode(input.code),

            normalizeText(input.name),

            input.academicYearId,

            input.gradeLevelId,

            input.strandId,

            normalizeCode(input.sectionLetter),

            normalizeStatus(input.status),
          ],
        )

        if (input.adviserId) {
          await connection.query(
            `INSERT INTO teacher_assignments
              (teacher_id, class_section_id, academic_year_id, assignment_type, status)
             VALUES (?, ?, ?, 'adviser', 'active')`,

            [input.adviserId, result.insertId, input.academicYearId],
          )
        }

        await connection.commit()

        return result.insertId
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async update(code, input) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [currentRows] = await connection.query(
          `SELECT class_section_id AS id, academic_year_id AS academicYearId
           FROM class_sections WHERE section_code = ? FOR UPDATE`,

          [normalizeCode(code)],
        )

        const current = currentRows[0]

        if (!current) {
          await connection.rollback()

          return false
        }

        if (input.adviserId) {
          const [teachers] = await connection.query(
            `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = ? AND r.role_name = 'teacher'
               AND u.status = 'active' FOR UPDATE`,

            [input.adviserId],
          )

          if (!teachers.length)
            throw new Error("Choose an active teacher account.")
        }

        const [result] = await connection.query(
          `UPDATE class_sections
           SET section_name = ?, academic_year_id = ?, grade_level_id = ?,
               strand_id = ?, section_letter = ?, status = ?
           WHERE class_section_id = ?`,

          [
            normalizeText(input.name),

            input.academicYearId,

            input.gradeLevelId,

            input.strandId,

            normalizeCode(input.sectionLetter),

            normalizeStatus(input.status),

            current.id,
          ],
        )

        if (input.adviserId) {
          await connection.query(
            `UPDATE teacher_assignments SET status = 'ended',
               ended_at = CURRENT_TIMESTAMP
             WHERE class_section_id = ? AND academic_year_id = ?
               AND assignment_type = 'adviser' AND status = 'active'
               AND teacher_id <> ?`,

            [current.id, current.academicYearId, input.adviserId],
          )

          await connection.query(
            `INSERT INTO teacher_assignments
              (teacher_id, class_section_id, academic_year_id, assignment_type, status)
             VALUES (?, ?, ?, 'adviser', 'active')
             ON DUPLICATE KEY UPDATE status = 'active', ended_at = NULL`,

            [input.adviserId, current.id, input.academicYearId],
          )
        }

        await connection.commit()

        return result.affectedRows > 0
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async setStatus(code, status) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [rows] = await connection.query(
          `SELECT class_section_id AS id, academic_year_id AS academicYearId
           FROM class_sections WHERE section_code = ? FOR UPDATE`,

          [normalizeCode(code)],
        )

        if (!rows.length) {
          await connection.rollback()

          return false
        }

        const section = rows[0]

        await connection.query(
          "UPDATE class_sections SET status = ? WHERE class_section_id = ?",

          [status, section.id],
        )

        if (status !== "active") {
          await connection.query(
            `UPDATE teacher_assignments SET status = 'ended',
               ended_at = CURRENT_TIMESTAMP
             WHERE class_section_id = ? AND status = 'active'`,

            [section.id],
          )

          await connection.query(
            "UPDATE subject_assignments SET status = 'inactive' WHERE class_section_id = ? AND status = 'active'",

            [section.id],
          )

          await connection.query(
            `UPDATE subject_enrollments SET enrollment_status = 'ended',
               ended_at = CURRENT_TIMESTAMP
             WHERE enrollment_status = 'active'
               AND subject_assignment_id IN (
                 SELECT subject_assignment_id FROM subject_assignments
                 WHERE class_section_id = ? AND status = 'inactive'
               )`,

            [section.id],
          )
        }

        await connection.commit()

        return true
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },
  }

  const students = {
    async list() {
      const [rows] = await pool.query(
        `SELECT u.user_id AS id, u.full_name AS name, u.email, u.status,
                gl.grade_name AS gradeLevel, s.strand_code AS strand,
                se.class_section_id AS classSectionId,
                cs.section_code AS classSectionCode,
                cs.section_name AS classSectionName,
                cs.section_letter AS section,
                ay.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear,
                se.enrollment_status AS enrollmentStatus
         FROM users u
         JOIN roles r ON r.role_id = u.role_id AND r.role_name = 'student'
         LEFT JOIN student_enrollments se
           ON se.student_id = u.user_id
          AND se.enrollment_status = 'active'
          AND se.academic_year_id = (
            SELECT academic_year_id FROM academic_years WHERE is_current = 1 LIMIT 1
          )
         LEFT JOIN class_sections cs
           ON cs.class_section_id = se.class_section_id
          AND cs.academic_year_id = se.academic_year_id
         LEFT JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         LEFT JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         LEFT JOIN strands s ON s.strand_id = cs.strand_id
         ORDER BY u.full_name, ay.is_current DESC`,
      )

      return rows
    },

    async find(id) {
      const [rows] = await pool.query(
        `SELECT u.user_id AS id, u.full_name AS name, u.email, u.status,
                gl.grade_name AS gradeLevel, s.strand_code AS strand,
                cs.class_section_id AS classSectionId,
                cs.section_code AS classSectionCode,
                cs.section_name AS classSectionName,
                cs.section_letter AS section,
                ay.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear,
                se.enrollment_status AS enrollmentStatus
         FROM users u
         JOIN roles r ON r.role_id = u.role_id AND r.role_name = 'student'
         LEFT JOIN student_enrollments se
           ON se.student_id = u.user_id
          AND se.enrollment_status = 'active'
          AND se.academic_year_id = (
            SELECT academic_year_id FROM academic_years WHERE is_current = 1 LIMIT 1
          )
         LEFT JOIN class_sections cs
           ON cs.class_section_id = se.class_section_id
          AND cs.academic_year_id = se.academic_year_id
         LEFT JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         LEFT JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         LEFT JOIN strands s ON s.strand_id = cs.strand_id
         WHERE u.user_id = ? ORDER BY ay.is_current DESC LIMIT 1`,

        [id],
      )

      return rows[0] || null
    },

    async create({
      name,
      email,
      passwordHash,
      status,
      academicYearId,
      gradeLevelId,
      strandId,
      sectionCode,
    }) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [yearRows] = await connection.query(
          "SELECT academic_year_id FROM academic_years WHERE academic_year_id = ? AND status = 'active' FOR UPDATE",

          [academicYearId],
        )

        if (!yearRows.length) throw new Error("Choose an active academic year.")

        const [gradeRows] = await connection.query(
          "SELECT grade_level_id FROM grade_levels WHERE grade_level_id = ?",

          [gradeLevelId],
        )

        if (!gradeRows.length) throw new Error("Choose a valid grade level.")

        const [strandRows] = await connection.query(
          "SELECT strand_id FROM strands WHERE strand_id = ?",

          [strandId],
        )

        if (!strandRows.length) throw new Error("Choose a valid strand.")

        const section = await sections.find(sectionCode, connection, true)

        if (
          !section ||
          section.status !== "active" ||
          Number(section.academicYearId) !== Number(academicYearId) ||
          Number(section.gradeLevelId) !== Number(gradeLevelId) ||
          Number(section.strandId) !== Number(strandId)
        ) {
          throw new Error(
            "Choose an active section matching the academic year, grade, and strand.",
          )
        }

        await connection.query(
          `INSERT INTO student_id_sequence (sequence_name, \`last_value\`)
           SELECT 'students',
             GREATEST(26000, COALESCE(MAX(CAST(u.user_id AS UNSIGNED)), 0))
           FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE r.role_name = 'student'
           ON DUPLICATE KEY UPDATE sequence_name = VALUES(sequence_name)`,
        )

        const [sequenceRows] = await connection.query(
          "SELECT `last_value` FROM student_id_sequence WHERE sequence_name = 'students' FOR UPDATE",
        )

        if (!sequenceRows.length)
          throw new Error("Student ID sequence is not configured.")

        const nextId = (BigInt(sequenceRows[0].last_value) + 1n).toString()

        await connection.query(
          "UPDATE student_id_sequence SET `last_value` = ? WHERE sequence_name = 'students'",

          [nextId],
        )

        await users.create(connection, {
          id: nextId,

          role: "student",

          name,

          email,

          passwordHash,

          status: normalizeStatus(status),
        })

        await connection.query(
          `INSERT INTO student_enrollments
            (student_id, academic_year_id, class_section_id, enrollment_status)
           VALUES (?, ?, ?, 'active')`,

          [nextId, academicYearId, section.id],
        )

        await connection.query(
          `INSERT INTO subject_enrollments
            (student_id, subject_assignment_id, academic_year_id, enrollment_status)
           SELECT ?, sa.subject_assignment_id, ?, 'active'
           FROM subject_assignments sa
           WHERE sa.class_section_id = ? AND sa.academic_year_id = ?
             AND sa.status = 'active'
           ON DUPLICATE KEY UPDATE enrollment_status = 'active', ended_at = NULL`,

          [nextId, academicYearId, section.id, academicYearId],
        )

        await connection.commit()

        return { ...(await students.find(nextId)), id: nextId }
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async update(
      id,
      {
        name,
        email,
        status,
        academicYearId,
        gradeLevelId,
        strandId,
        sectionCode,
      },
    ) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [studentRows] = await connection.query(
          `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE u.user_id = ? AND r.role_name = 'student' FOR UPDATE`,

          [id],
        )

        if (!studentRows.length) throw new Error("Student not found.")

        const [yearRows] = await connection.query(
          "SELECT academic_year_id FROM academic_years WHERE academic_year_id = ? AND status = 'active' FOR UPDATE",

          [academicYearId],
        )

        if (!yearRows.length) throw new Error("Choose an active academic year.")

        const [gradeRows] = await connection.query(
          "SELECT grade_level_id FROM grade_levels WHERE grade_level_id = ?",

          [gradeLevelId],
        )

        if (!gradeRows.length) throw new Error("Choose a valid grade level.")

        const [strandRows] = await connection.query(
          "SELECT strand_id FROM strands WHERE strand_id = ?",

          [strandId],
        )

        if (!strandRows.length) throw new Error("Choose a valid strand.")

        const section = await sections.find(sectionCode, connection, true)

        if (
          !section ||
          Number(section.academicYearId) !== Number(academicYearId) ||
          Number(section.gradeLevelId) !== Number(gradeLevelId) ||
          Number(section.strandId) !== Number(strandId)
        ) {
          throw new Error(
            "Choose an active section matching the academic year, grade, and strand.",
          )
        }

        const [currentRows] = await connection.query(
          `SELECT student_enrollment_id AS id, student_id AS studentId,
                  academic_year_id AS academicYearId,
                  class_section_id AS classSectionId,
                  enrollment_status AS status, enrolled_at AS enrolledAt
           FROM student_enrollments
           WHERE student_id = ? AND academic_year_id = ?
           FOR UPDATE`,

          [id, academicYearId],
        )

        const current = currentRows[0]

        if (
          section.status !== "active" &&
          (!current || Number(current.classSectionId) !== Number(section.id))
        ) {
          throw new Error(
            "Choose an active section matching the academic year, grade, and strand.",
          )
        }

        const [otherEnrollments] = await connection.query(
          `SELECT student_enrollment_id AS id, academic_year_id AS academicYearId,
                  class_section_id AS classSectionId, enrollment_status AS status,
                  enrolled_at AS enrolledAt
           FROM student_enrollments
           WHERE student_id = ? AND academic_year_id <> ?
             AND enrollment_status = 'active'
           FOR UPDATE`,

          [id, academicYearId],
        )

        for (const enrollment of otherEnrollments) {
          await connection.query(
            `INSERT INTO student_enrollment_history
              (student_id, academic_year_id, class_section_id,
               enrollment_status, enrolled_at, ended_at)
             VALUES (?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP)`,

            [
              id,
              enrollment.academicYearId,
              enrollment.classSectionId,
              enrollment.enrolledAt,
            ],
          )

          await connection.query(
            `UPDATE student_enrollments
             SET enrollment_status = 'completed', ended_at = CURRENT_TIMESTAMP
             WHERE student_enrollment_id = ?`,

            [enrollment.id],
          )

          await connection.query(
            `UPDATE subject_enrollments SET enrollment_status = 'ended',
               ended_at = CURRENT_TIMESTAMP
             WHERE student_id = ? AND academic_year_id = ?
               AND enrollment_status = 'active'`,

            [id, enrollment.academicYearId],
          )
        }

        if (current && Number(current.classSectionId) !== Number(section.id)) {
          await connection.query(
            `INSERT INTO student_enrollment_history
              (student_id, academic_year_id, class_section_id,
               enrollment_status, enrolled_at, ended_at)
             VALUES (?, ?, ?, 'transferred', ?, CURRENT_TIMESTAMP)`,

            [id, academicYearId, current.classSectionId, current.enrolledAt],
          )

          await connection.query(
            `UPDATE subject_enrollments se
             JOIN subject_assignments sa
               ON sa.subject_assignment_id = se.subject_assignment_id
             SET se.enrollment_status = 'ended', se.ended_at = CURRENT_TIMESTAMP
             WHERE se.student_id = ? AND sa.class_section_id = ?
               AND sa.academic_year_id = ? AND se.enrollment_status = 'active'`,

            [id, current.classSectionId, academicYearId],
          )

          await connection.query(
            `UPDATE student_enrollments
             SET class_section_id = ?, enrollment_status = 'active',
                 enrolled_at = CURRENT_TIMESTAMP, ended_at = NULL
             WHERE student_enrollment_id = ?`,

            [section.id, current.id],
          )
        } else if (!current) {
          await connection.query(
            `INSERT INTO student_enrollments
              (student_id, academic_year_id, class_section_id, enrollment_status)
             VALUES (?, ?, ?, 'active')`,

            [id, academicYearId, section.id],
          )
        }

        await connection.query(
          `INSERT INTO subject_enrollments
            (student_id, subject_assignment_id, academic_year_id, enrollment_status)
           SELECT ?, sa.subject_assignment_id, ?, 'active'
           FROM subject_assignments sa
           WHERE sa.class_section_id = ? AND sa.academic_year_id = ?
             AND sa.status = 'active'
           ON DUPLICATE KEY UPDATE enrollment_status = 'active', ended_at = NULL`,

          [id, academicYearId, section.id, academicYearId],
        )

        await connection.query(
          `UPDATE users SET full_name = ?, email = ?, status = ?
           WHERE user_id = ?`,

          [
            normalizeText(name),
            normalizeText(email).toLowerCase(),
            normalizeStatus(status),
            id,
          ],
        )

        await connection.commit()

        return await students.find(id)
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },
  }

  const teachers = {
    async list() {
      const [rows] = await pool.query(
        `SELECT u.user_id AS id, u.full_name AS name, u.email, u.status,
                COALESCE(GROUP_CONCAT(DISTINCT s.subject_name ORDER BY s.subject_name SEPARATOR ', '), '') AS subject
         FROM users u JOIN roles r ON r.role_id = u.role_id
         LEFT JOIN subject_assignments sa
           ON sa.teacher_id = u.user_id AND sa.status = 'active'
         LEFT JOIN subjects s ON s.subject_id = sa.subject_id
         WHERE r.role_name = 'teacher'
         GROUP BY u.user_id, u.full_name, u.email, u.status
         ORDER BY u.full_name, u.user_id`,
      )

      return rows
    },

    async create({ name, email, passwordHash, status }) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        await connection.query(
          `INSERT INTO student_id_sequence (sequence_name, \`last_value\`)
           SELECT 'teachers', GREATEST(2026000, COALESCE((
             SELECT MAX(CAST(u.user_id AS UNSIGNED))
             FROM users u JOIN roles r ON r.role_id = u.role_id
             WHERE r.role_name = 'teacher'
           ), 0))
           ON DUPLICATE KEY UPDATE sequence_name = VALUES(sequence_name)`,
        )

        const [sequenceRows] = await connection.query(
          "SELECT `last_value` FROM student_id_sequence WHERE sequence_name = 'teachers' FOR UPDATE",
        )

        const nextId = (BigInt(sequenceRows[0].last_value) + 1n).toString()

        await connection.query(
          "UPDATE student_id_sequence SET `last_value` = ? WHERE sequence_name = 'teachers'",

          [nextId],
        )

        await users.create(connection, {
          id: nextId,

          role: "teacher",

          name,

          email,

          passwordHash,

          status: normalizeStatus(status),
        })

        await connection.commit()

        return {
          id: nextId,

          name: normalizeText(name),

          email: normalizeText(email).toLowerCase(),

          status: normalizeStatus(status),
        }
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async update(id, { name, email, status }) {
      const [result] = await pool.query(
        `UPDATE users u JOIN roles r ON r.role_id = u.role_id
         SET u.full_name = ?, u.email = ?, u.status = ?
         WHERE u.user_id = ? AND r.role_name = 'teacher'`,

        [
          normalizeText(name),
          normalizeText(email).toLowerCase(),
          normalizeStatus(status),
          id,
        ],
      )

      return result.affectedRows > 0
    },
  }

  const assignments = {
    async listTeachersForSection(sectionCode) {
      const [rows] = await pool.query(
        `SELECT ta.teacher_assignment_id AS id, ta.teacher_id AS teacherId,
                u.full_name AS teacherName, ta.assignment_type AS type,
                ta.status, ay.year_code AS schoolYear
         FROM teacher_assignments ta
         JOIN class_sections cs ON cs.class_section_id = ta.class_section_id
         JOIN academic_years ay ON ay.academic_year_id = ta.academic_year_id
         JOIN users u ON u.user_id = ta.teacher_id
         WHERE cs.section_code = ? ORDER BY ay.year_code DESC, ta.assignment_type`,

        [normalizeCode(sectionCode)],
      )

      return rows
    },

    async assignTeacher({
      teacherId,
      sectionCode,
      academicYearId,
      type = "teacher",
    }) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const section = await sections.find(sectionCode, connection, true)

        if (
          !section ||
          Number(section.academicYearId) !== Number(academicYearId)
        ) {
          throw new Error("Choose a section from the selected academic year.")
        }

        const [teacherRows] = await connection.query(
          `SELECT u.user_id FROM users u JOIN roles r ON r.role_id = u.role_id
           WHERE u.user_id = ? AND r.role_name = 'teacher' AND u.status = 'active'
           FOR UPDATE`,

          [teacherId],
        )

        if (!teacherRows.length)
          throw new Error("Choose an active teacher account.")

        await connection.query(
          `INSERT INTO teacher_assignments
            (teacher_id, class_section_id, academic_year_id, assignment_type, status)
           VALUES (?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE status = 'active', ended_at = NULL`,

          [teacherId, section.id, academicYearId, type],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async saveSubjectAssignments({
      sectionCode,

      schoolYear,

      semester,

      selectedAssignments,

      removeSubjectCodes = [],
    }) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [yearRows] = await connection.query(
          "SELECT academic_year_id AS id FROM academic_years WHERE year_code = ? AND status = 'active' FOR UPDATE",

          [normalizeText(schoolYear)],
        )

        if (!yearRows.length) throw new Error("Choose an active academic year.")

        const yearId = yearRows[0].id

        const section = await sections.find(sectionCode, connection, true)

        if (!section || Number(section.academicYearId) !== Number(yearId)) {
          throw new Error("Choose a section from the selected academic year.")
        }

        for (const subjectCode of removeSubjectCodes) {
          const [assignmentRows] = await connection.query(
            `SELECT subject_assignment_id AS id FROM subject_assignments
             WHERE subject_id = (SELECT subject_id FROM subjects WHERE subject_code = ?)
               AND class_section_id = ? AND academic_year_id = ?
               AND semester = ? AND status = 'active'
             FOR UPDATE`,

            [
              normalizeCode(subjectCode),
              section.id,
              yearId,
              normalizeText(semester),
            ],
          )

          for (const assignment of assignmentRows) {
            await connection.query(
              `UPDATE subject_assignments SET status = 'inactive'
               WHERE subject_assignment_id = ?`,

              [assignment.id],
            )

            await connection.query(
              `UPDATE subject_enrollments
               SET enrollment_status = 'ended', ended_at = CURRENT_TIMESTAMP
               WHERE subject_assignment_id = ? AND enrollment_status = 'active'`,

              [assignment.id],
            )
          }
        }

        for (const input of selectedAssignments) {
          const [subjectRows] = await connection.query(
            `SELECT subject_id AS id, grade_level_id AS gradeLevelId,
                    strand_id AS strandId
             FROM subjects WHERE subject_code = ? AND status = 'active'
             FOR UPDATE`,

            [normalizeCode(input.subjectCode)],
          )

          const subject = subjectRows[0]

          if (!subject) throw new Error("Choose a valid active subject.")

          if (
            (subject.gradeLevelId &&
              Number(subject.gradeLevelId) !== Number(section.gradeLevelId)) ||
            (subject.strandId &&
              Number(subject.strandId) !== Number(section.strandId))
          ) {
            throw new Error(
              "The subject does not match the section's grade and strand.",
            )
          }

          const teacherIdentifier = normalizeText(input.teacher)

          const [teacherRows] = await connection.query(
            `SELECT u.user_id AS id FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE (u.user_id = ? OR LOWER(u.full_name) = LOWER(?))
               AND r.role_name = 'teacher' AND u.status = 'active'
             LIMIT 2 FOR UPDATE`,

            [teacherIdentifier, teacherIdentifier],
          )

          if (teacherRows.length !== 1) {
            throw new Error(
              teacherRows.length
                ? "The selected teacher name is ambiguous; select a verified teacher account."
                : "Choose an active teacher account.",
            )
          }

          const teacherId = teacherRows[0].id

          await connection.query(
            `INSERT INTO subject_assignments
              (subject_id, teacher_id, class_section_id, academic_year_id,
               semester, status)
             VALUES (?, ?, ?, ?, ?, 'active')
             ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), status = 'active'`,

            [
              subject.id,
              teacherId,
              section.id,
              yearId,
              normalizeText(semester),
            ],
          )

          const [assignmentRows] = await connection.query(
            `SELECT subject_assignment_id AS id FROM subject_assignments
             WHERE subject_id = ? AND class_section_id = ?
               AND academic_year_id = ? AND semester = ? LIMIT 1`,

            [subject.id, section.id, yearId, normalizeText(semester)],
          )

          await connection.query(
            `INSERT INTO subject_enrollments
              (student_id, subject_assignment_id, academic_year_id, enrollment_status)
             SELECT se.student_id, ?, ?, 'active'
             FROM student_enrollments se
             WHERE se.class_section_id = ? AND se.academic_year_id = ?
               AND se.enrollment_status = 'active'
             ON DUPLICATE KEY UPDATE enrollment_status = 'active', ended_at = NULL`,

            [assignmentRows[0].id, yearId, section.id, yearId],
          )
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    },

    async setSubjectAssignmentStatus(id, status) {
      const [result] = await pool.query(
        "UPDATE subject_assignments SET status = ? WHERE subject_assignment_id = ?",

        [status, id],
      )

      return result.affectedRows > 0
    },
  }

  const subjects = {
    async list() {
      const [rows] = await pool.query(
        `SELECT s.subject_id AS id, s.subject_code AS code,
                s.subject_name AS name, s.description, s.units,
                gl.grade_name AS gradeLevel, gl.grade_number AS gradeNumber,
                st.strand_code AS strand, s.status,
                COALESCE(GROUP_CONCAT(DISTINCT sa.semester ORDER BY sa.semester SEPARATOR ', '), '') AS semester
         FROM subjects s
         LEFT JOIN grade_levels gl ON gl.grade_level_id = s.grade_level_id
         LEFT JOIN strands st ON st.strand_id = s.strand_id
         LEFT JOIN subject_assignments sa
           ON sa.subject_id = s.subject_id AND sa.status = 'active'
         GROUP BY s.subject_id, s.subject_code, s.subject_name, s.description,
                  s.units, gl.grade_name, gl.grade_number, st.strand_code, s.status
         ORDER BY s.subject_code`,
      )

      return rows
    },

    async create(input) {
      const [result] = await pool.query(
        `INSERT INTO subjects
          (subject_code, subject_name, description, units, grade_level_id,
           strand_id, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,

        [
          normalizeCode(input.code),

          normalizeText(input.name),

          normalizeText(input.description),

          Number(input.units || 0),

          input.gradeLevelId || null,

          input.strandId || null,
        ],
      )

      return result.insertId
    },

    async update(code, input) {
      const [result] = await pool.query(
        `UPDATE subjects SET subject_name = ?, description = ?, units = ?,
           grade_level_id = ?, strand_id = ?, status = ?
         WHERE subject_code = ?`,

        [
          normalizeText(input.name),

          normalizeText(input.description),

          Number(input.units || 0),

          input.gradeLevelId || null,

          input.strandId || null,

          normalizeStatus(input.status),

          normalizeCode(code),
        ],
      )

      return result.affectedRows > 0
    },
  }

  const records = {
    async list(resource, { scopeId, ownerId } = {}) {
      const filters = ["resource = ?"]

      const values = [resource]

      if (scopeId !== undefined) {
        filters.push("scope_id = ?")

        values.push(scopeId)
      }

      if (ownerId !== undefined) {
        filters.push("owner_id = ?")

        values.push(ownerId)
      }

      const [rows] = await pool.query(
        `SELECT record_id AS id, scope_id AS scopeId, owner_id AS ownerId,
                payload, updated_at AS updatedAt
         FROM lms_records WHERE ${filters.join(" AND ")}
         ORDER BY updated_at DESC`,

        values,
      )

      return rows.map((row) => ({
        ...(typeof row.payload === "string"
          ? JSON.parse(row.payload)
          : row.payload),

        id: row.id,

        scopeId: row.scopeId,

        ownerId: row.ownerId,

        updatedAt: row.updatedAt,
      }))
    },

    async find(resource, id) {
      const [rows] = await pool.query(
        `SELECT record_id AS id, scope_id AS scopeId, owner_id AS ownerId,
                payload, updated_at AS updatedAt
         FROM lms_records WHERE resource = ? AND record_id = ? LIMIT 1`,

        [resource, id],
      )

      const row = rows[0]

      if (!row) return null

      return {
        ...(typeof row.payload === "string"
          ? JSON.parse(row.payload)
          : row.payload),

        id: row.id,

        scopeId: row.scopeId,

        ownerId: row.ownerId,

        updatedAt: row.updatedAt,
      }
    },

    async save(resource, id, scopeId, ownerId, payload) {
      await pool.query(
        `INSERT INTO lms_records (resource, record_id, scope_id, owner_id, payload)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE scope_id = VALUES(scope_id),
           owner_id = VALUES(owner_id), payload = VALUES(payload)`,

        [resource, id, scopeId || "", ownerId || "", JSON.stringify(payload)],
      )

      return await this.find(resource, id)
    },

    async remove(resource, id) {
      const [result] = await pool.query(
        "DELETE FROM lms_records WHERE resource = ? AND record_id = ?",

        [resource, id],
      )

      return result.affectedRows > 0
    },
  }

  const logs = {
    async list() {
      const [rows] = await pool.query(
        `SELECT al.activity_log_id AS id, al.message, al.user_id AS userId,
                al.action, al.module, al.status, al.created_at AS createdAt
         FROM activity_logs al ORDER BY al.created_at DESC LIMIT 500`,
      )

      return rows
    },

    async record({ userId, action, module, status }) {
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, module, status, message)
         VALUES (?, ?, ?, ?, ?)`,

        [userId || null, action, module, status, action],
      )
    },
  }

  return {
    users,
    academics,
    sections,
    students,
    teachers,
    assignments,
    subjects,
    records,
    logs,
  }
}
