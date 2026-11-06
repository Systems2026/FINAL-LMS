import crypto from "node:crypto"

import express from "express"

import { createNormalizedRepositories } from "./repositories.js"

const recordResources = new Set([
  "assignments",

  "assessment-questions",

  "assessment-attempts",

  "assessments",

  "attendance",

  "calendar-events",

  "classes",

  "class-content",

  "class-statuses",

  "grades",

  "lessons",

  "materials",

  "notifications",

  "profile-photos",

  "scores",

  "settings",

  "submissions",

  "announcements",
])

const sectionScopedResources = new Set([
  "assignments",

  "assessment-questions",

  "assessments",

  "attendance",

  "class-content",

  "grades",

  "lessons",

  "materials",

  "scores",
])

function sendError(res, error, message) {
  const expected = [
    "Choose an active academic year.",

    "Choose a valid grade level.",

    "Choose a valid strand.",

    "Choose an active section matching the academic year, grade, and strand.",

    "Choose a section from the selected academic year.",

    "Choose an active teacher account.",

    "Choose a valid active subject.",

    "The subject does not match the section's grade and strand.",

    "The selected teacher name is ambiguous; select a verified teacher account.",

    "The selected adviser name is ambiguous; select a verified teacher account.",

    "Student not found.",

    "Student ID sequence is not configured.",

    "Requested account role is not configured.",
  ]

  if (expected.includes(error.message)) {
    return res.status(error.message === "Student not found." ? 404 : 400).json({
      ok: false,

      message: error.message,
    })
  }

  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      ok: false,

      message: "An account or record with those details already exists.",
    })
  }

  console.error(message, error)

  return res.status(500).json({ ok: false, message })
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim())
}

function getIdValue(value) {
  return value === undefined || value === null || value === ""
    ? undefined
    : value
}

export function createNormalizedApi({
  pool,
  sessions,
  hashPassword,
  verifyPassword,
}) {
  const repositories = createNormalizedRepositories(pool)

  const router = express.Router()

  const {
    academics,
    assignments,
    logs,
    records,
    sections,
    students,
    subjects,
    teachers,
    users,
  } = repositories

  const getCurrentYearId = async () => {
    const year = await academics.currentYear()

    return year?.id
  }

  const getAccessibleSectionCodes = async (user) => {
    if (user.role === "admin") return null

    const [rows] = await pool.query(
      user.role === "student"
        ? `SELECT DISTINCT cs.section_code AS code
           FROM student_enrollments se
           JOIN class_sections cs ON cs.class_section_id = se.class_section_id
           WHERE se.student_id = ? AND se.enrollment_status = 'active'`
        : `SELECT DISTINCT cs.section_code AS code
           FROM teacher_assignments ta
           JOIN class_sections cs ON cs.class_section_id = ta.class_section_id
           WHERE ta.teacher_id = ? AND ta.status = 'active'
           UNION
           SELECT DISTINCT cs.section_code AS code
           FROM subject_assignments sa
           JOIN class_sections cs ON cs.class_section_id = sa.class_section_id
           WHERE sa.teacher_id = ? AND sa.status = 'active'`,

      user.role === "student" ? [user.id] : [user.id, user.id],
    )

    return new Set(rows.map((row) => row.code))
  }

  const canAccessRecord = (record, resource, user, scopeCodes) => {
    if (user.role === "admin") return true

    if (resource === "classes") return false

    if (["notifications", "profile-photos", "submissions"].includes(resource)) {
      return String(record.ownerId || "") === String(user.id)
    }

    if (resource === "scores" || resource === "grades") {
      if (user.role === "teacher") {
        return Boolean(
          record.scopeId && scopeCodes?.has(String(record.scopeId)),
        )
      }

      return (
        String(record.studentId || record.ownerId || "") === String(user.id)
      )
    }

    if (resource === "attendance") {
      if (user.role === "student") {
        return (
          String(record.studentId || record.ownerId || "") === String(user.id)
        )
      }

      return Boolean(record.scopeId && scopeCodes?.has(String(record.scopeId)))
    }

    if (resource === "announcements" && !record.scopeId) return true

    return !record.scopeId || scopeCodes?.has(String(record.scopeId))
  }

  const resolveSectionInputs = async (input = {}) => {
    const years = await academics.listYears()

    const grades = await academics.listGrades()

    const strands = await academics.listStrands()

    const requestedYear =
      getIdValue(input.academicYearId) ??
      years.find((year) => year.code === input.schoolYear)?.id ??
      years.find((year) => year.isCurrent)?.id

    const requestedGrade =
      getIdValue(input.gradeLevelId) ??
      grades.find(
        (grade) =>
          grade.name.toLowerCase() ===
            String(input.gradeLevel || "").toLowerCase() ||
          String(grade.number) ===
            String(input.gradeLevel || "").replace(/\D/g, ""),
      )?.id

    const requestedStrand =
      getIdValue(input.strandId) ??
      strands.find(
        (strand) =>
          strand.code.toLowerCase() ===
            String(input.strand || "").toLowerCase() ||
          strand.name.toLowerCase() ===
            String(input.strand || "").toLowerCase(),
      )?.id

    return {
      academicYearId: requestedYear,

      gradeLevelId: requestedGrade,

      strandId: requestedStrand,

      sectionCode: input.sectionCode || input.classSectionCode || input.code,
    }
  }

  const requireAdmin = (req, res) => {
    if (req.user?.role === "admin") return true

    res
      .status(403)
      .json({ ok: false, message: "Administrator access is required." })

    return false
  }

  const verifyAdminConfirmation = async (req, body = {}) => {
    const adminId = String(body.adminId || "").trim()

    const password = String(body.password || "")

    if (adminId !== String(req.user.id) || !password) return false

    const admin = await users.findById(adminId)

    return Boolean(
      admin &&
        admin.role === "admin" &&
        String(admin.status).toLowerCase() === "active" &&
        (await verifyPassword(password, admin.password)),
    )
  }

  const resolveTeacherId = async (value) => {
    if (!value) return null

    const [rows] = await pool.query(
      `SELECT u.user_id AS id FROM users u
       JOIN roles r ON r.role_id = u.role_id
       WHERE (u.user_id = ? OR LOWER(u.full_name) = LOWER(?))
         AND r.role_name = 'teacher' AND u.status = 'active'
       LIMIT 2`,

      [String(value), String(value)],
    )

    if (rows.length !== 1) {
      throw new Error(
        rows.length
          ? "The selected adviser name is ambiguous; select a verified teacher account."
          : "Choose an active teacher account as adviser.",
      )
    }

    return rows[0].id
  }

  router.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1")

      return res.json({ ok: true, database: "mysql", schema: "normalized_v1" })
    } catch (error) {
      return sendError(res, error, "Database health check failed.")
    }
  })

  router.post("/login", async (req, res) => {
    const { schoolId, password } = req.body || {}

    if (!schoolId || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "School ID and password are required." })
    }

    try {
      const user = await users.findForAuthentication(String(schoolId).trim())

      if (
        !user ||
        String(user.status).toLowerCase() !== "active" ||
        !(await verifyPassword(password, user.password))
      ) {
        return res.status(401).json({
          ok: false,

          message: "The school ID or password is incorrect.",
        })
      }

      const token = crypto.randomBytes(32).toString("base64url")

      for (const [existingToken, session] of sessions) {
        if (session.userId === user.id) sessions.delete(existingToken)
      }

      sessions.set(token, {
        userId: user.id,

        role: user.role,

        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      })

      return res.json({
        ok: true,

        token,

        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      return sendError(res, error, "Unable to sign in.")
    }
  })

  router.post("/logout", (req, res) => {
    sessions.delete(req.authToken)

    return res.json({ ok: true, message: "Signed out successfully." })
  })

  router.post("/account/password", async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {}

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        ok: false,

        message:
          "Current password, new password, and confirmation are required.",
      })
    }

    if (String(newPassword).length < 12) {
      return res.status(400).json({
        ok: false,

        message: "The new password must be at least 12 characters.",
      })
    }

    if (newPassword !== confirmPassword || newPassword === currentPassword) {
      return res.status(400).json({
        ok: false,

        message:
          newPassword === currentPassword
            ? "Choose a new password different from your current password."
            : "The new password and confirmation do not match.",
      })
    }

    try {
      const user = await users.findById(req.user.id)

      if (!user || !(await verifyPassword(currentPassword, user.password))) {
        return res
          .status(401)
          .json({ ok: false, message: "The current password is incorrect." })
      }

      await users.updatePassword(req.user.id, await hashPassword(newPassword))

      return res.json({ ok: true, message: "Password updated successfully." })
    } catch (error) {
      return sendError(res, error, "Unable to update your password.")
    }
  })

  router.get("/me", async (req, res) => {
    try {
      const user = await users.findById(req.user.id)

      if (!user || String(user.status).toLowerCase() !== "active") {
        return res
          .status(404)
          .json({ ok: false, message: "Account not found or inactive." })
      }

      const profile = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }

      if (user.role === "student") {
        const student = await students.find(user.id)

        Object.assign(profile, {
          gradeLevel: student?.gradeLevel || "",

          strand: student?.strand || "",

          section: student?.section || "",

          classSectionCode: student?.classSectionCode || "",

          academicYearId: student?.academicYearId || null,

          schoolYear: student?.schoolYear || "",
        })
      }

      return res.json({ ...profile, user: profile })
    } catch (error) {
      return sendError(res, error, "Unable to load your account.")
    }
  })

  router.get("/account/profile", async (req, res) => {
    try {
      const user = await users.findById(req.user.id)

      if (!user)
        return res
          .status(404)
          .json({ ok: false, message: "Account not found." })

      const profile = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }

      if (user.role === "student")
        Object.assign(profile, await students.find(user.id))

      return res.json(profile)
    } catch (error) {
      return sendError(res, error, "Unable to load your account profile.")
    }
  })

  router.patch("/account/profile", async (req, res) => {
    const name = String(req.body?.name || "").trim()

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase()

    if (!name || !validEmail(email)) {
      return res
        .status(400)
        .json({ ok: false, message: "A name and valid email are required." })
    }

    try {
      await users.updateProfile(req.user.id, { name, email })

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to update your account profile.")
    }
  })

  router.get("/users", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      return res.json(await users.list())
    } catch (error) {
      return sendError(res, error, "Unable to load user accounts.")
    }
  })

  router.delete("/admin/records/:kind/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const { kind, id } = req.params

    if (!["students", "teachers", "subjects", "classes"].includes(kind)) {
      return res
        .status(400)
        .json({ ok: false, message: "Unsupported record type." })
    }

    if (!req.body?.password) {
      return res
        .status(400)
        .json({ ok: false, message: "Administrator password is required." })
    }

    let connection

    try {
      const admin = await users.findById(req.user.id)

      if (
        !admin ||
        !(await verifyPassword(req.body.password, admin.password))
      ) {
        return res
          .status(401)
          .json({ ok: false, message: "Administrator password is incorrect." })
      }

      connection = await pool.getConnection()

      await connection.beginTransaction()

      if (kind === "subjects") {
        const [result] = await connection.query(
          "UPDATE subjects SET status = 'inactive' WHERE subject_code = ?",

          [String(id).toUpperCase()],
        )

        if (!result.affectedRows) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Subject not found." })
        }
      } else if (kind === "classes") {
        const [result] = await connection.query(
          "UPDATE subject_assignments SET status = 'inactive' WHERE subject_assignment_id = ?",

          [id],
        )

        if (!result.affectedRows) {
          const existingClass = await records.find("classes", id)

          if (!existingClass) {
            await connection.rollback()

            return res
              .status(404)
              .json({ ok: false, message: "Class assignment not found." })
          }

          await connection.query(
            `INSERT INTO lms_records (resource, record_id, scope_id, owner_id, payload)
             VALUES ('classes', ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,

            [
              id,

              existingClass.scopeId || "",

              existingClass.ownerId || req.user.id,

              JSON.stringify({ ...existingClass, status: "inactive" }),
            ],
          )

          await connection.commit()

          return res.json({ ok: true })
        }

        await connection.query(
          `UPDATE subject_enrollments SET enrollment_status = 'ended',
             ended_at = CURRENT_TIMESTAMP
           WHERE subject_assignment_id = ? AND enrollment_status = 'active'`,

          [id],
        )
      } else {
        const roleName = kind === "students" ? "student" : "teacher"

        const [accountRows] = await connection.query(
          `SELECT u.user_id AS id FROM users u
           JOIN roles r ON r.role_id = u.role_id
           WHERE u.user_id = ? AND r.role_name = ? FOR UPDATE`,

          [id, roleName],
        )

        if (!accountRows.length) {
          await connection.rollback()

          return res.status(404).json({
            ok: false,
            message: `${
              roleName === "student" ? "Student" : "Teacher"
            } not found.`,
          })
        }

        if (roleName === "teacher") {
          const [linkedRows] = await connection.query(
            `SELECT
              (SELECT COUNT(*) FROM teacher_assignments WHERE teacher_id = ? AND status = 'active') +
              (SELECT COUNT(*) FROM subject_assignments WHERE teacher_id = ? AND status = 'active') AS count`,

            [id, id],
          )

          if (Number(linkedRows[0].count) > 0) {
            await connection.rollback()

            return res.status(409).json({
              ok: false,

              message:
                "Reassign this teacher's class and subject sections before deactivating the account.",
            })
          }
        }

        await connection.query(
          "UPDATE users SET status = 'inactive' WHERE user_id = ?",
          [id],
        )

        if (roleName === "student") {
          const [enrollments] = await connection.query(
            `SELECT student_enrollment_id AS id, academic_year_id AS academicYearId,
                      class_section_id AS classSectionId, enrolled_at AS enrolledAt
               FROM student_enrollments
               WHERE student_id = ? AND enrollment_status = 'active'
               FOR UPDATE`,

            [id],
          )

          for (const enrollment of enrollments) {
            await connection.query(
              `INSERT INTO student_enrollment_history
                  (student_id, academic_year_id, class_section_id,
                   enrollment_status, enrolled_at, ended_at)
                 VALUES (?, ?, ?, 'withdrawn', ?, CURRENT_TIMESTAMP)`,

              [
                id,
                enrollment.academicYearId,
                enrollment.classSectionId,
                enrollment.enrolledAt,
              ],
            )
          }

          await connection.query(
            `UPDATE student_enrollments SET enrollment_status = 'withdrawn',
                 ended_at = CURRENT_TIMESTAMP
               WHERE student_id = ? AND enrollment_status = 'active'`,

            [id],
          )

          await connection.query(
            `UPDATE subject_enrollments SET enrollment_status = 'withdrawn',
                 ended_at = CURRENT_TIMESTAMP
               WHERE student_id = ? AND enrollment_status = 'active'`,

            [id],
          )
        } else {
          await connection.query(
            `UPDATE teacher_assignments SET status = 'ended',
               ended_at = CURRENT_TIMESTAMP
             WHERE teacher_id = ? AND status = 'active'`,

            [id],
          )
        }
      }

      await connection.commit()

      return res.json({ ok: true })
    } catch (error) {
      if (connection) await connection.rollback()

      return sendError(res, error, "Unable to deactivate this record.")
    } finally {
      if (connection) connection.release()
    }
  })

  router.get("/academic-years", async (_req, res) => {
    try {
      return res.json(await academics.listYears())
    } catch (error) {
      return sendError(res, error, "Unable to load academic years.")
    }
  })

  router.get("/grade-levels", async (_req, res) => {
    try {
      return res.json(await academics.listGrades())
    } catch (error) {
      return sendError(res, error, "Unable to load grade levels.")
    }
  })

  router.get("/strands", async (_req, res) => {
    try {
      return res.json(await academics.listStrands())
    } catch (error) {
      return sendError(res, error, "Unable to load strands.")
    }
  })

  router.get("/class-sections/available", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      const currentYear = await getCurrentYearId()

      const academicYearId = getIdValue(req.query.academicYearId) || currentYear

      const result = await sections.list({
        academicYearId,

        gradeLevelId: getIdValue(req.query.gradeLevelId),

        strandId: getIdValue(req.query.strandId),

        activeOnly: true,
      })

      if (req.query.currentSectionCode) {
        const currentSection = await sections.find(
          String(req.query.currentSectionCode),
        )

        if (
          currentSection &&
          String(currentSection.academicYearId) === String(academicYearId) &&
          String(currentSection.gradeLevelId) ===
            String(req.query.gradeLevelId || currentSection.gradeLevelId) &&
          String(currentSection.strandId) ===
            String(req.query.strandId || currentSection.strandId) &&
          !result.some((item) => item.code === currentSection.code)
        ) {
          result.push(currentSection)
        }
      }

      return res.json({
        period:
          (await academics.listYears()).find(
            (year) => String(year.id) === String(academicYearId),
          ) || null,

        sections: result.map((section) => ({
          ...section,

          id: section.code,

          schoolYear: section.schoolYear,
        })),
      })
    } catch (error) {
      return sendError(res, error, "Unable to load available class sections.")
    }
  })

  router.get("/class-sections", async (_req, res) => {
    try {
      return res.json(await sections.list({ activeOnly: false }))
    } catch (error) {
      return sendError(res, error, "Unable to load class sections.")
    }
  })

  router.post("/class-sections", async (req, res) => {
    const { code, name, adviser, adviserId, status } = req.body || {}

    if (!String(code || "").trim() || !String(name || "").trim()) {
      return res.status(400).json({
        ok: false,

        message: "Class section code and name are required.",
      })
    }

    try {
      const placement = await resolveSectionInputs(req.body)

      const letter = String(
        req.body.sectionLetter ||
          req.body.section ||
          String(name).trim().slice(-1),
      )

        .trim()

        .toUpperCase()

      if (
        !placement.academicYearId ||
        !placement.gradeLevelId ||
        !placement.strandId ||
        !/^[AB]$/.test(letter)
      ) {
        return res.status(400).json({
          ok: false,

          message:
            "Select a valid academic year, grade, strand, and section letter.",
        })
      }

      const resolvedAdviserId = await resolveTeacherId(adviserId || adviser)

      const id = await sections.create({
        ...placement,

        code,

        name,

        sectionLetter: letter,

        status,

        adviserId: resolvedAdviserId,
      })

      const section = await sections.find(String(code).toUpperCase())

      return res
        .status(201)
        .json({ ok: true, classSection: { ...section, id } })
    } catch (error) {
      return sendError(res, error, "Unable to create the class section.")
    }
  })

  router.patch("/class-sections/:code", async (req, res) => {
    const { name, adviser, adviserId, status } = req.body || {}

    try {
      const existing = await sections.find(req.params.code)

      if (!existing)
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })

      const placement = await resolveSectionInputs({
        ...req.body,

        academicYearId: req.body.academicYearId || existing.academicYearId,

        schoolYear: req.body.schoolYear || existing.schoolYear,

        gradeLevel: req.body.gradeLevel || existing.gradeLevel,

        strand: req.body.strand || existing.strand,
      })

      const [dependencies] = await pool.query(
        `SELECT
          (SELECT COUNT(*) FROM student_enrollments WHERE class_section_id = ?) +
          (SELECT COUNT(*) FROM student_enrollment_history WHERE class_section_id = ?) +
          (SELECT COUNT(*) FROM teacher_assignments WHERE class_section_id = ?) +
          (SELECT COUNT(*) FROM subject_assignments WHERE class_section_id = ?) AS count`,

        [existing.id, existing.id, existing.id, existing.id],
      )

      const placementChanged =
        Number(placement.academicYearId) !== Number(existing.academicYearId) ||
        Number(placement.gradeLevelId) !== Number(existing.gradeLevelId) ||
        Number(placement.strandId) !== Number(existing.strandId)

      if (placementChanged && Number(dependencies[0].count) > 0) {
        return res.status(409).json({
          ok: false,

          message:
            "A section with enrollment or assignment history cannot change its academic identity.",
        })
      }

      if (
        !placement.academicYearId ||
        !placement.gradeLevelId ||
        !placement.strandId
      ) {
        return res.status(400).json({
          ok: false,
          message: "Academic year, grade, and strand are required.",
        })
      }

      const letter = String(
        req.body.sectionLetter || req.body.section || existing.section,
      )

        .trim()

        .toUpperCase()

      if (!/^[AB]$/.test(letter)) {
        return res
          .status(400)
          .json({ ok: false, message: "Section letter must be A or B." })
      }

      const resolvedAdviserId = await resolveTeacherId(adviserId || adviser)

      await sections.update(req.params.code, {
        ...placement,

        name: name || existing.name,

        sectionLetter: letter,

        status: status || existing.status,

        adviserId: resolvedAdviserId,
      })

      return res.json({
        ok: true,
        classSection: await sections.find(req.params.code),
      })
    } catch (error) {
      return sendError(res, error, "Unable to update the class section.")
    }
  })

  router.delete("/class-sections/:code", async (req, res) => {
    try {
      const changed = await sections.setStatus(req.params.code, "inactive")

      if (!changed)
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to deactivate the class section.")
    }
  })

  router.get("/students", async (_req, res) => {
    try {
      return res.json(await students.list())
    } catch (error) {
      return sendError(res, error, "Unable to load students.")
    }
  })

  router.get("/students/:id/class-section", async (req, res) => {
    try {
      const student = await students.find(req.params.id)

      if (!student)
        return res
          .status(404)
          .json({ ok: false, message: "Student not found." })

      return res.json({
        gradeLevel: student.gradeLevel,

        strand: student.strand,

        section: student.section,

        sectionName: student.classSectionName,

        classSectionCode: student.classSectionCode,

        schoolYear: student.schoolYear,
      })
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to load the student's class section.",
      )
    }
  })

  router.get("/students/:id/subjects", async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT sa.subject_assignment_id AS id, s.subject_code AS code,
                s.subject_name AS name, teacher.full_name AS teacher
         FROM subject_enrollments se
         JOIN subject_assignments sa
           ON sa.subject_assignment_id = se.subject_assignment_id
         JOIN subjects s ON s.subject_id = sa.subject_id
         JOIN users teacher ON teacher.user_id = sa.teacher_id
         WHERE se.student_id = ? AND se.enrollment_status = 'active'`,

        [req.params.id],
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load the student's subjects.")
    }
  })

  router.post("/students", async (req, res) => {
    const { name, email, password, status } = req.body || {}

    if (
      !String(name || "").trim() ||
      !validEmail(email) ||
      String(password || "").length < 8
    ) {
      return res.status(400).json({
        ok: false,

        message:
          "Name, valid email, and a password of at least 8 characters are required.",
      })
    }

    try {
      const placement = await resolveSectionInputs(req.body)

      if (
        !placement.academicYearId ||
        !placement.gradeLevelId ||
        !placement.strandId ||
        !placement.sectionCode
      ) {
        return res.status(400).json({
          ok: false,

          message: "Academic year, grade, strand, and section are required.",
        })
      }

      const student = await students.create({
        ...placement,

        name,

        email,

        passwordHash: await hashPassword(password),

        status,
      })

      return res.status(201).json({ ok: true, student })
    } catch (error) {
      return sendError(res, error, "Unable to create the student account.")
    }
  })

  router.patch("/students/:id", async (req, res) => {
    const { name, email, status } = req.body || {}

    if (!String(name || "").trim() || !validEmail(email)) {
      return res
        .status(400)
        .json({ ok: false, message: "Name and valid email are required." })
    }

    try {
      const placement = await resolveSectionInputs(req.body)

      if (
        !placement.academicYearId ||
        !placement.gradeLevelId ||
        !placement.strandId ||
        !placement.sectionCode
      ) {
        return res.status(400).json({
          ok: false,

          message: "Academic year, grade, strand, and section are required.",
        })
      }

      return res.json({
        ok: true,

        student: await students.update(req.params.id, {
          ...placement,
          name,
          email,
          status,
        }),
      })
    } catch (error) {
      return sendError(res, error, "Unable to update the student account.")
    }
  })

  router.get("/teachers", async (_req, res) => {
    try {
      return res.json(await teachers.list())
    } catch (error) {
      return sendError(res, error, "Unable to load teachers.")
    }
  })

  router.post("/teachers", async (req, res) => {
    const { name, email, password, status } = req.body || {}

    if (
      !String(name || "").trim() ||
      !validEmail(email) ||
      String(password || "").length < 8
    ) {
      return res.status(400).json({
        ok: false,

        message:
          "Name, valid email, and a password of at least 8 characters are required.",
      })
    }

    try {
      const teacher = await teachers.create({
        name,

        email,

        passwordHash: await hashPassword(password),

        status,
      })

      return res.status(201).json({ ok: true, teacher })
    } catch (error) {
      return sendError(res, error, "Unable to create the teacher account.")
    }
  })

  router.patch("/teachers/:id", async (req, res) => {
    const { name, email, status } = req.body || {}

    if (!String(name || "").trim() || !validEmail(email)) {
      return res
        .status(400)
        .json({ ok: false, message: "Name and valid email are required." })
    }

    try {
      const changed = await teachers.update(req.params.id, {
        name,
        email,
        status,
      })

      if (!changed)
        return res
          .status(404)
          .json({ ok: false, message: "Teacher not found." })

      const teacher = (await teachers.list()).find(
        (entry) => entry.id === req.params.id,
      )

      return res.json({ ok: true, teacher })
    } catch (error) {
      return sendError(res, error, "Unable to update the teacher account.")
    }
  })

  router.get("/subjects", async (_req, res) => {
    try {
      return res.json(await subjects.list())
    } catch (error) {
      return sendError(res, error, "Unable to load subjects.")
    }
  })

  router.post("/subjects", async (req, res) => {
    const { code, name, description, units, gradeLevel, strand } =
      req.body || {}

    const parsedUnits = Number(units || 0)

    if (
      !String(code || "").trim() ||
      !String(name || "").trim() ||
      !Number.isFinite(parsedUnits) ||
      parsedUnits < 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "A subject code, name, and valid units are required.",
      })
    }

    try {
      const grades = await academics.listGrades()

      const strandsList = await academics.listStrands()

      const grade = grades.find(
        (item) =>
          item.name.toLowerCase() === String(gradeLevel || "").toLowerCase(),
      )

      const strandRecord = strandsList.find(
        (item) =>
          item.code.toLowerCase() === String(strand || "").toLowerCase(),
      )

      if (gradeLevel && !grade)
        return res
          .status(400)
          .json({ ok: false, message: "Choose a valid grade level." })

      if (strand && !strandRecord)
        return res
          .status(400)
          .json({ ok: false, message: "Choose a valid strand." })

      await subjects.create({
        code,

        name,

        description,

        units: parsedUnits,

        gradeLevelId: grade?.id,

        strandId: strandRecord?.id,
      })

      const subject = (await subjects.list()).find(
        (item) => item.code === String(code).trim().toUpperCase(),
      )

      return res.status(201).json({
        ok: true,
        subject: { ...subject, semester: req.body.semester || "" },
      })
    } catch (error) {
      return sendError(res, error, "Unable to create the subject.")
    }
  })

  router.patch("/subjects/:code", async (req, res) => {
    const { name, description, units, gradeLevel, strand, status } =
      req.body || {}

    const parsedUnits = Number(units || 0)

    if (
      !String(name || "").trim() ||
      !Number.isFinite(parsedUnits) ||
      parsedUnits < 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "A subject name and valid units are required.",
      })
    }

    try {
      const grades = await academics.listGrades()

      const strandsList = await academics.listStrands()

      const grade = grades.find(
        (item) =>
          item.name.toLowerCase() === String(gradeLevel || "").toLowerCase(),
      )

      const strandRecord = strandsList.find(
        (item) =>
          item.code.toLowerCase() === String(strand || "").toLowerCase(),
      )

      if (gradeLevel && !grade)
        return res
          .status(400)
          .json({ ok: false, message: "Choose a valid grade level." })

      if (strand && !strandRecord)
        return res
          .status(400)
          .json({ ok: false, message: "Choose a valid strand." })

      const changed = await subjects.update(req.params.code, {
        name,

        description,

        units: parsedUnits,

        gradeLevelId: grade?.id,

        strandId: strandRecord?.id,

        status,
      })

      if (!changed)
        return res
          .status(404)
          .json({ ok: false, message: "Subject not found." })

      const subject = (await subjects.list()).find(
        (item) => item.code === req.params.code,
      )

      return res.json({
        ok: true,
        subject: { ...subject, semester: req.body.semester || "" },
      })
    } catch (error) {
      return sendError(res, error, "Unable to update the subject.")
    }
  })

  router.get("/classes", async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT sa.subject_assignment_id AS id,
                CONCAT(cs.section_code, '-', s.subject_code) AS code,
                s.subject_name AS subject, teacher.full_name AS teacher,
                cs.section_name AS classSectionName, cs.section_code AS classSectionCode,
                gl.grade_name AS gradeLevel, strand.strand_code AS strand,
                ay.year_code AS schoolYear, s.subject_code AS subjectCode,
                cs.section_name AS room, '' AS schedule, '#1F6FEB' AS color
         FROM subject_assignments sa
         JOIN subjects s ON s.subject_id = sa.subject_id
         JOIN class_sections cs ON cs.class_section_id = sa.class_section_id
         JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         JOIN strands strand ON strand.strand_id = cs.strand_id
         JOIN academic_years ay ON ay.academic_year_id = sa.academic_year_id
         JOIN users teacher ON teacher.user_id = sa.teacher_id
         WHERE sa.status = 'active'`,
      )

      const legacyClasses = await records.list("classes")

      const knownCodes = new Set(rows.map((item) => String(item.code)))

      return res.json([
        ...rows,

        ...legacyClasses.filter((item) => !knownCodes.has(String(item.code))),
      ])
    } catch (error) {
      return sendError(res, error, "Unable to load classes.")
    }
  })

  router.post("/classes", async (req, res) => {
    const { code, subject } = req.body || {}

    if (!String(code || "").trim() || !String(subject || "").trim()) {
      return res.status(400).json({
        ok: false,

        message: "Class section name and code are required.",
      })
    }

    try {
      const record = {
        ...req.body,

        code: String(code).trim().toUpperCase(),

        subject: String(subject).trim(),
      }

      const saved = await records.save(
        "classes",

        record.code,

        req.body.classSectionCode || "",

        req.user.id,

        record,
      )

      return res.status(201).json({ ok: true, class: saved })
    } catch (error) {
      return sendError(res, error, "Unable to create the class.")
    }
  })

  router.patch("/classes/:code", async (req, res) => {
    const code = String(req.params.code).trim().toUpperCase()

    if (!String(req.body?.subject || "").trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "Class section name is required." })
    }

    try {
      const existing = await records.find("classes", code)

      if (!existing)
        return res.status(404).json({ ok: false, message: "Class not found." })

      const saved = await records.save(
        "classes",

        code,

        req.body.classSectionCode ?? existing.scopeId,

        req.user.id,

        {
          ...existing,
          ...req.body,
          code,
          subject: String(req.body.subject).trim(),
        },
      )

      return res.json({ ok: true, class: saved })
    } catch (error) {
      return sendError(res, error, "Unable to update the class.")
    }
  })

  router.get("/class-sections/:code/students", async (req, res) => {
    try {
      const section = await sections.find(req.params.code)

      if (!section)
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })

      const [rows] = await pool.query(
        `SELECT u.user_id AS studentId, u.full_name AS studentName,
                u.email, se.enrollment_status AS status
         FROM student_enrollments se
         JOIN users u ON u.user_id = se.student_id
         JOIN roles r ON r.role_id = u.role_id AND r.role_name = 'student'
         WHERE se.class_section_id = ? AND se.academic_year_id = ?
           AND se.enrollment_status = 'active'
         ORDER BY u.full_name`,

        [section.id, section.academicYearId],
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load section students.")
    }
  })

  router.get("/enrollments", async (req, res) => {
    try {
      const studentId = req.query.studentId || ""

      const [rows] = await pool.query(
        `SELECT se.subject_enrollment_id AS id, se.student_id AS studentId,
                student.full_name AS studentName,
                sa.subject_assignment_id AS subjectSectionId,
                s.subject_code AS subjectCode, s.subject_name AS subjectName,
                teacher.full_name AS teacher, ay.year_code AS schoolYear,
                sa.semester, se.enrollment_status AS status,
                se.enrolled_at AS enrolledAt, se.ended_at AS endedAt
         FROM subject_enrollments se
         JOIN subject_assignments sa
           ON sa.subject_assignment_id = se.subject_assignment_id
         JOIN subjects s ON s.subject_id = sa.subject_id
         JOIN users student ON student.user_id = se.student_id
         JOIN users teacher ON teacher.user_id = sa.teacher_id
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         WHERE (? = '' OR se.student_id = ?)`,

        [studentId || "", studentId || ""],
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load enrollments.")
    }
  })

  router.get("/student-enrollments", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      const studentId = req.query.studentId || ""

      const [rows] = await pool.query(
        `SELECT se.student_enrollment_id AS id, se.student_id AS studentId,
                u.full_name AS studentName, se.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear, se.class_section_id AS classSectionId,
                cs.section_code AS classSectionCode, cs.section_name AS classSectionName,
                se.enrollment_status AS status, se.enrolled_at AS enrolledAt,
                se.ended_at AS endedAt, 'current' AS recordType
         FROM student_enrollments se
         JOIN users u ON u.user_id = se.student_id
         JOIN academic_years ay ON ay.academic_year_id = se.academic_year_id
         JOIN class_sections cs ON cs.class_section_id = se.class_section_id
         WHERE (? = '' OR se.student_id = ?)
         UNION ALL
         SELECT eh.enrollment_history_id AS id, eh.student_id AS studentId,
                u.full_name AS studentName, eh.academic_year_id AS academicYearId,
                ay.year_code AS schoolYear, eh.class_section_id AS classSectionId,
                cs.section_code AS classSectionCode, cs.section_name AS classSectionName,
                eh.enrollment_status AS status, eh.enrolled_at AS enrolledAt,
                eh.ended_at AS endedAt, 'history' AS recordType
         FROM student_enrollment_history eh
         JOIN users u ON u.user_id = eh.student_id
         JOIN academic_years ay ON ay.academic_year_id = eh.academic_year_id
         JOIN class_sections cs ON cs.class_section_id = eh.class_section_id
         WHERE (? = '' OR eh.student_id = ?)
         ORDER BY schoolYear DESC, enrolledAt DESC`,

        [studentId, studentId, studentId, studentId],
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load student enrollment history.")
    }
  })

  router.get("/teacher-assignments", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      const [rows] = await pool.query(
        `SELECT ta.teacher_assignment_id AS id, ta.teacher_id AS teacherId,
                teacher.full_name AS teacherName, ta.class_section_id AS classSectionId,
                cs.section_code AS classSectionCode, cs.section_name AS classSectionName,
                ta.academic_year_id AS academicYearId, ay.year_code AS schoolYear,
                ta.assignment_type AS type, ta.status, ta.assigned_at AS assignedAt,
                ta.ended_at AS endedAt
         FROM teacher_assignments ta
         JOIN users teacher ON teacher.user_id = ta.teacher_id
         JOIN class_sections cs ON cs.class_section_id = ta.class_section_id
         JOIN academic_years ay ON ay.academic_year_id = ta.academic_year_id
         WHERE (? = '' OR ta.class_section_id = ?)
         ORDER BY ay.year_code DESC, cs.section_name, teacher.full_name`,

        [req.query.classSectionId || "", req.query.classSectionId || ""],
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load teacher assignments.")
    }
  })

  router.post("/teacher-assignments", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const { teacherId, sectionCode, academicYearId, type } = req.body || {}

    if (!teacherId || !sectionCode || !academicYearId) {
      return res.status(400).json({
        ok: false,

        message: "Teacher, section, and academic year are required.",
      })
    }

    if (type && !["adviser", "teacher"].includes(type)) {
      return res
        .status(400)
        .json({ ok: false, message: "Assignment type is invalid." })
    }

    try {
      await assignments.assignTeacher({
        teacherId,

        sectionCode,

        academicYearId,

        type: type || "teacher",
      })

      return res.status(201).json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to assign the teacher.")
    }
  })

  router.get("/subject-sections", async (_req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT sa.subject_assignment_id AS id, sa.subject_id AS subjectId,
                s.subject_code AS subjectCode, s.subject_name AS subjectName,
                cs.class_section_id AS classSectionId, cs.section_code AS classSectionCode,
                cs.section_name AS classSectionName, sa.teacher_id AS teacherId,
                teacher.full_name AS teacher, ay.year_code AS schoolYear,
                sa.semester, sa.status,
                (SELECT JSON_ARRAYAGG(se.student_id)
                 FROM subject_enrollments se
                 WHERE se.subject_assignment_id = sa.subject_assignment_id
                   AND se.enrollment_status = 'active') AS enrolledStudents
         FROM subject_assignments sa
         JOIN subjects s ON s.subject_id = sa.subject_id
         JOIN class_sections cs ON cs.class_section_id = sa.class_section_id
         JOIN users teacher ON teacher.user_id = sa.teacher_id
         JOIN academic_years ay ON ay.academic_year_id = sa.academic_year_id
         ORDER BY ay.year_code DESC, s.subject_code`,
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, "Unable to load subject assignments.")
    }
  })

  router.post("/section-subjects", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const {
      classSectionCode,

      schoolYear,

      semester,

      assignments: selectedAssignments,

      removeSubjectCodes = [],
    } = req.body || {}

    if (
      !classSectionCode ||
      !schoolYear ||
      !semester ||
      !Array.isArray(selectedAssignments) ||
      !Array.isArray(removeSubjectCodes)
    ) {
      return res.status(400).json({
        ok: false,

        message:
          "Section, school year, semester, and assignment details are required.",
      })
    }

    try {
      await assignments.saveSubjectAssignments({
        sectionCode: classSectionCode,

        schoolYear,

        semester,

        selectedAssignments,

        removeSubjectCodes,
      })

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to save section subjects.")
    }
  })

  router.post("/enrollments", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const { subjectSectionId, studentId, adminId, password } = req.body || {}

    if (!subjectSectionId || !studentId) {
      return res.status(400).json({
        ok: false,
        message: "Subject section and student are required.",
      })
    }

    try {
      if (!(await verifyAdminConfirmation(req, { adminId, password }))) {
        return res
          .status(401)
          .json({ ok: false, message: "Administrator confirmation failed." })
      }

      const [assignmentsRows] = await pool.query(
        `SELECT subject_assignment_id AS id, class_section_id AS classSectionId,
                academic_year_id AS academicYearId
         FROM subject_assignments
         WHERE subject_assignment_id = ? AND status = 'active' LIMIT 1`,

        [subjectSectionId],
      )

      if (!assignmentsRows.length) {
        return res
          .status(404)
          .json({ ok: false, message: "Subject section not found." })
      }

      const assignment = assignmentsRows[0]

      const [studentRows] = await pool.query(
        `SELECT se.student_id FROM student_enrollments se
         JOIN users u ON u.user_id = se.student_id
         JOIN roles r ON r.role_id = u.role_id AND r.role_name = 'student'
         WHERE se.student_id = ? AND se.class_section_id = ?
           AND se.academic_year_id = ? AND se.enrollment_status = 'active'
           AND u.status = 'active' LIMIT 1`,

        [studentId, assignment.classSectionId, assignment.academicYearId],
      )

      if (!studentRows.length) {
        return res.status(400).json({
          ok: false,

          message:
            "The student is not actively enrolled in this class section and academic year.",
        })
      }

      await pool.query(
        `INSERT INTO subject_enrollments
          (student_id, subject_assignment_id, academic_year_id, enrollment_status)
         VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE enrollment_status = 'active', ended_at = NULL`,

        [studentId, subjectSectionId, assignment.academicYearId],
      )

      return res.status(201).json({ ok: true })
    } catch (error) {
      return sendError(
        res,
        error,
        "Unable to enroll the student in this subject section.",
      )
    }
  })

  router.delete("/enrollments/:sectionId/:studentId", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      if (!(await verifyAdminConfirmation(req, req.body || {}))) {
        return res
          .status(401)
          .json({ ok: false, message: "Administrator confirmation failed." })
      }

      const [result] = await pool.query(
        `UPDATE subject_enrollments SET enrollment_status = 'ended',
           ended_at = CURRENT_TIMESTAMP
         WHERE subject_assignment_id = ? AND student_id = ?
           AND enrollment_status = 'active'`,

        [req.params.sectionId, req.params.studentId],
      )

      if (!result.affectedRows) {
        return res
          .status(404)
          .json({ ok: false, message: "Active subject enrollment not found." })
      }

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to remove the subject enrollment.")
    }
  })

  router.get("/activity-logs", async (req, res) => {
    if (!requireAdmin(req, res)) return

    try {
      const rows = await logs.list()

      return res.json(
        rows.map((row) => ({
          ...row,

          created_at: row.createdAt,

          userId: row.userId,
        })),
      )
    } catch (error) {
      return sendError(res, error, "Unable to load activity logs.")
    }
  })

  router.post("/subject-sections", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const { subjectCode, classSectionCode, schoolYear, semester, teacher } =
      req.body || {}

    if (
      !subjectCode ||
      !classSectionCode ||
      !schoolYear ||
      !semester ||
      !teacher
    ) {
      return res.status(400).json({
        ok: false,

        message:
          "Subject, section, academic year, semester, and teacher are required.",
      })
    }

    try {
      await assignments.saveSubjectAssignments({
        sectionCode: classSectionCode,

        schoolYear,

        semester,

        selectedAssignments: [{ subjectCode, teacher }],
      })

      const [rows] = await pool.query(
        `SELECT subject_assignment_id AS id, subject_id AS subjectId,
                teacher_id AS teacherId, class_section_id AS classSectionId,
                academic_year_id AS academicYearId, semester, status
         FROM subject_assignments
         WHERE subject_id = (SELECT subject_id FROM subjects WHERE subject_code = ?)
           AND class_section_id = (SELECT class_section_id FROM class_sections WHERE section_code = ?)
           AND academic_year_id = (SELECT academic_year_id FROM academic_years WHERE year_code = ?)
           AND semester = ? LIMIT 1`,

        [subjectCode, classSectionCode, schoolYear, semester],
      )

      return res.status(201).json({ ok: true, subjectSection: rows[0] })
    } catch (error) {
      return sendError(res, error, "Unable to create the subject assignment.")
    }
  })

  router.patch("/subject-sections/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const { teacher, semester, status } = req.body || {}

    try {
      const [currentRows] = await pool.query(
        `SELECT subject_assignment_id AS id, teacher_id AS teacherId,
                semester, status FROM subject_assignments
         WHERE subject_assignment_id = ? LIMIT 1`,

        [req.params.id],
      )

      const current = currentRows[0]

      if (!current)
        return res
          .status(404)
          .json({ ok: false, message: "Subject assignment not found." })

      let teacherId = current.teacherId

      if (teacher) {
        const [teacherRows] = await pool.query(
          `SELECT u.user_id AS id FROM users u
           JOIN roles r ON r.role_id = u.role_id
           WHERE (u.user_id = ? OR LOWER(u.full_name) = LOWER(?))
             AND r.role_name = 'teacher' AND u.status = 'active'
           LIMIT 2`,

          [String(teacher), String(teacher)],
        )

        if (teacherRows.length !== 1) {
          return res.status(400).json({
            ok: false,

            message: teacherRows.length
              ? "The selected teacher name is ambiguous; select a verified teacher account."
              : "Choose an active teacher account.",
          })
        }

        teacherId = teacherRows[0].id
      }

      await pool.query(
        `UPDATE subject_assignments SET teacher_id = ?, semester = ?, status = ?
         WHERE subject_assignment_id = ?`,

        [
          teacherId,
          semester || current.semester,
          status || current.status,
          req.params.id,
        ],
      )

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, "Unable to update the subject assignment.")
    }
  })

  router.delete("/subject-sections/:id", async (req, res) => {
    if (!requireAdmin(req, res)) return

    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [rows] = await connection.query(
        "SELECT subject_assignment_id FROM subject_assignments WHERE subject_assignment_id = ? FOR UPDATE",

        [req.params.id],
      )

      if (!rows.length) {
        await connection.rollback()

        return res
          .status(404)
          .json({ ok: false, message: "Subject assignment not found." })
      }

      await connection.query(
        "UPDATE subject_assignments SET status = 'inactive' WHERE subject_assignment_id = ?",

        [req.params.id],
      )

      await connection.query(
        `UPDATE subject_enrollments SET enrollment_status = 'ended',
           ended_at = CURRENT_TIMESTAMP
         WHERE subject_assignment_id = ? AND enrollment_status = 'active'`,

        [req.params.id],
      )

      await connection.commit()

      return res.json({ ok: true })
    } catch (error) {
      await connection.rollback()

      return sendError(
        res,
        error,
        "Unable to deactivate the subject assignment.",
      )
    } finally {
      connection.release()
    }
  })

  router.get("/dashboard/stats", async (req, res) => {
    try {
      const [studentRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'student'",
      )

      const [teacherRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'teacher'",
      )

      const [subjectRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM subjects",
      )

      const [sectionRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM class_sections",
      )

      const [enrollmentRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM student_enrollments WHERE enrollment_status = 'active'",
      )

      const [gradeRows] = await pool.query(
        `SELECT COALESCE(gl.grade_name, 'Unassigned') AS gradeLevel, COUNT(*) AS count
         FROM users u JOIN roles r ON r.role_id = u.role_id AND r.role_name = 'student'
         LEFT JOIN student_enrollments se
           ON se.student_id = u.user_id AND se.enrollment_status = 'active'
         LEFT JOIN class_sections cs ON cs.class_section_id = se.class_section_id
         LEFT JOIN grade_levels gl ON gl.grade_level_id = cs.grade_level_id
         GROUP BY gl.grade_name`,
      )

      return res.json({
        userId: req.user.id,

        totals: {
          students: Number(studentRows[0].count),

          teachers: Number(teacherRows[0].count),

          subjects: Number(subjectRows[0].count),

          sections: Number(sectionRows[0].count),

          enrollments: Number(enrollmentRows[0].count),
        },

        gradeDistribution: gradeRows.map((row) => ({
          gradeLevel: row.gradeLevel,

          count: Number(row.count),
        })),

        classes: [],
      })
    } catch (error) {
      return sendError(res, error, "Unable to load dashboard statistics.")
    }
  })

  router.get("/records/:resource", async (req, res) => {
    const { resource } = req.params

    if (!recordResources.has(resource)) {
      return res
        .status(404)
        .json({ ok: false, message: "Unknown record collection." })
    }

    try {
      let rows = await records.list(resource, {
        scopeId: req.query.scopeId,

        ownerId:
          req.user.role === "admin"
            ? req.query.ownerId
            : ["notifications", "profile-photos", "submissions"].includes(
                  resource,
                )
              ? req.user.id
              : undefined,
      })

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      rows = rows.filter((record) =>
        canAccessRecord(record, resource, req.user, sectionCodes),
      )

      return res.json(rows)
    } catch (error) {
      return sendError(res, error, `Unable to load ${resource}.`)
    }
  })

  router.post("/records/:resource", async (req, res) => {
    const { resource } = req.params

    const {
      id = crypto.randomUUID(),
      scopeId = "",
      ownerId = "",
      payload,
    } = req.body || {}

    if (!recordResources.has(resource)) {
      return res
        .status(404)
        .json({ ok: false, message: "Unknown record collection." })
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res
        .status(400)
        .json({ ok: false, message: "A record payload is required." })
    }

    try {
      const owner = ["notifications", "profile-photos", "submissions"].includes(
        resource,
      )
        ? req.user.id
        : ownerId

      const existing = await records.find(resource, id)

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      const scopedWrite = !scopeId
        ? !sectionScopedResources.has(resource)
        : sectionCodes?.has(String(scopeId))

      if (
        req.user.role !== "admin" &&
        sectionScopedResources.has(resource) &&
        !scopeId
      ) {
        return res
          .status(400)
          .json({ ok: false, message: "A class section is required." })
      }

      const ownerRequired = [
        "notifications",
        "profile-photos",
        "submissions",
      ].includes(resource)

      if (req.user.role !== "admin" && !scopedWrite) {
        return res.status(403).json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
      }

      if (
        req.user.role !== "admin" &&
        existing &&
        existing.ownerId !== req.user.id &&
        (ownerRequired ||
          ![
            "assignments",
            "assessments",
            "assessment-questions",
            "class-content",
            "lessons",
            "materials",
            "announcements",
            "scores",
            "grades",
          ].includes(resource))
      ) {
        return res.status(403).json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
      }

      const saved = await records.save(resource, id, scopeId, owner, payload)

      return res.status(201).json({ ok: true, record: saved })
    } catch (error) {
      return sendError(res, error, `Unable to save ${resource}.`)
    }
  })

  router.patch("/records/:resource/:id", async (req, res) => {
    const { resource, id } = req.params

    if (!recordResources.has(resource)) {
      return res
        .status(404)
        .json({ ok: false, message: "Unknown record collection." })
    }

    if (!req.body?.payload || typeof req.body.payload !== "object") {
      return res
        .status(400)
        .json({ ok: false, message: "A record payload is required." })
    }

    try {
      const existing = await records.find(resource, id)

      if (!existing)
        return res.status(404).json({ ok: false, message: "Record not found." })

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      const scopeId = req.body.scopeId ?? existing.scopeId

      const scopedWrite = !scopeId
        ? !sectionScopedResources.has(resource)
        : sectionCodes?.has(String(scopeId))

      if (
        req.user.role !== "admin" &&
        sectionScopedResources.has(resource) &&
        !scopeId
      ) {
        return res
          .status(400)
          .json({ ok: false, message: "A class section is required." })
      }

      if (
        req.user.role !== "admin" &&
        (["notifications", "profile-photos", "submissions"].includes(resource)
          ? existing.ownerId !== req.user.id
          : !scopedWrite && existing.ownerId !== req.user.id)
      ) {
        return res.status(403).json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
      }

      const saved = await records.save(
        resource,

        id,

        scopeId,

        ["notifications", "profile-photos", "submissions"].includes(resource)
          ? existing.ownerId
          : (req.body.ownerId ?? existing.ownerId),

        req.body.payload,
      )

      return res.json({ ok: true, record: saved })
    } catch (error) {
      return sendError(res, error, `Unable to update ${resource}.`)
    }
  })

  router.delete("/records/:resource/:id", async (req, res) => {
    const { resource, id } = req.params

    if (!recordResources.has(resource)) {
      return res
        .status(404)
        .json({ ok: false, message: "Unknown record collection." })
    }

    try {
      const existing = await records.find(resource, id)

      if (!existing)
        return res.status(404).json({ ok: false, message: "Record not found." })

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      const scopedWrite = !existing.scopeId
        ? !sectionScopedResources.has(resource)
        : sectionCodes?.has(String(existing.scopeId))

      if (
        req.user.role !== "admin" &&
        (["notifications", "profile-photos", "submissions"].includes(resource)
          ? existing.ownerId !== req.user.id
          : !scopedWrite && existing.ownerId !== req.user.id)
      ) {
        return res.status(403).json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
      }

      await records.remove(resource, id)

      return res.json({ ok: true })
    } catch (error) {
      return sendError(res, error, `Unable to delete ${resource}.`)
    }
  })

  router.get("/assessments/:id/questions", async (req, res) => {
    try {
      const assessment = await records.find("assessments", req.params.id)

      if (
        !assessment ||
        String(assessment.status || "").toLowerCase() !== "published"
      ) {
        return res
          .status(404)
          .json({ ok: false, message: "Assessment not found." })
      }

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      if (sectionCodes && !sectionCodes.has(String(assessment.scopeId || ""))) {
        return res
          .status(404)
          .json({ ok: false, message: "Assessment not found." })
      }

      const storedQuestions = await records.find(
        "assessment-questions",

        String(assessment.scopeId || ""),
      )

      const grouped = storedQuestions?.questions

      const questions = Array.isArray(grouped)
        ? grouped
        : grouped && typeof grouped === "object"
          ? grouped[String(assessment.title || "")] ||
            grouped[String(assessment.id)] ||
            []
          : []

      const validQuestions = questions.filter(
        (question) =>
          question &&
          typeof question.prompt === "string" &&
          Array.isArray(question.options) &&
          question.options.length >= 2 &&
          Number.isInteger(question.correctAnswer) &&
          question.correctAnswer >= 0 &&
          question.correctAnswer < question.options.length,
      )

      return res.json({
        assessmentId: assessment.id,

        title: assessment.title,

        type: assessment.type,

        questions: validQuestions.map(({ prompt, options }) => ({
          prompt,
          options,
        })),
      })
    } catch (error) {
      return sendError(res, error, "Unable to load assessment questions.")
    }
  })

  router.get("/assessments/:id/attempts", async (req, res) => {
    try {
      const assessment = await records.find("assessments", req.params.id)

      if (!assessment)
        return res
          .status(404)
          .json({ ok: false, message: "Assessment not found." })

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      if (sectionCodes && !sectionCodes.has(String(assessment.scopeId || ""))) {
        return res.status(403).json({
          ok: false,
          message: "You are not allowed to view these attempts.",
        })
      }

      const rows = await records.list("assessment-attempts", {
        scopeId: assessment.scopeId || "",
      })

      return res.json(
        rows

          .filter(
            (attempt) =>
              String(attempt.assessmentId) === String(assessment.id) &&
              (req.user.role !== "student" ||
                String(attempt.studentId) === String(req.user.id)),
          )

          .sort(
            (left, right) =>
              Number(right.attemptNumber) - Number(left.attemptNumber),
          ),
      )
    } catch (error) {
      return sendError(res, error, "Unable to load assessment attempts.")
    }
  })

  router.post("/assessments/:id/attempts", async (req, res) => {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ ok: false, message: "Student access is required." })
    }

    const answers = req.body?.answers

    if (!Array.isArray(answers) || !answers.every(Number.isInteger)) {
      return res.status(400).json({
        ok: false,

        message: "A valid answer is required for every question.",
      })
    }

    try {
      const assessment = await records.find("assessments", req.params.id)

      if (
        !assessment ||
        String(assessment.status || "").toLowerCase() !== "published"
      ) {
        return res
          .status(404)
          .json({ ok: false, message: "Assessment not found." })
      }

      const sectionCodes = await getAccessibleSectionCodes(req.user)

      if (!sectionCodes?.has(String(assessment.scopeId || ""))) {
        return res.status(403).json({
          ok: false,
          message: "You are not enrolled in this assessment's class.",
        })
      }

      const availableDate = Date.parse(String(assessment.availableDate || ""))

      if (Number.isFinite(availableDate) && availableDate > Date.now()) {
        return res
          .status(400)
          .json({ ok: false, message: "This assessment is not available yet." })
      }

      const questionsRecord = await records.find(
        "assessment-questions",

        String(assessment.scopeId || ""),
      )

      const grouped = questionsRecord?.questions

      const questions = Array.isArray(grouped)
        ? grouped
        : grouped && typeof grouped === "object"
          ? grouped[String(assessment.title || "")] ||
            grouped[String(assessment.id)] ||
            []
          : []

      const validQuestions = questions.filter(
        (question) =>
          question &&
          typeof question.prompt === "string" &&
          Array.isArray(question.options) &&
          Number.isInteger(question.correctAnswer) &&
          question.correctAnswer >= 0 &&
          question.correctAnswer < question.options.length,
      )

      if (!validQuestions.length || answers.length !== validQuestions.length) {
        return res.status(400).json({
          ok: false,

          message: "A valid answer is required for every question.",
        })
      }

      if (
        answers.some(
          (answer, index) =>
            answer < 0 || answer >= validQuestions[index].options.length,
        )
      ) {
        return res
          .status(400)
          .json({ ok: false, message: "An answer choice is invalid." })
      }

      const currentAttempts = (
        await records.list("assessment-attempts", {
          scopeId: assessment.scopeId || "",

          ownerId: req.user.id,
        })
      ).filter(
        (attempt) => String(attempt.assessmentId) === String(assessment.id),
      )

      const maximumAttempts = Number(
        assessment.attempts || assessment.maxAttempts || 0,
      )

      if (maximumAttempts > 0 && currentAttempts.length >= maximumAttempts) {
        return res
          .status(409)
          .json({ ok: false, message: "You have used all allowed attempts." })
      }

      const correctAnswers = answers.reduce(
        (total, answer, index) =>
          total + (answer === validQuestions[index].correctAnswer ? 1 : 0),

        0,
      )

      const attemptNumber =
        currentAttempts.reduce(
          (maximum, attempt) =>
            Math.max(maximum, Number(attempt.attemptNumber || 0)),

          0,
        ) + 1

      const attempt = {
        assessmentId: assessment.id,

        studentId: req.user.id,

        attemptNumber,

        correctAnswers,

        questionCount: validQuestions.length,

        scorePercent:
          Math.round((correctAnswers / validQuestions.length) * 10000) / 100,

        submittedAt: new Date().toISOString(),
      }

      const id = `${assessment.id}:${req.user.id}:${attemptNumber}`

      const saved = await records.save(
        "assessment-attempts",

        id,

        assessment.scopeId || "",

        req.user.id,

        attempt,
      )

      return res.status(201).json({ ok: true, attempt: saved })
    } catch (error) {
      return sendError(res, error, "Unable to save the assessment attempt.")
    }
  })

  router.use((req, res) => {
    return res.status(501).json({
      ok: false,

      message: `The normalized API does not yet support ${req.method} ${req.path}.`,
    })
  })

  return { router, repositories }
}
