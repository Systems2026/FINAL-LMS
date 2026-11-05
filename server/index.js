import express from "express"

import cors from "cors"

import mysql from "mysql2/promise"

import crypto from "node:crypto"

import { existsSync } from "node:fs"

import fs from "node:fs/promises"

import path from "node:path"

import { promisify } from "node:util"

import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const scrypt = promisify(crypto.scrypt)

const envPath = path.resolve(__dirname, "../.env")

if (existsSync(envPath)) {
  process.loadEnvFile(envPath)
}

const app = express()

const port = Number(process.env.PORT || 4000)

const dataPath =
  process.env.SNSHS_DATA_PATH || path.join(__dirname, "data.json")

const database = process.env.DB_NAME || "snhs_lms"

if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error(
    "DB_NAME must contain only letters, numbers, and underscores.",
  )
}

const dbConfig = {
  host: process.env.DB_HOST || "localhost",

  port: Number(process.env.DB_PORT || 3306),

  user: process.env.DB_USER || "root",

  password: process.env.DB_PASSWORD || "",

  database,

  waitForConnections: true,

  connectionLimit: 10,

  queueLimit: 0,
}

const allowJsonFallback = process.env.ALLOW_JSON_FALLBACK === "true"

const bootstrapAdmin = {
  id: process.env.BOOTSTRAP_ADMIN_ID || "",

  name: process.env.BOOTSTRAP_ADMIN_NAME || "",

  email: process.env.BOOTSTRAP_ADMIN_EMAIL || "",

  password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "",
}

app.use(cors())

app.use(express.json({ limit: "8mb" }))

const activeSessions = new Map()

const sessionLifetimeMs = 8 * 60 * 60 * 1000

app.use("/api", (req, res, next) => {
  if (req.path === "/login" || req.path === "/health") return next()

  const authorization = req.get("authorization") || ""

  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : ""

  const session = activeSessions.get(token)

  if (!session || session.expiresAt <= Date.now()) {
    if (token) activeSessions.delete(token)

    return res.status(401).json({ ok: false, message: "Sign in to continue." })
  }

  req.user = { id: session.userId, role: session.role }

  req.authToken = token

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    res.once("finish", () => {
      void (async () => {
        try {
          const pool = await ensureMysqlConnection()

          if (!pool) return

          const action = `${req.method} ${req.path}`.slice(0, 255)

          const moduleName = String(req.path.split("/")[1] || "system").slice(
            0,
            64,
          )

          const status = res.statusCode >= 400 ? "Blocked" : "Success"

          await pool.query(
            "INSERT INTO activity_logs (id, message, userId, action, module, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",

            [
              crypto.randomUUID(),

              action,

              req.user.id,

              action,

              moduleName,

              status,
            ],
          )
        } catch (error) {
          console.error("Unable to record API activity:", error)
        }
      })()
    })
  }

  const restrictedCollections =
    /^\/(students|teachers|class-sections|classes)(\/|$)/.test(req.path)

  const selfStudentSubjects =
    session.role === "student" &&
    req.method === "GET" &&
    /^\/students\/[^/]+\/subjects$/.test(req.path) &&
    decodeURIComponent(req.path.split("/")[2]) === session.userId

  const selfStudentClassSection =
    session.role === "student" &&
    req.method === "GET" &&
    /^\/students\/[^/]+\/class-section$/.test(req.path) &&
    decodeURIComponent(req.path.split("/")[2]) === session.userId

  if (
    restrictedCollections &&
    req.method === "GET" &&
    session.role !== "admin" &&
    !selfStudentSubjects &&
    !selfStudentClassSection
  ) {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  if (
    req.path.startsWith("/enrollments") &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    session.role !== "admin"
  ) {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const role = session.role

    const path = req.path

    const administratorOnly =
      /^\/(students|teachers|subjects|classes|class-sections|subject-sections|enrollments)(\/|$)/.test(
        path,
      ) ||
      path.startsWith("/admin/records/") ||
      /^\/records\/(settings|class-statuses)(\/|$)/.test(path)

    if (administratorOnly && role !== "admin") {
      return res
        .status(403)
        .json({ ok: false, message: "Administrator access is required." })
    }

    const resource = path.match(/^\/records\/([^/]+)/)?.[1]

    if (
      resource &&
      [
        "assignments",
        "assessments",
        "assessment-questions",
        "class-content",
        "lessons",
      ].includes(resource) &&
      !["admin", "teacher"].includes(role)
    ) {
      return res
        .status(403)
        .json({ ok: false, message: "Teacher access is required." })
    }

    if (resource === "announcements" && !["admin", "teacher"].includes(role)) {
      return res
        .status(403)
        .json({ ok: false, message: "Staff access is required." })
    }

    if (resource === "submissions" && role !== "student") {
      return res
        .status(403)
        .json({ ok: false, message: "Student access is required." })
    }

    if (resource === "scores" && !["admin", "teacher"].includes(role)) {
      return res
        .status(403)
        .json({ ok: false, message: "Staff access is required." })
    }
  }

  next()
})

const defaultState = {
  users: [],

  subjects: [],

  classSections: [],

  classes: [],

  subjectSections: [],

  enrollments: [],

  logs: [],

  records: [],
}

let mysqlPool = null

let mysqlReady = false

let studentCreationQueue = Promise.resolve()

function serializeStudentCreation(operation) {
  const result = studentCreationQueue.then(operation, operation)

  studentCreationQueue = result.then(
    () => undefined,

    () => undefined,
  )

  return result
}

function maxNumericUserId(users) {
  return users.reduce((maximum, user) => {
    if (!/^\d+$/.test(String(user.id))) {
      return maximum
    }

    const id = BigInt(user.id)

    return id > maximum ? id : maximum
  }, 26000n)
}

function getConfiguredBootstrapAdmin() {
  if (!Object.values(bootstrapAdmin).some(Boolean)) return null

  const admin = {
    id: bootstrapAdmin.id.trim().toUpperCase(),

    name: bootstrapAdmin.name.trim(),

    email: bootstrapAdmin.email.trim().toLowerCase(),

    password: bootstrapAdmin.password,
  }

  if (
    !/^[A-Z0-9_-]{1,64}$/.test(admin.id) ||
    !admin.name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) ||
    admin.password.length < 12
  ) {
    throw new Error(
      "A first administrator requires a valid BOOTSTRAP_ADMIN_ID, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.",
    )
  }

  return admin
}

async function addBootstrapAdminIfEmpty(state) {
  if (state.users.length > 0) return false

  const admin = getConfiguredBootstrapAdmin()

  if (!admin) return false

  state.users.push({
    id: admin.id,

    name: admin.name,

    role: "admin",

    email: admin.email,

    password: await hashPassword(admin.password),
  })

  return true
}

async function ensureMysqlConnection() {
  if (mysqlReady && mysqlPool) return mysqlPool

  try {
    const bootstrapPool = mysql.createPool({
      host: dbConfig.host,

      port: dbConfig.port,

      user: dbConfig.user,

      password: dbConfig.password,

      connectionLimit: dbConfig.connectionLimit,

      queueLimit: dbConfig.queueLimit,
    })

    await bootstrapPool.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\``,
    )

    await bootstrapPool.end()

    mysqlPool = mysql.createPool(dbConfig)

    await mysqlPool.query("SELECT 1")

    mysqlReady = true

    console.log("Connected to MySQL/WAMP database.")

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL DEFAULT '',
        gradeLevel VARCHAR(64) NOT NULL DEFAULT '',
        strand VARCHAR(64) NOT NULL DEFAULT '',
        \`section\` VARCHAR(64) NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL DEFAULT 'Active'
      )
    `)

    for (const [column, definition] of [
      ["gradeLevel", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["strand", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["section", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["classSectionCode", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["status", "VARCHAR(32) NOT NULL DEFAULT 'Active'"],

      ["subject", "VARCHAR(255) NOT NULL DEFAULT ''"],
    ]) {
      const [columns] = await mysqlPool.query(
        "SHOW COLUMNS FROM users LIKE ?",

        [column],
      )

      if (!columns.length) {
        const columnName = column === "section" ? `\`${column}\`` : column

        await mysqlPool.query(
          `ALTER TABLE users ADD COLUMN ${columnName} ${definition}`,
        )
      }
    }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS student_id_sequence (
        sequence_name VARCHAR(64) PRIMARY KEY,
        \`last_value\` BIGINT UNSIGNED NOT NULL
      ) ENGINE=InnoDB
    `)

    await mysqlPool.query(
      "ALTER TABLE student_id_sequence ENGINE = InnoDB",
    )

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        code VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        units DECIMAL(5,2) NOT NULL DEFAULT 0,
        gradeLevel VARCHAR(64) DEFAULT '',
        strand VARCHAR(64) DEFAULT '',
        schoolYear VARCHAR(64) DEFAULT '',
        semester VARCHAR(64) DEFAULT ''
      )
    `)

    for (const [column, definition] of [
      ["description", "TEXT NULL"],

      ["units", "DECIMAL(5,2) NOT NULL DEFAULT 0"],
    ]) {
      const [columns] = await mysqlPool.query(
        "SHOW COLUMNS FROM subjects LIKE ?",

        [column],
      )

      if (!columns.length) {
        await mysqlPool.query(
          `ALTER TABLE subjects ADD COLUMN ${column} ${definition}`,
        )
      }
    }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS class_sections (
        code VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        gradeLevel VARCHAR(64) NOT NULL,
        strand VARCHAR(64) NOT NULL,
        schoolYear VARCHAR(64) NOT NULL,
        adviser VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      )
    `)

    const [classSectionStatusColumns] = await mysqlPool.query(
      "SHOW COLUMNS FROM class_sections LIKE 'status'",
    )

    if (!classSectionStatusColumns.length) {
      await mysqlPool.query(
        "ALTER TABLE class_sections ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'",
      )
    }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        code VARCHAR(64) PRIMARY KEY,
        subject VARCHAR(255) NOT NULL,
        teacher VARCHAR(255) NOT NULL,
        room VARCHAR(255) NOT NULL,
        schedule VARCHAR(255) NOT NULL,
        color VARCHAR(32) NOT NULL,
        gradeLevel VARCHAR(64) DEFAULT '',
        strand VARCHAR(64) DEFAULT '',
        schoolYear VARCHAR(64) DEFAULT ''
      )
    `)

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS subject_sections (
        id VARCHAR(64) PRIMARY KEY,
        subjectCode VARCHAR(64) NOT NULL,
        subjectName VARCHAR(255) NOT NULL,
        classSectionCode VARCHAR(64) NOT NULL,
        classSectionName VARCHAR(255) NOT NULL,
        teacher VARCHAR(255) NOT NULL,
        schoolYear VARCHAR(64) NOT NULL,
        semester VARCHAR(64) NOT NULL,
        enrolledStudents JSON NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      ) ENGINE=InnoDB ROW_FORMAT=DYNAMIC
    `)

    const [subjectSectionStatusColumns] = await mysqlPool.query(
      "SHOW COLUMNS FROM subject_sections LIKE 'status'",
    )

    if (!subjectSectionStatusColumns.length) {
      await mysqlPool.query(
        "ALTER TABLE subject_sections ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'",
      )
    }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR(64) PRIMARY KEY,
        studentId VARCHAR(64) NOT NULL,
        studentName VARCHAR(255) NOT NULL,
        subjectSectionId VARCHAR(64) NULL,
        subjectCode VARCHAR(64) NOT NULL,
        subjectName VARCHAR(255) NOT NULL,
        teacher VARCHAR(255) NOT NULL,
        enrolledAt DATETIME NOT NULL,
        schoolYear VARCHAR(64) NOT NULL DEFAULT '',
        semester VARCHAR(64) NOT NULL DEFAULT '',
        status VARCHAR(32) NOT NULL DEFAULT 'active'
      )
    `)

    for (const [column, definition] of [
      ["schoolYear", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["semester", "VARCHAR(64) NOT NULL DEFAULT ''"],

      ["status", "VARCHAR(32) NOT NULL DEFAULT 'active'"],
    ]) {
      const [columns] = await mysqlPool.query(
        "SHOW COLUMNS FROM enrollments LIKE ?",

        [column],
      )

      if (!columns.length) {
        await mysqlPool.query(
          `ALTER TABLE enrollments ADD COLUMN ${column} ${definition}`,
        )
      }
    }

    const [enrollmentColumns] = await mysqlPool.query(
      "SHOW COLUMNS FROM enrollments LIKE 'subjectSectionId'",
    )

    if (!enrollmentColumns.length) {
      await mysqlPool.query(
        "ALTER TABLE enrollments ADD COLUMN subjectSectionId VARCHAR(64) NULL",
      )
    }

    await mysqlPool.query(`
      UPDATE enrollments e
      JOIN subject_sections ss ON ss.id = e.subjectSectionId
      SET e.schoolYear = ss.schoolYear, e.semester = ss.semester
      WHERE e.schoolYear = '' OR e.semester = ''
    `)

    for (const table of [
      "users",
      "classes",
      "class_sections",
      "subjects",
      "subject_sections",
      "enrollments",
    ]) {
      const [tableRows] = await mysqlPool.query(
        `SELECT ENGINE FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      )

      if (!tableRows.length) {
        throw new Error(`Required database table ${table} was not found.`)
      }

      if (tableRows[0].ENGINE !== "InnoDB") {
        await mysqlPool.query(
          `ALTER TABLE \`${table}\` ENGINE = InnoDB, ROW_FORMAT = DYNAMIC`,
        )
      }
    }

    for (const [table, indexName, duplicateQuery] of [
      [
        "subject_sections",

        "uq_subject_section_period",

        `SELECT subjectCode FROM subject_sections
         GROUP BY subjectCode, classSectionCode, schoolYear, semester
         HAVING COUNT(*) > 1 LIMIT 1`,
      ],

      [
        "enrollments",

        "uq_student_subject_section",

        `SELECT studentId FROM enrollments
         WHERE subjectSectionId IS NOT NULL
         GROUP BY studentId, subjectSectionId
         HAVING COUNT(*) > 1 LIMIT 1`,
      ],
    ]) {
      const [indexes] = await mysqlPool.query(
        `SHOW INDEX FROM ${table} WHERE Key_name = ?`,

        [indexName],
      )

      if (indexes.length) continue

      const [duplicates] = await mysqlPool.query(duplicateQuery)

      if (duplicates.length) {
        console.warn(
          `Skipped ${indexName} migration because existing duplicate records need review.`,
        )

        continue
      }

      const columns =
        table === "subject_sections"
          ? "subjectCode, classSectionCode, schoolYear, semester"
          : "studentId, subjectSectionId"

      await mysqlPool.query(
        `ALTER TABLE ${table} ADD UNIQUE INDEX ${indexName} (${columns})`,
      )
    }

    await mysqlPool.query(`
      UPDATE enrollments e
      JOIN (
        SELECT subjectCode, teacher, MIN(id) AS subjectSectionId
        FROM subject_sections
        GROUP BY subjectCode, teacher
        HAVING COUNT(*) = 1
      ) ss ON e.subjectCode = ss.subjectCode AND e.teacher = ss.teacher
      SET e.subjectSectionId = ss.subjectSectionId
      WHERE e.subjectSectionId IS NULL
    `)

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(64) PRIMARY KEY,
        message VARCHAR(255) NOT NULL,
        userId VARCHAR(64) NULL,
        action VARCHAR(255) NULL,
        module VARCHAR(64) NULL,
        status VARCHAR(32) NULL,
        created_at DATETIME NOT NULL
      )
    `)

    const [activityLogColumns] = await mysqlPool.query(
      "SHOW COLUMNS FROM activity_logs",
    )

    const existingActivityLogColumns = new Set(
      activityLogColumns.map((column) => column.Field),
    )

    for (const [column, definition] of [
      ["userId", "VARCHAR(64) NULL"],

      ["action", "VARCHAR(255) NULL"],

      ["module", "VARCHAR(64) NULL"],

      ["status", "VARCHAR(32) NULL"],
    ]) {
      if (!existingActivityLogColumns.has(column)) {
        await mysqlPool.query(
          `ALTER TABLE activity_logs ADD COLUMN ${column} ${definition}`,
        )
      }
    }

    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS lms_records (
        resource VARCHAR(64) NOT NULL,
        id VARCHAR(128) NOT NULL,
        scopeId VARCHAR(128) NOT NULL DEFAULT '',
        ownerId VARCHAR(64) NOT NULL DEFAULT '',
        payload JSON NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (resource, id),
        INDEX idx_lms_records_scope (resource, scopeId),
        INDEX idx_lms_records_owner (resource, ownerId)
      ) ENGINE=InnoDB
    `)

    const [userRows] = await mysqlPool.query(
      "SELECT COUNT(*) AS count FROM users",
    )

    if (Number(userRows[0].count) === 0) {
      const admin = getConfiguredBootstrapAdmin()

      if (admin) {
        await mysqlPool.query(
          "INSERT INTO users (id, name, role, email, password) VALUES (?, ?, 'admin', ?, ?)",

          [
            admin.id,

            admin.name,

            admin.email,

            await hashPassword(admin.password),
          ],
        )

        console.log("Created the configured first administrator account.")
      } else {
        console.warn(
          "No user accounts exist. Configure the BOOTSTRAP_ADMIN_* variables to create the first administrator.",
        )
      }
    }

    const [numericStudentRows] = await mysqlPool.query(
      "SELECT MAX(CAST(id AS UNSIGNED)) AS maxId FROM users WHERE role = 'student' AND id REGEXP '^[0-9]+$'",
    )

    const existingMaxId = BigInt(numericStudentRows[0].maxId || "26000")

    const initialSequenceValue =
      existingMaxId > 26000n ? existingMaxId.toString() : "26000"

    await mysqlPool.query(
      `INSERT INTO student_id_sequence (sequence_name, \`last_value\`)
       VALUES ('students', ?)
       ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, VALUES(\`last_value\`))`,

      [initialSequenceValue],
    )

    const [numericTeacherRows] = await mysqlPool.query(
      "SELECT MAX(CAST(id AS UNSIGNED)) AS maxId FROM users WHERE role = 'teacher' AND id REGEXP '^[0-9]+$'",
    )

    const existingMaxTeacherId = BigInt(
      numericTeacherRows[0].maxId || "2026000",
    )

    const initialTeacherSequenceValue =
      existingMaxTeacherId > 2026000n
        ? existingMaxTeacherId.toString()
        : "2026000"

    await mysqlPool.query(
      `INSERT INTO student_id_sequence (sequence_name, \`last_value\`)
       VALUES ('teachers', ?)
       ON DUPLICATE KEY UPDATE \`last_value\` = GREATEST(\`last_value\`, VALUES(\`last_value\`))`,

      [initialTeacherSequenceValue],
    )
  } catch (error) {
    mysqlPool = null

    mysqlReady = false

    if (!allowJsonFallback) {
      console.error(
        "Unable to initialize the configured MySQL/WAMP database.",
        error,
      )

      throw new Error(
        "MySQL/WAMP is required but the configured database could not be initialized.",

        { cause: error },
      )
    }

    console.warn(
      "MySQL/WAMP initialization failed; explicitly enabled JSON fallback is active.",
      error,
    )
  }

  return mysqlPool
}

function parseStudentRoster(value) {
  if (Array.isArray(value)) return value

  if (typeof value !== "string" || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return value

      .split(",")

      .map((item) => item.trim())

      .filter(Boolean)
  }
}

async function loadState() {
  const pool = await ensureMysqlConnection()

  if (pool) {
    const [users] = await pool.query("SELECT * FROM users")

    const [subjects] = await pool.query("SELECT * FROM subjects")

    const [classSections] = await pool.query("SELECT * FROM class_sections")

    const [classes] = await pool.query("SELECT * FROM classes")

    const [subjectSections] = await pool.query("SELECT * FROM subject_sections")

    const [enrollments] = await pool.query("SELECT * FROM enrollments")

    const [logs] = await pool.query("SELECT * FROM activity_logs")

    return {
      users: users.map((user) => ({
        id: user.id,

        name: user.name,

        role: user.role,

        email: user.email,

        password: user.password,

        subject: user.subject || "",

        gradeLevel: user.gradeLevel,

        strand: user.strand || "",

        section: user.section,

        classSectionCode: user.classSectionCode || "",

        status: user.status,
      })),

      subjects: subjects.map((subject) => ({
        code: subject.code,

        name: subject.name,

        description: subject.description || "",

        units: Number(subject.units || 0),

        gradeLevel: subject.gradeLevel,

        strand: subject.strand,

        schoolYear: subject.schoolYear,

        semester: subject.semester,
      })),

      classSections: classSections.map((section) => ({
        code: section.code,

        name: section.name,

        gradeLevel: section.gradeLevel,

        strand: section.strand,

        schoolYear: section.schoolYear,

        adviser: section.adviser,

        status: section.status || "active",
      })),

      classes: classes.map((classItem) => ({
        subject: classItem.subject,

        code: classItem.code,

        teacher: classItem.teacher,

        room: classItem.room,

        schedule: classItem.schedule,

        color: classItem.color,

        gradeLevel: classItem.gradeLevel,

        strand: classItem.strand,

        schoolYear: classItem.schoolYear,
      })),

      subjectSections: subjectSections.map((section) => ({
        id: section.id,

        subjectCode: section.subjectCode,

        subjectName: section.subjectName,

        classSectionCode: section.classSectionCode,

        classSectionName: section.classSectionName,

        teacher: section.teacher,

        schoolYear: section.schoolYear,

        semester: section.semester,

        enrolledStudents: parseStudentRoster(section.enrolledStudents),

        status: section.status || "active",
      })),

      enrollments: enrollments.map((record) => ({
        id: record.id,

        studentId: record.studentId,

        studentName: record.studentName,

        subjectSectionId: record.subjectSectionId,

        subjectCode: record.subjectCode,

        subjectName: record.subjectName,

        teacher: record.teacher,

        enrolledAt: record.enrolledAt,

        schoolYear: record.schoolYear || "",

        semester: record.semester || "",

        status: record.status || "active",
      })),

      logs: logs.map((log) => ({
        id: log.id,

        message: log.message,

        timestamp: log.created_at,
      })),
    }
  }

  let parsed

  try {
    const file = await fs.readFile(dataPath, "utf8")

    parsed = JSON.parse(file)
  } catch (error) {
    if (error.code !== "ENOENT") throw error

    const state = JSON.parse(JSON.stringify(defaultState))

    await addBootstrapAdminIfEmpty(state)

    await fs.writeFile(dataPath, JSON.stringify(state, null, 2), "utf8")

    return state
  }

  const defaults = JSON.parse(JSON.stringify(defaultState))

  const state = {
    ...defaults,

    ...parsed,

    users: Array.isArray(parsed.users) ? parsed.users : defaults.users,

    subjects: Array.isArray(parsed.subjects)
      ? parsed.subjects
      : defaults.subjects,

    classSections: Array.isArray(parsed.classSections)
      ? parsed.classSections
      : defaults.classSections,

    classes: Array.isArray(parsed.classes) ? parsed.classes : defaults.classes,

    subjectSections: Array.isArray(parsed.subjectSections)
      ? parsed.subjectSections
      : defaults.subjectSections,

    enrollments: Array.isArray(parsed.enrollments)
      ? parsed.enrollments
      : defaults.enrollments,

    logs: Array.isArray(parsed.logs) ? parsed.logs : defaults.logs,

    records: Array.isArray(parsed.records) ? parsed.records : [],
  }

  if (await addBootstrapAdminIfEmpty(state)) {
    await fs.writeFile(dataPath, JSON.stringify(state, null, 2), "utf8")
  }

  return state
}

async function saveState(state) {
  const pool = await ensureMysqlConnection()

  if (pool) {
    await pool.query("DELETE FROM users")

    await pool.query(
      "INSERT INTO users (id, name, role, email, password, gradeLevel, strand, `section`, classSectionCode, status) VALUES ?",

      [
        state.users.map((user) => [
          user.id,
          user.name,
          user.role,
          user.email,
          user.password,
          user.gradeLevel || "",
          user.strand || "",
          user.section || "",
          user.classSectionCode || "",
          user.status || "Active",
        ]),
      ],
    )

    await pool.query("DELETE FROM subjects")

    await pool.query(
      "INSERT INTO subjects (code, name, description, units, gradeLevel, strand, schoolYear, semester) VALUES ?",

      [
        state.subjects.map((subject) => [
          subject.code,
          subject.name,
          subject.description || "",
          Number(subject.units || 0),
          subject.gradeLevel || "",
          subject.strand || "",
          subject.schoolYear || "",
          subject.semester || "",
        ]),
      ],
    )

    await pool.query("DELETE FROM class_sections")

    await pool.query(
      "INSERT INTO class_sections (code, name, gradeLevel, strand, schoolYear, adviser, status) VALUES ?",

      [
        state.classSections.map((section) => [
          section.code,
          section.name,
          section.gradeLevel,
          section.strand,
          section.schoolYear,
          section.adviser,
          section.status || "active",
        ]),
      ],
    )

    await pool.query("DELETE FROM classes")

    await pool.query(
      "INSERT INTO classes (code, subject, teacher, room, schedule, color, gradeLevel, strand, schoolYear) VALUES ?",

      [
        state.classes.map((classItem) => [
          classItem.code,

          classItem.subject,

          classItem.teacher,

          classItem.room,

          classItem.schedule,

          classItem.color,

          classItem.gradeLevel || "",

          classItem.strand || "",

          classItem.schoolYear || "",
        ]),
      ],
    )

    await pool.query("DELETE FROM subject_sections")

    await pool.query(
      "INSERT INTO subject_sections (id, subjectCode, subjectName, classSectionCode, classSectionName, teacher, schoolYear, semester, enrolledStudents, status) VALUES ?",

      [
        state.subjectSections.map((section) => [
          section.id,
          section.subjectCode,
          section.subjectName,
          section.classSectionCode,
          section.classSectionName,
          section.teacher,
          section.schoolYear,
          section.semester,
          JSON.stringify(section.enrolledStudents || []),
          section.status || "active",
        ]),
      ],
    )

    await pool.query("DELETE FROM enrollments")

    await pool.query(
      "INSERT INTO enrollments (id, studentId, studentName, subjectSectionId, subjectCode, subjectName, teacher, enrolledAt, schoolYear, semester, status) VALUES ?",

      [
        state.enrollments.map((record) => [
          record.id,

          record.studentId,

          record.studentName,

          record.subjectSectionId || null,

          record.subjectCode,

          record.subjectName,

          record.teacher,

          record.enrolledAt,

          record.schoolYear || "",

          record.semester || "",

          record.status || "active",
        ]),
      ],
    )

    return
  }

  await fs.writeFile(dataPath, JSON.stringify(state, null, 2), "utf8")
}

async function hashPassword(value) {
  const salt = crypto.randomBytes(16)

  const key = await scrypt(String(value), salt, 64)

  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`
}

async function verifyPassword(value, stored) {
  const storedPassword = String(stored || "")

  const parts = storedPassword.split("$")

  if (parts[0] === "scrypt") {
    if (
      parts.length !== 3 ||
      !/^[a-f\d]{32}$/i.test(parts[1]) ||
      !/^[a-f\d]{128}$/i.test(parts[2])
    ) {
      return false
    }

    const salt = Buffer.from(parts[1], "hex")

    const expected = Buffer.from(parts[2], "hex")

    const actual = await scrypt(String(value), salt, expected.length)

    return crypto.timingSafeEqual(actual, expected)
  }

  const submittedHash = crypto

    .createHash("sha256")

    .update(String(value))

    .digest()

  const storedHash = crypto

    .createHash("sha256")

    .update(storedPassword)

    .digest()

  return crypto.timingSafeEqual(submittedHash, storedHash)
}

async function verifyAdministrator(adminId, password) {
  const normalizedId = String(adminId || "")
    .trim()
    .toUpperCase()

  if (!normalizedId || !password) {
    return {
      error: {
        status: 400,
        message: "Administrator ID and password are required.",
      },
    }
  }

  const pool = await ensureMysqlConnection()

  let admin

  if (pool) {
    const [rows] = await pool.query(
      "SELECT id, password FROM users WHERE id = ? AND role = 'admin' LIMIT 1",

      [normalizedId],
    )

    admin = rows[0]
  } else {
    const state = await loadState()

    admin = state.users.find(
      (user) => user.id === normalizedId && user.role === "admin",
    )
  }

  if (!admin || !(await verifyPassword(password, admin.password))) {
    return {
      error: { status: 401, message: "Administrator password is incorrect." },
    }
  }

  return { adminId: normalizedId }
}

function studentMatchesClassSection(student, classSection) {
  if (!student || !classSection) {
    return false
  }

  const sectionLetter = getClassSectionLetter(classSection)

  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()

  const normalizeStrand = (value) => {
    const strand = normalize(value)

    return strand === "ict" ? "tvl-ict" : strand
  }

  const studentSection = normalize(student.section)

  const sectionName = normalize(classSection.name)

  const sectionCode = normalize(classSection.code)

  const gradeMatches =
    normalize(student.gradeLevel) === normalize(classSection.gradeLevel)

  const strandMatches =
    !student.strand ||
    normalizeStrand(student.strand) === normalizeStrand(classSection.strand)

  const sectionCodeMatches =
    !student.classSectionCode ||
    String(student.classSectionCode).trim().toLowerCase() ===
      String(classSection.code).trim().toLowerCase()

  return (
    gradeMatches &&
    strandMatches &&
    sectionCodeMatches &&
    [sectionName, sectionCode, sectionLetter.toLowerCase()].includes(
      studentSection,
    )
  )
}

function getClassSectionLetter(classSection) {
  const name = String(classSection?.name || "")
    .trim()
    .toUpperCase()

  if (name === "A" || name === "B") return name

  const nameMatch = name.match(/(?:^|[\s_-])([AB])$/)

  if (nameMatch) return nameMatch[1]

  const code = String(classSection?.code || "")
    .trim()
    .toUpperCase()

  return code.match(/([AB])$/)?.[1] || ""
}

function getStudentSectionLetter(student, classSections) {
  const classSection = classSections.find((section) =>
    studentMatchesClassSection(student, section),
  )

  return (
    getClassSectionLetter(classSection) ||
    getClassSectionLetter({ name: student.section, code: student.section })
  )
}

function normalizeSchoolYear(value) {
  return String(value || "")
    .trim()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, "-")
}

function normalizedSchoolYearSql(column) {
  const dashes = [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015, 0x2212]
  const normalizedDashes = dashes.reduce(
    (expression, codePoint) =>
      `REPLACE(${expression}, '${String.fromCharCode(codePoint)}', '-')`,
    `TRIM(${column})`,
  )

  return `REPLACE(REPLACE(REPLACE(${normalizedDashes}, ' - ', '-'), ' -', '-'), '- ', '-')`
}

function getActiveAcademicPeriodFromState(state) {
  const settings = (state.records || []).find(
    (record) => record.resource === "settings" && record.id === "lms-settings",
  )

  const schoolInfo = settings?.schoolInfo || {}

  const schoolYear = normalizeSchoolYear(schoolInfo.schoolYear)

  const semester = String(schoolInfo.semester || "").trim()

  return schoolYear && semester ? { schoolYear, semester } : null
}

function enrollmentIsActiveForPeriod(enrollment, offering, period) {
  if ((enrollment.status || "active") !== "active") return false

  if (!period) return true

  const schoolYear = enrollment.schoolYear || offering?.schoolYear || ""

  const semester = enrollment.semester || offering?.semester || ""

  return (
    normalizeSchoolYear(schoolYear) === normalizeSchoolYear(period.schoolYear) &&
    semester === period.semester
  )
}

async function getActiveAcademicPeriod(connection, state) {
  if (!connection) return getActiveAcademicPeriodFromState(state)

  const [rows] = await connection.query(
    "SELECT payload FROM lms_records WHERE resource = 'settings' AND id = 'lms-settings' LIMIT 1",
  )

  const payload =
    typeof rows[0]?.payload === "string"
      ? JSON.parse(rows[0].payload)
      : rows[0]?.payload

  const schoolInfo = payload?.schoolInfo || {}

  const schoolYear = normalizeSchoolYear(schoolInfo.schoolYear)

  const semester = String(schoolInfo.semester || "").trim()

  return schoolYear && semester ? { schoolYear, semester } : null
}

async function syncStudentEnrollmentsInMysql(
  connection,
  student,
  classSectionCode,
  period,
) {
  const [offerings] = await connection.query(
    `SELECT * FROM subject_sections
     WHERE classSectionCode = ? AND ${normalizedSchoolYearSql("schoolYear")} = ?
       AND semester = ? AND status = 'active'
     FOR UPDATE`,

    [classSectionCode, period.schoolYear, period.semester],
  )

  const enrolledSubjects = []

  for (const offering of offerings) {
    let roster = parseStudentRoster(offering.enrolledStudents)

    const [existing] = await connection.query(
      `SELECT id, status FROM enrollments
       WHERE studentId = ? AND subjectSectionId = ?
       ORDER BY enrolledAt DESC LIMIT 1 FOR UPDATE`,

      [student.id, offering.id],
    )

    if (existing[0]?.status === "active") {
      if (!roster.includes(student.id)) roster.push(student.id)

      await connection.query(
        "UPDATE subject_sections SET enrolledStudents = ? WHERE id = ?",

        [JSON.stringify(roster), offering.id],
      )

      enrolledSubjects.push({
        subjectCode: offering.subjectCode,

        subjectName: offering.subjectName,

        teacher: offering.teacher,
      })

      continue
    }

    if (existing.length) {
      await connection.query(
        `UPDATE enrollments SET studentName = ?, subjectCode = ?, subjectName = ?,
         teacher = ?, enrolledAt = NOW(), schoolYear = ?, semester = ?, status = 'active'
         WHERE id = ?`,

        [
          student.name,

          offering.subjectCode,

          offering.subjectName,

          offering.teacher,

          period.schoolYear,

          period.semester,

          existing[0].id,
        ],
      )
    } else {
      await connection.query(
        `INSERT INTO enrollments
         (id, studentId, studentName, subjectSectionId, subjectCode, subjectName,
          teacher, enrolledAt, schoolYear, semester, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, 'active')`,

        [
          `enr-${crypto.randomUUID()}`,

          student.id,

          student.name,

          offering.id,

          offering.subjectCode,

          offering.subjectName,

          offering.teacher,

          period.schoolYear,

          period.semester,
        ],
      )
    }

    if (!roster.includes(student.id)) roster.push(student.id)

    await connection.query(
      "UPDATE subject_sections SET enrolledStudents = ? WHERE id = ?",

      [JSON.stringify(roster), offering.id],
    )

    enrolledSubjects.push({
      subjectCode: offering.subjectCode,

      subjectName: offering.subjectName,

      teacher: offering.teacher,
    })
  }

  return enrolledSubjects
}

function syncStudentEnrollmentsInState(
  state,
  student,
  classSectionCode,
  period,
) {
  const offerings = state.subjectSections.filter(
    (offering) =>
      offering.classSectionCode === classSectionCode &&
      normalizeSchoolYear(offering.schoolYear) ===
        normalizeSchoolYear(period.schoolYear) &&
      offering.semester === period.semester &&
      (offering.status || "active") === "active",
  )

  const enrolledSubjects = []

  for (const offering of offerings) {
    offering.enrolledStudents ||= []

    let existing = state.enrollments.find(
      (enrollment) =>
        enrollment.studentId === student.id &&
        enrollment.subjectSectionId === offering.id &&
        (enrollment.status || "active") === "active",
    )

    if (!existing) {
      existing = [...state.enrollments]

        .reverse()

        .find(
          (enrollment) =>
            enrollment.studentId === student.id &&
            enrollment.subjectSectionId === offering.id,
        )
    }

    if (existing) {
      Object.assign(existing, {
        studentName: student.name,

        subjectCode: offering.subjectCode,

        subjectName: offering.subjectName,

        teacher: offering.teacher,

        schoolYear: period.schoolYear,

        semester: period.semester,

        status: "active",

        enrolledAt: new Date().toISOString(),
      })
    } else {
      state.enrollments.push({
        id: `enr-${crypto.randomUUID()}`,

        studentId: student.id,

        studentName: student.name,

        subjectSectionId: offering.id,

        subjectCode: offering.subjectCode,

        subjectName: offering.subjectName,

        teacher: offering.teacher,

        schoolYear: period.schoolYear,

        semester: period.semester,

        status: "active",

        enrolledAt: new Date().toISOString(),
      })
    }

    if (!offering.enrolledStudents.includes(student.id)) {
      offering.enrolledStudents.push(student.id)
    }

    enrolledSubjects.push({
      subjectCode: offering.subjectCode,

      subjectName: offering.subjectName,

      teacher: offering.teacher,
    })
  }

  return enrolledSubjects
}

async function deactivateSectionEnrollmentsInMysql(
  connection,
  studentId,
  classSectionCode,
  period,
) {
  const [offerings] = await connection.query(
    `SELECT id, enrolledStudents FROM subject_sections
     WHERE classSectionCode = ? AND ${normalizedSchoolYearSql("schoolYear")} = ? AND semester = ?`,

    [classSectionCode, period.schoolYear, period.semester],
  )

  for (const offering of offerings) {
    await connection.query(
      `UPDATE enrollments SET status = 'inactive'
       WHERE studentId = ? AND subjectSectionId = ? AND status = 'active'
         AND (schoolYear = '' OR ${normalizedSchoolYearSql("schoolYear")} = ?)
         AND (semester = '' OR semester = ?)`,

      [studentId, offering.id, period.schoolYear, period.semester],
    )

    await connection.query(
      "UPDATE subject_sections SET enrolledStudents = ? WHERE id = ?",

      [
        JSON.stringify(
          parseStudentRoster(offering.enrolledStudents).filter(
            (id) => id !== studentId,
          ),
        ),

        offering.id,
      ],
    )
  }
}

function deactivateSectionEnrollmentsInState(
  state,
  studentId,
  classSectionCode,
  period,
) {
  for (const offering of state.subjectSections) {
    if (
      offering.classSectionCode !== classSectionCode ||
      normalizeSchoolYear(offering.schoolYear) !==
        normalizeSchoolYear(period.schoolYear) ||
      offering.semester !== period.semester
    ) {
      continue
    }

    for (const enrollment of state.enrollments) {
      if (
        enrollment.studentId === studentId &&
        enrollment.subjectSectionId === offering.id &&
        (enrollment.status || "active") === "active"
      ) {
        enrollment.status = "inactive"
      }
    }

    offering.enrolledStudents = (offering.enrolledStudents || []).filter(
      (id) => id !== studentId,
    )
  }
}

function addEnrollmentRostersToSections(state) {
  const legacySectionByOffering = new Map()

  for (const section of state.subjectSections) {
    const key = `${section.subjectCode}\0${section.teacher}`

    legacySectionByOffering.set(
      key,

      legacySectionByOffering.has(key) ? null : section,
    )
  }

  return state.subjectSections.map((section) => {
    const enrolledIds = new Set(section.enrolledStudents || [])

    for (const enrollment of state.enrollments) {
      if (
        enrollment.subjectSectionId === section.id &&
        (enrollment.status || "active") === "active"
      ) {
        enrolledIds.add(enrollment.studentId)

        continue
      }

      if (
        !enrollment.subjectSectionId &&
        (enrollment.status || "active") === "active" &&
        legacySectionByOffering.get(
          `${enrollment.subjectCode}\0${enrollment.teacher}`,
        )?.id === section.id
      ) {
        enrolledIds.add(enrollment.studentId)
      }
    }

    const classSection = state.classSections.find(
      (item) => item.code === section.classSectionCode,
    )

    const sectionEnrollments = state.enrollments.filter(
      (enrollment) => enrollment.subjectSectionId === section.id,
    )

    const activeIds = new Set(
      sectionEnrollments

        .filter((enrollment) => (enrollment.status || "active") === "active")

        .map((enrollment) => enrollment.studentId),
    )

    const inactiveIds = new Set(
      sectionEnrollments

        .filter((enrollment) => enrollment.status === "inactive")

        .map((enrollment) => enrollment.studentId),
    )

    return {
      ...section,

      gradeLevel: classSection?.gradeLevel || "",

      strand: classSection?.strand || "",

      enrolledStudents: [
        ...new Set(
          [...enrolledIds].filter(
            (id) =>
              !inactiveIds.has(id) &&
              (activeIds.has(id) ||
                !sectionEnrollments.some(
                  (enrollment) => enrollment.studentId === id,
                )),
          ),
        ),
      ],
    }
  })
}

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,

    message: "SNSHS LMS backend is running.",

    database: mysqlReady ? "mysql" : "json",
  })
})

app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const [users] = await pool.query(
        "SELECT id, name, gradeLevel FROM users WHERE id = ? AND role = ? LIMIT 1",

        [req.user.id, req.user.role],
      )

      const user = users[0]

      if (!user) {
        return res
          .status(404)
          .json({ ok: false, message: "Dashboard user not found." })
      }

      if (req.user.role === "admin") {
        const [[totals]] = await pool.query(`
          SELECT
            (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
            (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS teachers,
            (SELECT COUNT(*) FROM subjects) AS subjects,
            (SELECT COUNT(*) FROM class_sections) AS sections,
            (SELECT COUNT(*) FROM enrollments WHERE status = 'active') AS enrollments
        `)

        const [gradeRows] = await pool.query(`
          SELECT COALESCE(NULLIF(gradeLevel, ''), 'Unassigned') AS gradeLevel,
                 COUNT(*) AS count
          FROM users
          WHERE role = 'student'
          GROUP BY COALESCE(NULLIF(gradeLevel, ''), 'Unassigned')
        `)

        return res.json({
          totals: {
            students: Number(totals.students),

            teachers: Number(totals.teachers),

            subjects: Number(totals.subjects),

            sections: Number(totals.sections),

            enrollments: Number(totals.enrollments),
          },

          gradeDistribution: gradeRows.map((row) => ({
            gradeLevel: row.gradeLevel,

            count: Number(row.count),
          })),

          classes: [],
        })
      }

      const isTeacher = req.user.role === "teacher"

      const period = await getActiveAcademicPeriod(pool)

      const periodFilter = period
        ? `AND ${normalizedSchoolYearSql("ss.schoolYear")} = ? AND ss.semester = ?`
        : ""

      const periodParams = period ? [period.schoolYear, period.semester] : []

      const sectionsQuery = isTeacher
        ? `SELECT ss.id, ss.subjectName AS subject, ss.teacher,
                  COALESCE(c.room, '') AS room, COALESCE(c.schedule, '') AS schedule,
                  COALESCE(c.color, 'blue') AS color
           FROM subject_sections ss
           LEFT JOIN classes c ON c.code = ss.classSectionCode
           WHERE ss.status = 'active' AND ss.teacher IN (?, ?) ${periodFilter}
           ORDER BY ss.subjectName, ss.classSectionName`
        : `SELECT ss.id, ss.subjectName AS subject, ss.teacher,
                  COALESCE(c.room, '') AS room, COALESCE(c.schedule, '') AS schedule,
                  COALESCE(c.color, 'blue') AS color
           FROM subject_sections ss
           LEFT JOIN classes c ON c.code = ss.classSectionCode
           WHERE ss.status = 'active' ${periodFilter} AND EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.studentId = ?
               AND e.status = 'active'
               AND (e.subjectSectionId = ss.id OR
                 (e.subjectSectionId IS NULL AND e.subjectCode = ss.subjectCode AND e.teacher = ss.teacher))
           )
           ORDER BY ss.subjectName, ss.classSectionName`

      const [sections] = await pool.query(
        sectionsQuery,

        isTeacher
          ? [user.id, user.name, ...periodParams]
          : [...periodParams, user.id],
      )

      const [enrollmentRows] = await pool.query(
        isTeacher
          ? `SELECT COUNT(DISTINCT e.studentId) AS students
             FROM subject_sections ss
             JOIN enrollments e
               ON e.status = 'active' AND (e.subjectSectionId = ss.id OR
                  (e.subjectSectionId IS NULL AND e.subjectCode = ss.subjectCode AND e.teacher = ss.teacher))
             WHERE ss.status = 'active' AND ss.teacher IN (?, ?) ${periodFilter}`
          : `SELECT COUNT(DISTINCT e.subjectCode) AS subjects
             FROM enrollments e
             JOIN subject_sections ss ON
               e.subjectSectionId = ss.id OR
               (e.subjectSectionId IS NULL AND e.subjectCode = ss.subjectCode AND e.teacher = ss.teacher)
             WHERE e.studentId = ? AND e.status = 'active' AND ss.status = 'active' ${periodFilter}`,

        isTeacher
          ? [user.id, user.name, ...periodParams]
          : [user.id, ...periodParams],
      )

      return res.json({
        myClasses: sections.length,

        myStudents: isTeacher ? Number(enrollmentRows[0].students) : 0,

        mySubjects: isTeacher
          ? new Set(sections.map((section) => section.subject)).size
          : Number(enrollmentRows[0].subjects),

        gradeLevel: user.gradeLevel || "Unassigned",

        gradeDistribution: [],

        classes: sections,
      })
    }

    const state = await loadState()

    const user = state.users.find(
      (entry) => entry.id === req.user.id && entry.role === req.user.role,
    )

    if (!user) {
      return res
        .status(404)
        .json({ ok: false, message: "Dashboard user not found." })
    }

    if (req.user.role === "admin") {
      const students = state.users.filter((entry) => entry.role === "student")

      const gradeCounts = new Map()

      for (const student of students) {
        const gradeLevel = student.gradeLevel || "Unassigned"

        gradeCounts.set(gradeLevel, (gradeCounts.get(gradeLevel) || 0) + 1)
      }

      return res.json({
        totals: {
          students: students.length,

          teachers: state.users.filter((entry) => entry.role === "teacher")
            .length,

          subjects: state.subjects.length,

          sections: state.classSections.length,

          enrollments: state.enrollments.filter(
            (enrollment) => (enrollment.status || "active") === "active",
          ).length,
        },

        gradeDistribution: [...gradeCounts].map(([gradeLevel, count]) => ({
          gradeLevel,

          count,
        })),

        classes: [],
      })
    }

    const period = getActiveAcademicPeriodFromState(state)

    const assignedSections = state.subjectSections.filter(
      (section) =>
        (section.status || "active") === "active" &&
        (!period ||
          (normalizeSchoolYear(section.schoolYear) ===
            normalizeSchoolYear(period.schoolYear) &&
            section.semester === period.semester)) &&
        (req.user.role === "teacher"
          ? section.teacher === user.id || section.teacher === user.name
          : state.enrollments.some(
              (enrollment) =>
                enrollment.studentId === user.id &&
                enrollmentIsActiveForPeriod(enrollment, section, period) &&
                (enrollment.subjectSectionId === section.id ||
                  (!enrollment.subjectSectionId &&
                    enrollment.subjectCode === section.subjectCode &&
                    enrollment.teacher === section.teacher)),
            )),
    )

    const myStudents =
      req.user.role === "teacher"
        ? new Set(
            state.enrollments

              .filter(
                (enrollment) =>
                  (enrollment.status || "active") === "active" &&
                  assignedSections.some(
                    (section) =>
                      enrollment.subjectSectionId === section.id ||
                      (!enrollment.subjectSectionId &&
                        enrollment.subjectCode === section.subjectCode &&
                        enrollment.teacher === section.teacher),
                  ),
              )

              .map((enrollment) => enrollment.studentId),
          ).size
        : 0

    const mySubjects =
      req.user.role === "student"
        ? new Set(assignedSections.map((section) => section.subjectCode)).size
        : new Set(assignedSections.map((section) => section.subjectName)).size

    return res.json({
      myClasses: assignedSections.length,

      myStudents,

      mySubjects,

      gradeLevel: user.gradeLevel || "Unassigned",

      gradeDistribution: [],

      classes: assignedSections.map((section) => {
        const classRecord = state.classes.find(
          (item) => item.code === section.classSectionCode,
        )

        return {
          id: section.id,

          subject: section.subjectName,

          teacher: section.teacher,

          room: classRecord?.room || "",

          schedule: classRecord?.schedule || "",

          color: classRecord?.color || "blue",
        }
      }),
    })
  } catch (error) {
    console.error("Unable to load dashboard statistics:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load dashboard statistics.",
    })
  }
})

app.get("/api/activity-logs", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const [rows] = await pool.query(
        "SELECT id, message, userId, action, module, status, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 1000",
      )

      return res.json(rows)
    }

    const state = await loadState()

    return res.json(state.logs || [])
  } catch (error) {
    console.error("Unable to load activity logs:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load activity logs.",
    })
  }
})

app.post("/api/login", async (req, res) => {
  const { schoolId, password } = req.body || {}

  if (!schoolId || !password) {
    return res

      .status(400)

      .json({ ok: false, message: "School ID and password are required." })
  }

  const state = await loadState()

  const normalizedId = String(schoolId).trim().toUpperCase()

  const user = state.users.find((entry) => entry.id === normalizedId)

  if (!user) {
    return res

      .status(401)

      .json({ ok: false, message: "The school ID or password is incorrect." })
  }

  if (!(await verifyPassword(password, user.password))) {
    return res

      .status(401)

      .json({ ok: false, message: "The school ID or password is incorrect." })
  }

  if (!String(user.password).startsWith("scrypt$")) {
    const storedPassword = user.password

    const passwordHash = await hashPassword(password)

    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "UPDATE users SET password = ? WHERE id = ? AND password = ?",

        [passwordHash, user.id, storedPassword],
      )

      if (!result.affectedRows) {
        return res.status(401).json({
          ok: false,

          message: "The school ID or password is incorrect.",
        })
      }
    } else {
      user.password = passwordHash

      await saveState(state)
    }
  }

  const publicUser = {
    id: user.id,

    name: user.name,

    email: user.email,

    role: user.role,
  }

  for (const [token, session] of activeSessions) {
    if (session.userId === user.id) activeSessions.delete(token)
  }

  const token = crypto.randomBytes(32).toString("base64url")

  activeSessions.set(token, {
    userId: user.id,

    role: user.role,

    expiresAt: Date.now() + sessionLifetimeMs,
  })

  return res.json({ ok: true, user: publicUser, token })
})

app.post("/api/logout", (req, res) => {
  activeSessions.delete(req.authToken)

  return res.json({ ok: true, message: "Signed out successfully." })
})

app.get("/api/users", async (req, res) => {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ ok: false, message: "Administrator access is required." })
  }

  const state = await loadState()

  res.json(state.users.map(({ password, ...rest }) => rest))
})

app.get("/api/me", async (req, res) => {
  try {
    const pool = await ensureMysqlConnection()

    let user

    let classSections = []

    if (pool) {
      const [rows] = await pool.query(
        "SELECT id, name, email, role, gradeLevel, strand, `section`, subject FROM users WHERE id = ? AND role = ? LIMIT 1",

        [req.user.id, req.user.role],
      )

      user = rows[0]

      if (user?.role === "student") {
        const [sections] = await pool.query(
          "SELECT code, name, gradeLevel, strand FROM class_sections",
        )

        classSections = sections
      }
    } else {
      const state = await loadState()

      user = state.users.find(
        (entry) => entry.id === req.user.id && entry.role === req.user.role,
      )

      classSections = state.classSections
    }

    if (!user) {
      return res.status(404).json({ ok: false, message: "Account not found." })
    }

    return res.json({
      id: user.id,

      name: user.name,

      email: user.email,

      role: user.role,

      gradeLevel: user.gradeLevel || "",

      strand: user.strand || "",

      section:
        user.role === "student"
          ? getStudentSectionLetter(user, classSections)
          : user.section || "",

      subject: user.subject || "",
    })
  } catch (error) {
    console.error("Unable to load current account:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load the current account.",
    })
  }
})

app.get("/api/account/profile", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Only administrators can manage this profile.",
    })
  }

  try {
    const pool = await ensureMysqlConnection()

    let account

    if (pool) {
      const [rows] = await pool.query(
        "SELECT id, name, email, role FROM users WHERE id = ? AND role = 'admin' LIMIT 1",

        [req.user.id],
      )

      account = rows[0]
    } else {
      const state = await loadState()

      account = state.users.find(
        (user) => user.id === req.user.id && user.role === "admin",
      )
    }

    if (!account) {
      return res
        .status(404)
        .json({ ok: false, message: "Administrator account not found." })
    }

    return res.json({
      id: account.id,

      name: account.name,

      email: account.email,

      role: account.role,
    })
  } catch (error) {
    console.error("Unable to load administrator profile:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load administrator profile.",
    })
  }
})

app.patch("/api/account/profile", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Only administrators can manage this profile.",
    })
  }

  const id = String(req.body?.id || "")
    .trim()
    .toUpperCase()

  const name = String(req.body?.name || "").trim()

  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase()

  if (
    !/^[A-Z0-9_-]{1,64}$/.test(id) ||
    !name ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      ok: false,

      message:
        "A valid administrator ID, name, and email address are required.",
    })
  }

  try {
    const pool = await ensureMysqlConnection()

    const previousId = req.user.id

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [accounts] = await connection.query(
          "SELECT id FROM users WHERE id = ? AND role = 'admin' FOR UPDATE",

          [previousId],
        )

        if (!accounts.length) {
          await connection.rollback()

          return res.status(404).json({
            ok: false,

            message: "Administrator account not found.",
          })
        }

        const [duplicates] = await connection.query(
          "SELECT id FROM users WHERE (id = ? OR email = ?) AND id <> ? LIMIT 1",

          [id, email, previousId],
        )

        if (duplicates.length) {
          await connection.rollback()

          return res.status(409).json({
            ok: false,

            message:
              "That administrator ID or email address is already in use.",
          })
        }

        await connection.query(
          "UPDATE users SET id = ?, name = ?, email = ? WHERE id = ? AND role = 'admin'",

          [id, name, email, previousId],
        )

        if (id !== previousId) {
          await connection.query(
            "UPDATE lms_records SET ownerId = ? WHERE ownerId = ?",

            [id, previousId],
          )

          const [photoConflict] = await connection.query(
            "SELECT id FROM lms_records WHERE resource = 'profile-photos' AND id = ? LIMIT 1",

            [id],
          )

          if (photoConflict.length) {
            await connection.rollback()

            return res.status(409).json({
              ok: false,

              message:
                "A profile record already exists for that administrator ID.",
            })
          }

          await connection.query(
            "UPDATE lms_records SET id = ?, ownerId = ? WHERE resource = 'profile-photos' AND id = ?",

            [id, id, previousId],
          )
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        if (error.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            ok: false,

            message:
              "That administrator ID or email address is already in use.",
          })
        }

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const account = state.users.find(
        (user) => user.id === previousId && user.role === "admin",
      )

      if (!account) {
        return res.status(404).json({
          ok: false,

          message: "Administrator account not found.",
        })
      }

      if (
        state.users.some(
          (user) =>
            user.id !== previousId &&
            (user.id === id || user.email.toLowerCase() === email),
        )
      ) {
        return res.status(409).json({
          ok: false,

          message: "That administrator ID or email address is already in use.",
        })
      }

      account.id = id

      account.name = name

      account.email = email

      for (const record of state.records || []) {
        if (record.ownerId === previousId) record.ownerId = id

        if (record.resource === "profile-photos" && record.id === previousId) {
          record.id = id
        }
      }

      await saveState(state)
    }

    if (id !== previousId) {
      for (const session of activeSessions.values()) {
        if (session.userId === previousId) session.userId = id
      }
    }

    return res.json({
      ok: true,

      profile: { id, name, email, role: "admin" },
    })
  } catch (error) {
    console.error("Unable to update administrator profile:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to update administrator profile.",
    })
  }
})

app.post("/api/account/password", async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {}

  const current = String(currentPassword || "")

  const next = String(newPassword || "")

  if (!current || !next || !confirmPassword) {
    return res.status(400).json({
      ok: false,

      message: "Current password, new password, and confirmation are required.",
    })
  }

  if (next.length < 12) {
    return res.status(400).json({
      ok: false,

      message: "The new password must be at least 12 characters.",
    })
  }

  if (next !== String(confirmPassword)) {
    return res.status(400).json({
      ok: false,

      message: "The new password and confirmation do not match.",
    })
  }

  if (current === next) {
    return res.status(400).json({
      ok: false,

      message: "Choose a new password different from your current password.",
    })
  }

  try {
    const pool = await ensureMysqlConnection()

    let account

    if (pool) {
      const [rows] = await pool.query(
        "SELECT password FROM users WHERE id = ? LIMIT 1",

        [req.user.id],
      )

      account = rows[0]
    } else {
      const state = await loadState()

      account = state.users.find((user) => user.id === req.user.id)
    }

    if (!account || !(await verifyPassword(current, account.password))) {
      return res.status(401).json({
        ok: false,

        message: "The current password is incorrect.",
      })
    }

    const passwordHash = await hashPassword(next)

    if (pool) {
      await pool.query("UPDATE users SET password = ? WHERE id = ?", [
        passwordHash,

        req.user.id,
      ])
    } else {
      const state = await loadState()

      const user = state.users.find((entry) => entry.id === req.user.id)

      if (!user) {
        return res
          .status(404)
          .json({ ok: false, message: "Account not found." })
      }

      user.password = passwordHash

      await saveState(state)
    }

    for (const [token, session] of activeSessions) {
      if (session.userId === req.user.id && token !== req.authToken) {
        activeSessions.delete(token)
      }
    }

    return res.json({ ok: true, message: "Password updated successfully." })
  } catch (error) {
    console.error("Unable to update account password:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to update the account password.",
    })
  }
})

app.get("/api/students", async (_, res) => {
  const state = await loadState()

  res.json(
    state.users

      .filter((user) => user.role === "student")

      .map((user) => ({
        id: user.id,

        name: user.name,

        email: user.email,

        gradeLevel: user.gradeLevel || "",

        strand: user.strand || "",

        classSectionCode: user.classSectionCode || "",

        section: getStudentSectionLetter(user, state.classSections),

        status: user.status || "Active",
      })),
  )
})

app.get("/api/students/:id/subjects", async (req, res) => {
  const studentId = String(req.params.id)

  if (
    req.user.role !== "admin" &&
    !(req.user.role === "student" && req.user.id === studentId)
  ) {
    return res.status(403).json({
      ok: false,

      message: "You are not allowed to view this student's subjects.",
    })
  }

  try {
    const state = await loadState()

    const student = state.users.find(
      (user) => user.id === studentId && user.role === "student",
    )

    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." })
    }

    const pool = await ensureMysqlConnection()

    const period = await getActiveAcademicPeriod(pool, state)

    const includeHistory =
      req.user.role === "admin" && req.query.history === "true"

    const subjects = state.enrollments

      .filter((enrollment) => {
        if (enrollment.studentId !== studentId) return false

        if (includeHistory) return true

        const offering = state.subjectSections.find(
          (section) => section.id === enrollment.subjectSectionId,
        )

        return enrollmentIsActiveForPeriod(enrollment, offering, period)
      })

      .map((enrollment) => ({
        id: enrollment.id,

        subjectSectionId: enrollment.subjectSectionId,

        subjectCode: enrollment.subjectCode,

        subjectName: enrollment.subjectName,

        teacher: enrollment.teacher,

        description:
          state.subjects.find(
            (subject) => subject.code === enrollment.subjectCode,
          )?.description || "",

        units:
          state.subjects.find(
            (subject) => subject.code === enrollment.subjectCode,
          )?.units || 0,

        schoolYear: enrollment.schoolYear || "",

        semester: enrollment.semester || "",

        status: enrollment.status || "active",

        enrolledAt: enrollment.enrolledAt,
      }))

    return res.json(subjects)
  } catch (error) {
    console.error("Unable to load student subjects:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load the student's subjects.",
    })
  }
})

app.get("/api/students/:id/class-section", async (req, res) => {
  const studentId = String(req.params.id)

  if (
    req.user.role !== "admin" &&
    !(req.user.role === "student" && req.user.id === studentId)
  ) {
    return res.status(403).json({
      ok: false,

      message: "You are not allowed to view this student's class section.",
    })
  }

  try {
    const state = await loadState()

    const student = state.users.find(
      (user) => user.id === studentId && user.role === "student",
    )

    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." })
    }

    const classSection = state.classSections.find((section) =>
      studentMatchesClassSection(student, section),
    )

    if (!classSection) {
      return res.status(404).json({
        ok: false,

        message: "Student is not assigned to a class section.",
      })
    }

    return res.json({
      code: classSection.code,

      name: classSection.name,

      gradeLevel: classSection.gradeLevel || "",

      strand: classSection.strand || "",

      schoolYear: classSection.schoolYear || "",

      section: getClassSectionLetter(classSection),
    })
  } catch (error) {
    console.error("Unable to load student's class section:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load the student's class section.",
    })
  }
})

app.get("/api/teachers", async (_, res) => {
  const state = await loadState()

  res.json(
    state.users

      .filter((user) => user.role === "teacher")

      .map((user) => ({
        id: user.id,

        name: user.name,

        subject: user.subject || user.department || "",

        email: user.email,

        status: user.status || "Active",
      })),
  )
})

app.post("/api/teachers", async (req, res) => {
  const { name, subject, email, password, status } = req.body || {}

  const normalizedName = String(name || "").trim()

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase()

  const normalizedPassword = String(password || "")

  if (
    !normalizedName ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedPassword.length < 8
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        message:
          "Teacher name, a valid email address, and a password of at least 8 characters are required.",
      })
  }

  try {
    const teacher = await serializeStudentCreation(async () => {
      const passwordHash = await hashPassword(normalizedPassword)

      const pool = await ensureMysqlConnection()

      if (pool) {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()

          const [sequenceRows] = await connection.query(
            "SELECT `last_value` FROM student_id_sequence WHERE sequence_name = 'teachers' FOR UPDATE",
          )

          const [existingRows] = await connection.query(
            "SELECT MAX(CAST(id AS UNSIGNED)) AS maxId FROM users WHERE role = 'teacher' AND id REGEXP '^[0-9]+$'",
          )

          const lastValue = BigInt(sequenceRows[0].last_value.toString())

          const existingMax = BigInt(existingRows[0].maxId || "2026000")

          let nextId = (lastValue > existingMax ? lastValue : existingMax) + 1n

          let id = nextId.toString()

          while (true) {
            const [conflicts] = await connection.query(
              "SELECT id FROM users WHERE id = ? LIMIT 1",

              [id],
            )

            if (!conflicts.length) break

            nextId += 1n

            id = nextId.toString()
          }

          const record = {
            id,

            name: normalizedName,

            subject: String(subject || "").trim(),

            email: normalizedEmail,

            status: String(status || "Active").trim(),
          }

          await connection.query(
            "UPDATE student_id_sequence SET `last_value` = ? WHERE sequence_name = 'teachers'",

            [id],
          )

          await connection.query(
            "INSERT INTO users (id, name, role, email, password, subject, status) VALUES (?, ?, 'teacher', ?, ?, ?, ?)",

            [
              record.id,
              record.name,
              record.email,
              passwordHash,
              record.subject,
              record.status,
            ],
          )

          await connection.commit()

          return record
        } catch (error) {
          await connection.rollback()

          throw error
        } finally {
          connection.release()
        }
      }

      const state = await loadState()

      if (state.users.some((user) => user.email === normalizedEmail)) {
        throw Object.assign(
          new Error("An account with this email already exists."),
          {
            status: 409,
          },
        )
      }

      const existingMax = state.users

        .filter(
          (user) => user.role === "teacher" && /^\d+$/.test(String(user.id)),
        )

        .reduce((maximum, user) => {
          const value = BigInt(user.id)

          return value > maximum ? value : maximum
        }, 2026000n)

      let nextId = existingMax + 1n

      while (state.users.some((user) => user.id === nextId.toString())) {
        nextId += 1n
      }

      const record = {
        id: nextId.toString(),

        name: normalizedName,

        role: "teacher",

        subject: String(subject || "").trim(),

        email: normalizedEmail,

        password: passwordHash,

        status: String(status || "Active").trim(),
      }

      state.users.push(record)

      await saveState(state)

      const { password: _password, role: _role, ...teacherRecord } = record

      return teacherRecord
    })

    return res.status(201).json({ ok: true, teacher })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY" || error.status === 409) {
      return res.status(409).json({
        ok: false,

        message:
          error.message || "A teacher with this ID or email already exists.",
      })
    }

    console.error("Unable to create teacher:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to create the teacher account." })
  }
})

app.patch("/api/teachers/:id", async (req, res) => {
  const id = String(req.params.id)

  const { name, subject, email, status } = req.body || {}

  const normalizedName = String(name || "").trim()

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase()

  if (!normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res
      .status(400)
      .json({
        ok: false,
        message: "Teacher name and a valid email address are required.",
      })
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "UPDATE users SET name = ?, email = ?, subject = ?, status = ? WHERE id = ? AND role = 'teacher'",

        [
          normalizedName,
          normalizedEmail,
          String(subject || "").trim(),
          String(status || "Active").trim(),
          id,
        ],
      )

      if (!result.affectedRows) {
        const [rows] = await pool.query(
          "SELECT id FROM users WHERE id = ? AND role = 'teacher'",
          [id],
        )

        if (!rows.length)
          return res
            .status(404)
            .json({ ok: false, message: "Teacher not found." })
      }
    } else {
      const state = await loadState()

      const teacher = state.users.find(
        (user) => user.id === id && user.role === "teacher",
      )

      if (!teacher)
        return res
          .status(404)
          .json({ ok: false, message: "Teacher not found." })

      Object.assign(teacher, {
        name: normalizedName,
        email: normalizedEmail,
        subject: String(subject || "").trim(),
        status: String(status || "Active").trim(),
      })

      await saveState(state)
    }

    return res.json({
      ok: true,
      teacher: {
        id,
        name: normalizedName,
        email: normalizedEmail,
        subject: String(subject || "").trim(),
        status: String(status || "Active").trim(),
      },
    })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({
          ok: false,
          message: "An account with this email already exists.",
        })

    console.error("Unable to update teacher:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to update the teacher account." })
  }
})

app.post("/api/students", async (req, res) => {
  const { name, email, password, classSectionCode, status } = req.body || {}

  const normalizedName = String(name || "").trim()

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase()

  const normalizedPassword = String(password || "")

  const normalizedClassSectionCode = String(classSectionCode || "")

    .trim()

    .toUpperCase()

  if (
    !normalizedName ||
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedPassword.length < 8 ||
    !normalizedClassSectionCode
  ) {
    return res.status(400).json({
      ok: false,

      message: "Name, email, password, and a valid class section are required.",
    })
  }

  try {
    const state = await loadState()

    let classSection = state.classSections.find(
      (entry) =>
        String(entry.code || "")
          .trim()
          .toUpperCase() === normalizedClassSectionCode &&
        String(entry.status || "active").toLowerCase() === "active",
    )

    if (!classSection) {
      return res.status(400).json({
        ok: false,

        message: "Choose an existing active class section.",
      })
    }

    const creation = await serializeStudentCreation(async () => {
      const passwordHash = await hashPassword(normalizedPassword)

      const pool = await ensureMysqlConnection()

      if (pool) {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()

          const [lockedClassSections] = await connection.query(
            `SELECT code, name, gradeLevel, strand, schoolYear, status
             FROM class_sections
             WHERE code = ? AND LOWER(status) = 'active'
             FOR UPDATE`,

            [normalizedClassSectionCode],
          )

          if (!lockedClassSections.length) {
            await connection.rollback()

            return { error: "The selected class section is no longer active." }
          }

          const period = await getActiveAcademicPeriod(connection)

          if (!period) {
            await connection.rollback()

            return {
              error:
                "Set the current school year and semester in System Settings before adding students.",
            }
          }

          classSection = lockedClassSections[0]

          if (
            normalizeSchoolYear(classSection.schoolYear) !==
            normalizeSchoolYear(period.schoolYear)
          ) {
            await connection.rollback()

            return {
              error:
                "The selected class section is not part of the current school year.",
            }
          }

          const [sequenceRows] = await connection.query(
            "SELECT `last_value` FROM student_id_sequence WHERE sequence_name = 'students' FOR UPDATE",
          )

          const [duplicateRows] = await connection.query(
            "SELECT id FROM users WHERE role = 'student' AND LOWER(email) = ? LIMIT 1 FOR UPDATE",

            [normalizedEmail],
          )

          if (duplicateRows.length) {
            await connection.rollback()

            return {
              error: "A student account with this email already exists.",
            }
          }

          const [existingRows] = await connection.query(
            "SELECT MAX(CAST(id AS UNSIGNED)) AS maxId FROM users WHERE id REGEXP '^[0-9]+$'",
          )

          const lastValue = BigInt(sequenceRows[0].last_value.toString())

          const existingMax = BigInt(existingRows[0].maxId || "26000")

          const nextId =
            (lastValue > existingMax ? lastValue : existingMax) + 1n

          const id = nextId.toString()

          const record = {
            id,

            name: normalizedName,

            role: "student",

            email: normalizedEmail,

            password: passwordHash,

            gradeLevel: classSection.gradeLevel,

            strand: classSection.strand,

            section: getClassSectionLetter(classSection),

            classSectionCode: classSection.code,

            status: String(status || "Active").trim(),
          }

          await connection.query(
            "UPDATE student_id_sequence SET `last_value` = ? WHERE sequence_name = 'students'",

            [id],
          )

          await connection.query(
            "INSERT INTO users (id, name, role, email, password, gradeLevel, strand, `section`, classSectionCode, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",

            [
              record.id,

              record.name,

              record.role,

              record.email,

              record.password,

              record.gradeLevel,

              record.strand,

              record.section,

              record.classSectionCode,

              record.status,
            ],
          )

          const enrolledSubjects = await syncStudentEnrollmentsInMysql(
            connection,

            record,

            classSection.code,

            period,
          )

          await connection.commit()

          return { student: record, enrolledSubjects }
        } catch (error) {
          await connection.rollback()

          throw error
        } finally {
          connection.release()
        }
      }

      const state = await loadState()

      const period = getActiveAcademicPeriodFromState(state)

      if (!period) {
        return {
          error:
            "Set the current school year and semester in System Settings before adding students.",
        }
      }

      classSection = state.classSections.find(
        (entry) =>
          String(entry.code || "")
            .trim()
            .toUpperCase() === normalizedClassSectionCode &&
          String(entry.status || "active").toLowerCase() === "active",
      )

      if (!classSection) {
        return { error: "The selected class section is no longer active." }
      }

      if (
        normalizeSchoolYear(classSection.schoolYear) !==
        normalizeSchoolYear(period.schoolYear)
      ) {
        return {
          error:
            "The selected class section is not part of the current school year.",
        }
      }

      if (
        state.users.some(
          (user) =>
            user.role === "student" &&
            String(user.email || "")
              .trim()
              .toLowerCase() === normalizedEmail,
        )
      ) {
        return { error: "A student account with this email already exists." }
      }

      const id = (maxNumericUserId(state.users) + 1n).toString()

      const record = {
        id,

        name: normalizedName,

        role: "student",

        email: normalizedEmail,

        password: passwordHash,

        gradeLevel: classSection.gradeLevel,

        strand: classSection.strand,

        section: getClassSectionLetter(classSection),

        classSectionCode: classSection.code,

        status: String(status || "Active").trim(),
      }

      state.users.push(record)

      const enrolledSubjects = syncStudentEnrollmentsInState(
        state,

        record,

        classSection.code,

        period,
      )

      await saveState(state)

      return { student: record, enrolledSubjects }
    })

    if (creation.error) {
      const status = creation.error.includes("section") ? 400 : 409

      return res.status(status).json({ ok: false, message: creation.error })
    }

    const { student, enrolledSubjects } = creation

    return res.status(201).json({
      ok: true,

      student: {
        id: student.id,

        name: student.name,

        email: student.email,

        gradeLevel: student.gradeLevel,

        strand: student.strand,

        section: student.section,

        classSectionCode: student.classSectionCode,

        status: student.status,

        enrolledSubjects,
      },
    })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,

        message: "A student with this ID or email already exists.",
      })
    }

    console.error("Unable to create student:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to create the student account.",
    })
  }
})

app.patch("/api/students/:id", async (req, res) => {
  const id = String(req.params.id)

  const { name, email, classSectionCode, status } = req.body || {}

  const normalizedName = String(name || "").trim()

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase()

  const normalizedClassSectionCode = String(classSectionCode || "")

    .trim()

    .toUpperCase()

  if (
    !normalizedName ||
    !normalizedEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    !normalizedClassSectionCode
  ) {
    return res.status(400).json({
      ok: false,

      message: "Name, email, and a valid class section are required.",
    })
  }

  try {
    const state = await loadState()

    let classSection = state.classSections.find(
      (entry) =>
        String(entry.code || "")
          .trim()
          .toUpperCase() === normalizedClassSectionCode &&
        String(entry.status || "active").toLowerCase() === "active",
    )

    if (!classSection) {
      return res.status(400).json({
        ok: false,

        message: "Choose an existing active class section.",
      })
    }

    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [students] = await connection.query(
          "SELECT id, name, gradeLevel, strand, `section`, classSectionCode, status FROM users WHERE id = ? AND role = 'student' FOR UPDATE",

          [id],
        )

        const existingStudent = students[0]

        if (!existingStudent) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Student not found." })
        }

        const [lockedClassSections] = await connection.query(
          `SELECT code, name, gradeLevel, strand, schoolYear, status
           FROM class_sections
           WHERE code = ? AND LOWER(status) = 'active'
           FOR UPDATE`,

          [normalizedClassSectionCode],
        )

        if (!lockedClassSections.length) {
          await connection.rollback()

          return res
            .status(400)
            .json({
              ok: false,
              message: "The selected class section is no longer active.",
            })
        }

        classSection = lockedClassSections[0]

        const period = await getActiveAcademicPeriod(connection)

        if (!period) {
          await connection.rollback()

          return res.status(409).json({
            ok: false,

            message:
              "Set the current school year and semester in System Settings before saving a student's section.",
          })
        }

        if (
          normalizeSchoolYear(classSection.schoolYear) !==
          normalizeSchoolYear(period.schoolYear)
        ) {
          await connection.rollback()

          return res.status(400).json({
            ok: false,

            message:
              "The selected class section is not part of the current school year.",
          })
        }

        const [duplicateRows] = await connection.query(
          "SELECT id FROM users WHERE role = 'student' AND LOWER(email) = ? AND id <> ? LIMIT 1 FOR UPDATE",

          [normalizedEmail, id],
        )

        if (duplicateRows.length) {
          await connection.rollback()

          return res.status(409).json({
            ok: false,

            message: "A student account with this email already exists.",
          })
        }

        const previousClassSection = state.classSections.find((entry) =>
          studentMatchesClassSection(existingStudent, entry),
        )

        const sectionChanged =
          !previousClassSection ||
          previousClassSection.code !== classSection.code

        let enrolledSubjects = []

        if (sectionChanged) {
          if (previousClassSection) {
            await deactivateSectionEnrollmentsInMysql(
              connection,

              id,

              previousClassSection.code,

              period,
            )
          }

          enrolledSubjects = await syncStudentEnrollmentsInMysql(
            connection,

            { ...existingStudent, name: normalizedName },

            classSection.code,

            period,
          )
        }

        await connection.query(
          "UPDATE users SET name = ?, email = ?, gradeLevel = ?, strand = ?, `section` = ?, classSectionCode = ?, status = ? WHERE id = ? AND role = 'student'",

          [
            normalizedName,

            normalizedEmail,

            classSection.gradeLevel,

            classSection.strand,

            getClassSectionLetter(classSection),

            classSection.code,

            String(status || "Active").trim(),

            id,
          ],
        )

        await connection.commit()

        const [rows] = await pool.query(
          "SELECT id, name, email, gradeLevel, strand, `section` AS section, status FROM users WHERE id = ? AND role = 'student'",

          [id],
        )

        return res.json({
          ok: true,

          student: {
            ...rows[0],

            classSectionCode: classSection.code,

            enrolledSubjects,

            enrollmentChanged: sectionChanged,
          },
        })
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    }

    const student = state.users.find(
      (user) => user.id === id && user.role === "student",
    )

    if (!student) {
      return res.status(404).json({ ok: false, message: "Student not found." })
    }

    classSection = state.classSections.find(
      (entry) =>
        String(entry.code || "")
          .trim()
          .toUpperCase() === normalizedClassSectionCode &&
        String(entry.status || "active").toLowerCase() === "active",
    )

    if (!classSection) {
      return res.status(400).json({
        ok: false,

        message: "The selected class section is no longer active.",
      })
    }

    const period = getActiveAcademicPeriodFromState(state)

    if (!period) {
      return res.status(409).json({
        ok: false,

        message:
          "Set the current school year and semester in System Settings before saving a student's section.",
      })
    }

    if (
      normalizeSchoolYear(classSection.schoolYear) !==
      normalizeSchoolYear(period.schoolYear)
    ) {
      return res.status(400).json({
        ok: false,

        message:
          "The selected class section is not part of the current school year.",
      })
    }

    if (
      state.users.some(
        (user) =>
          user.role === "student" &&
          user.id !== id &&
          String(user.email || "")
            .trim()
            .toLowerCase() === normalizedEmail,
      )
    ) {
      return res.status(409).json({
        ok: false,

        message: "A student account with this email already exists.",
      })
    }

    const previousClassSection = state.classSections.find((entry) =>
      studentMatchesClassSection(student, entry),
    )

    const sectionChanged =
      !previousClassSection || previousClassSection.code !== classSection.code

    let enrolledSubjects = []

    if (sectionChanged) {
      if (previousClassSection) {
        deactivateSectionEnrollmentsInState(
          state,

          id,

          previousClassSection.code,

          period,
        )
      }

      enrolledSubjects = syncStudentEnrollmentsInState(
        state,

        { ...student, name: normalizedName },

        classSection.code,

        period,
      )
    }

    Object.assign(student, {
      name: normalizedName,

      email: normalizedEmail,

      gradeLevel: classSection.gradeLevel,

      strand: classSection.strand,

      section: getClassSectionLetter(classSection),

      classSectionCode: classSection.code,

      status: String(status || "Active").trim(),
    })

    await saveState(state)

    const { password: _, ...publicStudent } = student

    return res.json({
      ok: true,

      student: {
        ...publicStudent,
        enrolledSubjects,
        enrollmentChanged: sectionChanged,
      },
    })
  } catch (error) {
    console.error("Unable to update student:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to update the student record.",
    })
  }
})

app.post("/api/classes", async (req, res) => {
  const {
    code,
    subject,
    teacher,
    room,
    schedule,
    color,
    gradeLevel,
    strand,
    schoolYear,
  } = req.body || {}

  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase()

  const normalizedSubject = String(subject || "").trim()

  if (!normalizedCode || !normalizedSubject) {
    return res.status(400).json({
      ok: false,

      message: "Class section name and code are required.",
    })
  }

  const record = {
    code: normalizedCode,

    subject: normalizedSubject,

    teacher: String(teacher || "").trim(),

    room: String(room || "").trim(),

    schedule: String(schedule || "").trim(),

    color: String(color || "emerald").trim(),

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        await connection.query(
          "INSERT INTO classes (code, subject, teacher, room, schedule, color, gradeLevel, strand, schoolYear) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",

          [
            record.code,

            record.subject,

            record.teacher,

            record.room,

            record.schedule,

            record.color,

            record.gradeLevel,

            record.strand,

            record.schoolYear,
          ],
        )

        await connection.query(
          "INSERT INTO class_sections (code, name, gradeLevel, strand, schoolYear, adviser, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",

          [
            record.code,

            record.subject,

            record.gradeLevel,

            record.strand,

            record.schoolYear,

            record.teacher,
          ],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      if (state.classes.some((item) => item.code === record.code)) {
        return res.status(409).json({
          ok: false,

          message: "A class section with this code already exists.",
        })
      }

      state.classes.push(record)

      state.classSections.push({
        code: record.code,

        name: record.subject,

        gradeLevel: record.gradeLevel,

        strand: record.strand,

        schoolYear: record.schoolYear,

        adviser: record.teacher,

        status: "active",
      })

      await saveState(state)
    }

    return res.status(201).json({ ok: true, classSection: record })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,

        message: "A class section with this code already exists.",
      })
    }

    console.error("Unable to create class section:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to create the class section.",
    })
  }
})

app.patch("/api/classes/:code", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase()

  const {
    subject,
    teacher,
    room,
    schedule,
    color,
    gradeLevel,
    strand,
    schoolYear,
  } = req.body || {}

  const normalizedSubject = String(subject || "").trim()

  if (!normalizedSubject) {
    return res.status(400).json({
      ok: false,

      message: "Class section name is required.",
    })
  }

  const record = {
    code,

    subject: normalizedSubject,

    teacher: String(teacher || "").trim(),

    room: String(room || "").trim(),

    schedule: String(schedule || "").trim(),

    color: String(color || "emerald").trim(),

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [result] = await connection.query(
          "UPDATE classes SET subject = ?, teacher = ?, room = ?, schedule = ?, color = ?, gradeLevel = ?, strand = ?, schoolYear = ? WHERE code = ?",

          [
            record.subject,

            record.teacher,

            record.room,

            record.schedule,

            record.color,

            record.gradeLevel,

            record.strand,

            record.schoolYear,

            code,
          ],
        )

        if (!result.affectedRows) {
          const [rows] = await connection.query(
            "SELECT code FROM classes WHERE code = ?",

            [code],
          )

          if (!rows.length) {
            await connection.rollback()

            return res.status(404).json({
              ok: false,

              message: "Class section not found.",
            })
          }
        }

        await connection.query(
          `INSERT INTO class_sections
               (code, name, gradeLevel, strand, schoolYear, adviser, status)
               VALUES (?, ?, ?, ?, ?, ?, 'active')
               ON DUPLICATE KEY UPDATE name = VALUES(name),
                 gradeLevel = VALUES(gradeLevel), strand = VALUES(strand),
                 schoolYear = VALUES(schoolYear), adviser = VALUES(adviser),
                 status = 'active'`,

          [
            record.code,

            record.subject,

            record.gradeLevel,

            record.strand,

            record.schoolYear,

            record.teacher,
          ],
        )

        await connection.query(
          "UPDATE subject_sections SET classSectionName = ? WHERE classSectionCode = ?",

          [record.subject, code],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const index = state.classes.findIndex((item) => item.code === code)

      if (index < 0) {
        return res.status(404).json({
          ok: false,

          message: "Class section not found.",
        })
      }

      state.classes[index] = record

      const sectionIndex = state.classSections.findIndex(
        (item) => item.code === code,
      )

      const classSection = {
        code: record.code,

        name: record.subject,

        gradeLevel: record.gradeLevel,

        strand: record.strand,

        schoolYear: record.schoolYear,

        adviser: record.teacher,

        status: "active",
      }

      if (sectionIndex < 0) state.classSections.push(classSection)
      else state.classSections[sectionIndex] = classSection

      await saveState(state)
    }

    return res.json({ ok: true, classSection: record })
  } catch (error) {
    console.error("Unable to update class section:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to update the class section.",
    })
  }
})

app.delete("/api/admin/records/:kind/:id", async (req, res) => {
  const kind = String(req.params.kind)

  const id = String(req.params.id)

  const { password } = req.body || {}

  if (!password) {
    return res.status(400).json({
      ok: false,

      message: "Administrator password is required.",
    })
  }

  if (!["students", "teachers", "subjects", "classes"].includes(kind)) {
    return res
      .status(400)
      .json({ ok: false, message: "Unsupported record type." })
  }

  try {
    const pool = await ensureMysqlConnection()

    let admin

    if (pool) {
      const [admins] = await pool.query(
        "SELECT id, password FROM users WHERE id = ? AND role = 'admin' LIMIT 1",

        [req.user.id],
      )

      admin = admins[0]
    } else {
      const state = await loadState()

      admin = state.users.find(
        (user) => user.id === req.user.id && user.role === "admin",
      )
    }

    if (!admin || !(await verifyPassword(password, admin.password))) {
      return res.status(401).json({
        ok: false,

        message: "Administrator password is incorrect.",
      })
    }

    if (pool) {
      if (kind === "students" || kind === "teachers") {
        const role = kind === "students" ? "student" : "teacher"

        if (role === "teacher") {
          const [teacherRows] = await pool.query(
            "SELECT name FROM users WHERE id = ? AND role = 'teacher'",

            [id],
          )

          if (!teacherRows.length) {
            return res
              .status(404)
              .json({ ok: false, message: "Teacher not found." })
          }

          const [assignments] = await pool.query(
            "SELECT (SELECT COUNT(*) FROM subject_sections WHERE teacher = ?) + (SELECT COUNT(*) FROM classes WHERE teacher = ?) AS count",

            [teacherRows[0].name, teacherRows[0].name],
          )

          if (Number(assignments[0].count) > 0) {
            return res.status(409).json({
              ok: false,

              message:
                "Reassign this teacher's class and subject sections before deleting the account.",
            })
          }
        }

        const [result] = await pool.query(
          "DELETE FROM users WHERE id = ? AND role = ?",

          [id, role],
        )

        if (!result.affectedRows) {
          return res.status(404).json({
            ok: false,

            message: `${role === "student" ? "Student" : "Teacher"} not found.`,
          })
        }
      } else if (kind === "subjects") {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()

          const [subjectRows] = await connection.query(
            "SELECT name FROM subjects WHERE code = ? FOR UPDATE",

            [id],
          )

          if (!subjectRows.length) {
            await connection.rollback()

            return res.status(404).json({
              ok: false,

              message: "Subject not found.",
            })
          }

          const [references] = await connection.query(
            "SELECT (SELECT COUNT(*) FROM subject_sections WHERE subjectCode = ?) + (SELECT COUNT(*) FROM enrollments WHERE subjectCode = ?) + (SELECT COUNT(*) FROM classes WHERE subject = ?) AS count",

            [id, id, subjectRows[0].name],
          )

          if (Number(references[0].count) > 0) {
            await connection.rollback()

            return res.status(409).json({
              ok: false,

              message:
                "Remove or reassign this subject's sections and enrollments before deleting it.",
            })
          }

          await connection.query("DELETE FROM subjects WHERE code = ?", [id])

          await connection.commit()
        } catch (error) {
          await connection.rollback()

          throw error
        } finally {
          connection.release()
        }
      } else {
        const [classRows] = await pool.query(
          "SELECT code FROM classes WHERE code = ?",

          [id],
        )

        const [references] = await pool.query(
          "SELECT COUNT(*) AS count FROM subject_sections WHERE classSectionCode = ?",

          [id],
        )

        if (!classRows.length) {
          return res.status(404).json({
            ok: false,

            message: "Class section not found.",
          })
        }

        if (Number(references[0].count) > 0) {
          return res.status(409).json({
            ok: false,

            message:
              "Remove or reassign this class section's subject offerings before deleting it.",
          })
        }

        await pool.query("DELETE FROM classes WHERE code = ?", [id])

        await pool.query("DELETE FROM class_sections WHERE code = ?", [id])
      }
    } else {
      const state = await loadState()

      if (kind === "students" || kind === "teachers") {
        const role = kind === "students" ? "student" : "teacher"

        const user = state.users.find(
          (entry) => entry.id === id && entry.role === role,
        )

        if (!user) {
          return res.status(404).json({
            ok: false,

            message: `${role === "student" ? "Student" : "Teacher"} not found.`,
          })
        }

        if (
          role === "teacher" &&
          (state.subjectSections.some(
            (section) => section.teacher === user.name,
          ) ||
            state.classes.some((classItem) => classItem.teacher === user.name))
        ) {
          return res.status(409).json({
            ok: false,

            message:
              "Reassign this teacher's class and subject sections before deleting the account.",
          })
        }

        state.users = state.users.filter((entry) => entry.id !== id)
      } else if (kind === "subjects") {
        const subject = state.subjects.find((entry) => entry.code === id)

        if (!subject) {
          return res
            .status(404)
            .json({ ok: false, message: "Subject not found." })
        }

        if (
          state.subjectSections.some((section) => section.subjectCode === id) ||
          state.enrollments.some((record) => record.subjectCode === id) ||
          state.classes.some((classItem) => classItem.subject === subject.name)
        ) {
          return res.status(409).json({
            ok: false,

            message:
              "Remove or reassign this subject's sections and enrollments before deleting it.",
          })
        }

        state.subjects = state.subjects.filter((entry) => entry.code !== id)
      } else {
        if (!state.classes.some((item) => item.code === id)) {
          return res.status(404).json({
            ok: false,

            message: "Class section not found.",
          })
        }

        if (
          state.subjectSections.some(
            (section) => section.classSectionCode === id,
          )
        ) {
          return res.status(409).json({
            ok: false,

            message:
              "Remove or reassign this class section's subject offerings before deleting it.",
          })
        }

        state.classes = state.classes.filter((item) => item.code !== id)

        state.classSections = state.classSections.filter(
          (item) => item.code !== id,
        )
      }

      await saveState(state)
    }

    return res.json({ ok: true, deleted: { kind, id } })
  } catch (error) {
    console.error(`Unable to delete ${kind} record:`, error)

    return res.status(500).json({
      ok: false,

      message: "Unable to delete the selected record.",
    })
  }
})

app.get("/api/subjects", async (_, res) => {
  const state = await loadState()

  res.json(state.subjects)
})

app.post("/api/subjects", async (req, res) => {
  const {
    code,
    name,
    description,
    units,
    gradeLevel,
    strand,
    schoolYear,
    semester,
  } = req.body || {}

  const normalizedUnits = Number(units || 0)

  const subject = {
    code: String(code || "")
      .trim()
      .toUpperCase(),

    name: String(name || "").trim(),

    description: String(description || "").trim(),

    units: normalizedUnits,

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    semester: String(semester || "").trim(),
  }

  if (
    !subject.code ||
    !subject.name ||
    !Number.isFinite(normalizedUnits) ||
    normalizedUnits < 0
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        message:
          "Subject code, name, and a valid non-negative unit value are required.",
      })
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      await pool.query(
        "INSERT INTO subjects (code, name, description, units, gradeLevel, strand, schoolYear, semester) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",

        [
          subject.code,
          subject.name,
          subject.description,
          subject.units,
          subject.gradeLevel,
          subject.strand,
          subject.schoolYear,
          subject.semester,
        ],
      )
    } else {
      const state = await loadState()

      if (state.subjects.some((item) => item.code === subject.code)) {
        return res
          .status(409)
          .json({
            ok: false,
            message: "A subject with this code already exists.",
          })
      }

      state.subjects.push(subject)

      await saveState(state)
    }

    return res.status(201).json({ ok: true, subject })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({
          ok: false,
          message: "A subject with this code already exists.",
        })

    console.error("Unable to create subject:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to create the subject." })
  }
})

app.patch("/api/subjects/:code", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase()

  const { name, description, units, gradeLevel, strand, schoolYear, semester } =
    req.body || {}

  const normalizedUnits = Number(units || 0)

  const subject = {
    code,

    name: String(name || "").trim(),

    description: String(description || "").trim(),

    units: normalizedUnits,

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    semester: String(semester || "").trim(),
  }

  if (
    !subject.name ||
    !Number.isFinite(normalizedUnits) ||
    normalizedUnits < 0
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        message:
          "Subject name and a valid non-negative unit value are required.",
      })
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "UPDATE subjects SET name = ?, description = ?, units = ?, gradeLevel = ?, strand = ?, schoolYear = ?, semester = ? WHERE code = ?",

        [
          subject.name,
          subject.description,
          subject.units,
          subject.gradeLevel,
          subject.strand,
          subject.schoolYear,
          subject.semester,
          code,
        ],
      )

      if (!result.affectedRows) {
        const [rows] = await pool.query(
          "SELECT code FROM subjects WHERE code = ?",
          [code],
        )

        if (!rows.length)
          return res
            .status(404)
            .json({ ok: false, message: "Subject not found." })
      }

      await pool.query(
        "UPDATE subject_sections SET subjectName = ? WHERE subjectCode = ?",

        [subject.name, code],
      )
    } else {
      const state = await loadState()

      const index = state.subjects.findIndex((item) => item.code === code)

      if (index < 0)
        return res
          .status(404)
          .json({ ok: false, message: "Subject not found." })

      state.subjects[index] = subject

      for (const section of state.subjectSections) {
        if (section.subjectCode === code) section.subjectName = subject.name
      }

      await saveState(state)
    }

    return res.json({ ok: true, subject })
  } catch (error) {
    console.error("Unable to update subject:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to update the subject." })
  }
})

app.get("/api/class-sections", async (_, res) => {
  const state = await loadState()

  res.json(state.classSections || [])
})

app.get("/api/class-sections/available", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  try {
    const state = await loadState()

    const pool = await ensureMysqlConnection()

    const period = await getActiveAcademicPeriod(pool, state)

    if (!period) {
      return res.status(409).json({
        ok: false,

        message:
          "Set the current school year and semester in System Settings before assigning students to sections.",
      })
    }

    const sections = pool
      ? (
          await pool.query(
            `SELECT code, name, gradeLevel, strand, schoolYear, status
             FROM class_sections
             WHERE LOWER(status) = 'active'
             ORDER BY gradeLevel, strand, name, code`,
          )
        )[0]
      : state.classSections.filter(
          (section) =>
            String(section.status || "active").toLowerCase() === "active",
        )

    const matchingSections = sections.filter(
      (section) =>
        normalizeSchoolYear(section.schoolYear) ===
        normalizeSchoolYear(period.schoolYear),
    )

    return res.json({
      period,

      sections: matchingSections.map((section) => ({
        id: section.code,

        code: section.code,

        name: section.name,

        gradeLevel: section.gradeLevel,

        strand: section.strand,

        section: getClassSectionLetter(section),

        schoolYear: section.schoolYear,

        semester: period.semester,

        status: section.status || "active",
      })),
    })
  } catch (error) {
    console.error("Unable to load available class sections:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load available class sections.",
    })
  }
})

app.get("/api/class-sections/:code/students", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  const code = String(req.params.code).trim().toUpperCase()

  const state = await loadState()

  const classSection = state.classSections.find(
    (section) => section.code === code,
  )

  if (!classSection) {
    return res
      .status(404)
      .json({ ok: false, message: "Class section not found." })
  }

  return res.json(
    state.users

      .filter(
        (user) =>
          user.role === "student" &&
          user.status === "Active" &&
          studentMatchesClassSection(user, classSection),
      )

      .map((student) => ({
        id: student.id,

        name: student.name,

        gradeLevel: student.gradeLevel || "",

        strand: student.strand || "",

        section: getStudentSectionLetter(student, state.classSections),
      })),
  )
})

app.get("/api/classes", async (_, res) => {
  const state = await loadState()

  res.json(state.classes)
})

app.get("/api/subject-sections", async (req, res) => {
  const state = await loadState()

  const sections = addEnrollmentRostersToSections(state)

  if (req.user.role === "admin") return res.json(sections)

  const user = state.users.find((entry) => entry.id === req.user.id)

  if (!user)
    return res.status(401).json({ ok: false, message: "User not found." })

  const pool = await ensureMysqlConnection()

  const period = await getActiveAcademicPeriod(pool, state)

  const visibleSections = sections.filter(
    (section) =>
      (section.status || "active") === "active" &&
      (!period ||
        (normalizeSchoolYear(section.schoolYear) ===
          normalizeSchoolYear(period.schoolYear) &&
          section.semester === period.semester)),
  )

  if (req.user.role === "teacher") {
    return res.json(
      visibleSections.filter(
        (section) =>
          section.teacher === user.id || section.teacher === user.name,
      ),
    )
  }

  if (req.query.catalog === "true") {
    const enrolledIds = new Set(
      state.enrollments

        .filter(
          (enrollment) =>
            enrollment.studentId === user.id &&
            enrollmentIsActiveForPeriod(
              enrollment,

              state.subjectSections.find(
                (section) => section.id === enrollment.subjectSectionId,
              ),

              period,
            ),
        )

        .map((enrollment) => enrollment.subjectSectionId),
    )

    return res.json(
      visibleSections

        .filter((section) => {
          const classSection = state.classSections.find(
            (item) => item.code === section.classSectionCode,
          )

          return studentMatchesClassSection(user, classSection)
        })

        .map((section) => {
          const classSection = state.classSections.find(
            (item) => item.code === section.classSectionCode,
          )

          const classRecord = state.classes.find(
            (item) => item.code === section.classSectionCode,
          )

          return {
            ...section,

            classSectionName: classSection?.name || section.classSectionName,

            isEnrolled:
              enrolledIds.has(section.id) ||
              section.enrolledStudents.includes(user.id),

            room: classRecord?.room || "",

            schedule: classRecord?.schedule || "",

            color: classRecord?.color || "emerald",
          }
        }),
    )
  }

  const enrolledSectionIds = new Set(
    state.enrollments

      .filter(
        (enrollment) =>
          enrollment.studentId === user.id &&
          enrollmentIsActiveForPeriod(
            enrollment,

            state.subjectSections.find(
              (section) => section.id === enrollment.subjectSectionId,
            ),

            period,
          ),
      )

      .map((enrollment) => enrollment.subjectSectionId),
  )

  return res.json(
    visibleSections.filter((section) => enrolledSectionIds.has(section.id)),
  )
})

app.get("/api/enrollments", async (req, res) => {
  const state = await loadState()

  if (req.user.role === "admin") return res.json(state.enrollments)

  const pool = await ensureMysqlConnection()

  const period = await getActiveAcademicPeriod(pool, state)

  const activeEnrollments = state.enrollments.filter(
    (enrollment) =>
      enrollmentIsActiveForPeriod(
        enrollment,

        state.subjectSections.find(
          (section) => section.id === enrollment.subjectSectionId,
        ),

        period,
      ),
  )

  if (req.user.role === "student") {
    return res.json(
      activeEnrollments.filter(
        (enrollment) => enrollment.studentId === req.user.id,
      ),
    )
  }

  const user = state.users.find((entry) => entry.id === req.user.id)

  const assignedSectionIds = new Set(
    state.subjectSections

      .filter(
        (section) =>
          section.teacher === req.user.id || section.teacher === user?.name,
      )

      .map((section) => section.id),
  )

  return res.json(
    activeEnrollments.filter((enrollment) =>
      assignedSectionIds.has(enrollment.subjectSectionId),
    ),
  )
})

app.post("/api/section-subjects", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Administrator access is required.",
    })
  }

  const {
    classSectionCode,

    schoolYear,

    semester,

    assignments,

    removeSubjectCodes = [],

    confirmRemoval = false,
  } = req.body || {}

  const code = String(classSectionCode || "").trim()

  const year = normalizeSchoolYear(schoolYear)

  const term = String(semester || "").trim()

  if (
    !code ||
    !year ||
    !term ||
    !Array.isArray(assignments) ||
    !Array.isArray(removeSubjectCodes) ||
    (!assignments.length && !removeSubjectCodes.length)
  ) {
    return res.status(400).json({
      ok: false,

      message:
        "Section, school year, semester, and at least one subject assignment are required.",
    })
  }

  const normalizedAssignments = assignments.map((assignment) => ({
    subjectCode: String(assignment?.subjectCode || "")
      .trim()
      .toUpperCase(),

    teacher: String(assignment?.teacher || "").trim(),
  }))

  const normalizedRemovals = [
    ...new Set(
      removeSubjectCodes
        .map((subjectCode) =>
          String(subjectCode || "")
            .trim()
            .toUpperCase(),
        )
        .filter(Boolean),
    ),
  ]

  if (
    normalizedAssignments.some(
      (assignment) => !assignment.subjectCode || !assignment.teacher,
    ) ||
    new Set(normalizedAssignments.map((assignment) => assignment.subjectCode))
      .size !== normalizedAssignments.length ||
    normalizedAssignments.some((assignment) =>
      normalizedRemovals.includes(assignment.subjectCode),
    )
  ) {
    return res.status(400).json({
      ok: false,

      message: "Choose one valid teacher for each unique subject.",
    })
  }

  if (normalizedRemovals.length && confirmRemoval !== true) {
    return res.status(400).json({
      ok: false,

      message: "Confirm removal of assigned subjects before saving.",
    })
  }

  try {
    const pool = await ensureMysqlConnection()

    const savedAssignments = []

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [classSections] = await connection.query(
          "SELECT code, name FROM class_sections WHERE code = ? LIMIT 1 FOR UPDATE",

          [code],
        )

        if (!classSections.length) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Class section not found." })
        }

        for (const assignment of normalizedAssignments) {
          const [subjects] = await connection.query(
            "SELECT code, name FROM subjects WHERE code = ? LIMIT 1",

            [assignment.subjectCode],
          )

          const [teachers] = await connection.query(
            "SELECT id, name FROM users WHERE role = 'teacher' AND (id = ? OR name = ?) LIMIT 1",

            [assignment.teacher, assignment.teacher],
          )

          if (!subjects.length || !teachers.length) {
            await connection.rollback()

            return res.status(400).json({
              ok: false,

              message:
                "Each assignment must use an existing subject and teacher.",
            })
          }

          const [existing] = await connection.query(
            `SELECT id, status FROM subject_sections
             WHERE subjectCode = ? AND classSectionCode = ?
               AND ${normalizedSchoolYearSql("schoolYear")} = ? AND semester = ?
             ORDER BY (status = 'active') DESC LIMIT 1 FOR UPDATE`,

            [assignment.subjectCode, code, year, term],
          )

          const offering = {
            id: existing[0]?.id || `SUBSEC-${crypto.randomUUID()}`,

            subjectCode: subjects[0].code,

            subjectName: subjects[0].name,

            classSectionCode: code,

            classSectionName: classSections[0].name,

            teacher: teachers[0].name,

            schoolYear: year,

            semester: term,
          }

          if (existing.length) {
            await connection.query(
              `UPDATE subject_sections
               SET subjectName = ?, classSectionName = ?, teacher = ?, status = 'active'
               WHERE id = ?`,

              [
                offering.subjectName,
                offering.classSectionName,
                offering.teacher,
                offering.id,
              ],
            )
          } else {
            await connection.query(
              `INSERT INTO subject_sections
               (id, subjectCode, subjectName, classSectionCode, classSectionName,
                teacher, schoolYear, semester, enrolledStudents, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,

              [
                offering.id,

                offering.subjectCode,

                offering.subjectName,

                offering.classSectionCode,

                offering.classSectionName,

                offering.teacher,

                year,

                term,

                JSON.stringify([]),
              ],
            )
          }

          savedAssignments.push(offering)
        }

        for (const subjectCode of normalizedRemovals) {
          const [offerings] = await connection.query(
            `SELECT id, enrolledStudents FROM subject_sections
             WHERE subjectCode = ? AND classSectionCode = ?
               AND ${normalizedSchoolYearSql("schoolYear")} = ? AND semester = ?
               AND status = 'active' FOR UPDATE`,

            [subjectCode, code, year, term],
          )

          for (const offering of offerings) {
            await connection.query(
              "UPDATE subject_sections SET status = 'inactive', enrolledStudents = ? WHERE id = ?",

              [JSON.stringify([]), offering.id],
            )

            await connection.query(
              "UPDATE enrollments SET status = 'inactive' WHERE subjectSectionId = ? AND status = 'active'",

              [offering.id],
            )
          }
        }

        const period = await getActiveAcademicPeriod(connection)

        if (
          normalizeSchoolYear(period?.schoolYear) === year &&
          period?.semester === term
        ) {
          const [classSectionRows] = await connection.query(
            "SELECT code, name, gradeLevel, strand FROM class_sections WHERE code = ? LIMIT 1",

            [code],
          )

          const [students] = await connection.query(
            "SELECT id, name, gradeLevel, strand, `section`, status FROM users WHERE role = 'student' AND status = 'Active'",
          )

          for (const student of students) {
            if (studentMatchesClassSection(student, classSectionRows[0])) {
              await syncStudentEnrollmentsInMysql(
                connection,
                student,
                code,
                period,
              )
            }
          }
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        if (error.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            ok: false,

            message:
              "A subject is already assigned to this section for the selected period.",
          })
        }

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const classSection = state.classSections.find(
        (section) => section.code === code,
      )

      if (!classSection) {
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })
      }

      for (const assignment of normalizedAssignments) {
        const subject = state.subjects.find(
          (item) => item.code === assignment.subjectCode,
        )

        const teacher = state.users.find(
          (item) =>
            item.role === "teacher" &&
            (item.id === assignment.teacher ||
              item.name === assignment.teacher),
        )

        if (!subject || !teacher) {
          return res.status(400).json({
            ok: false,

            message:
              "Each assignment must use an existing subject and teacher.",
          })
        }

        let offering = state.subjectSections.find(
          (item) =>
            item.subjectCode === assignment.subjectCode &&
            item.classSectionCode === code &&
            normalizeSchoolYear(item.schoolYear) === year &&
            item.semester === term,
        )

        if (offering) {
          Object.assign(offering, {
            subjectName: subject.name,

            classSectionName: classSection.name,

            teacher: teacher.name,

            status: "active",
          })
        } else {
          offering = {
            id: `SUBSEC-${crypto.randomUUID()}`,

            subjectCode: subject.code,

            subjectName: subject.name,

            classSectionCode: code,

            classSectionName: classSection.name,

            teacher: teacher.name,

            schoolYear: year,

            semester: term,

            enrolledStudents: [],

            status: "active",
          }

          state.subjectSections.push(offering)
        }

        savedAssignments.push(offering)
      }

      for (const subjectCode of normalizedRemovals) {
        const offering = state.subjectSections.find(
          (item) =>
            item.subjectCode === subjectCode &&
            item.classSectionCode === code &&
            normalizeSchoolYear(item.schoolYear) === year &&
            item.semester === term &&
            (item.status || "active") === "active",
        )

        if (offering) {
          offering.status = "inactive"

          offering.enrolledStudents = []

          for (const enrollment of state.enrollments) {
            if (
              enrollment.subjectSectionId === offering.id &&
              (enrollment.status || "active") === "active"
            ) {
              enrollment.status = "inactive"
            }
          }
        }
      }

      const period = getActiveAcademicPeriodFromState(state)

      if (
        normalizeSchoolYear(period?.schoolYear) === year &&
        period?.semester === term
      ) {
        const classRecord = state.classSections.find(
          (section) => section.code === code,
        )

        for (const student of state.users.filter(
          (user) =>
            user.role === "student" &&
            user.status === "Active" &&
            studentMatchesClassSection(user, classRecord),
        )) {
          syncStudentEnrollmentsInState(state, student, code, period)
        }
      }

      await saveState(state)
    }

    return res.status(200).json({ ok: true, assignments: savedAssignments })
  } catch (error) {
    console.error("Unable to assign subjects to the class section:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to assign subjects to the class section.",
    })
  }
})

app.post("/api/subject-sections", async (req, res) => {
  const {
    subjectCode,
    subjectName,
    classSectionCode,
    classSectionName,
    teacher,
    schoolYear,
    semester,
  } = req.body || {}

  if (
    !subjectCode ||
    !classSectionCode ||
    !teacher ||
    !schoolYear ||
    !semester
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        message:
          "Subject, class section, teacher, school year, and semester are required.",
      })
  }

  const record = {
    id: `SUBSEC-${crypto.randomUUID()}`,

    subjectCode: String(subjectCode).trim(),

    subjectName: String(subjectName || subjectCode).trim(),

    classSectionCode: String(classSectionCode).trim(),

    classSectionName: String(classSectionName || classSectionCode).trim(),

    teacher: String(teacher).trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    semester: String(semester || "").trim(),

    enrolledStudents: [],

    status: "active",
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [subjects] = await connection.query(
          "SELECT name FROM subjects WHERE code = ? LIMIT 1",

          [record.subjectCode],
        )

        const [classes] = await connection.query(
          "SELECT name FROM class_sections WHERE code = ? LIMIT 1 FOR UPDATE",

          [record.classSectionCode],
        )

        if (!subjects.length || !classes.length) {
          await connection.rollback()

          return res
            .status(400)
            .json({
              ok: false,
              message: "Select an existing subject and class section.",
            })
        }

        const [duplicates] = await connection.query(
          `SELECT id, status, enrolledStudents FROM subject_sections
           WHERE subjectCode = ? AND classSectionCode = ?
             AND ${normalizedSchoolYearSql("schoolYear")} = ? AND semester = ?
           ORDER BY (status = 'active') DESC LIMIT 1 FOR UPDATE`,

          [
            record.subjectCode,
            record.classSectionCode,
            record.schoolYear,
            record.semester,
          ],
        )

        if (duplicates[0]?.status === "active") {
          await connection.rollback()

          return res
            .status(409)
            .json({
              ok: false,
              message:
                "This subject is already offered to the selected class section for this term.",
            })
        }

        record.subjectName = subjects[0].name

        record.classSectionName = classes[0].name

        if (duplicates.length) {
          record.id = duplicates[0].id

          record.enrolledStudents = parseStudentRoster(
            duplicates[0].enrolledStudents,
          )

          await connection.query(
            `UPDATE subject_sections SET subjectName = ?, classSectionName = ?,
             teacher = ?, status = 'active' WHERE id = ?`,

            [
              record.subjectName,
              record.classSectionName,
              record.teacher,
              record.id,
            ],
          )
        } else {
          await connection.query(
            "INSERT INTO subject_sections (id, subjectCode, subjectName, classSectionCode, classSectionName, teacher, schoolYear, semester, enrolledStudents, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')",

            [
              record.id,
              record.subjectCode,
              record.subjectName,
              record.classSectionCode,
              record.classSectionName,
              record.teacher,
              record.schoolYear,
              record.semester,
              JSON.stringify([]),
            ],
          )
        }

        const period = await getActiveAcademicPeriod(connection)

        if (
          normalizeSchoolYear(period?.schoolYear) === record.schoolYear &&
          period.semester === record.semester
        ) {
          const [students] = await connection.query(
            "SELECT id, name, gradeLevel, strand, `section`, status FROM users WHERE role = 'student' AND status = 'Active'",
          )

          for (const student of students) {
            if (studentMatchesClassSection(student, classes[0])) {
              await syncStudentEnrollmentsInMysql(
                connection,

                student,

                record.classSectionCode,

                period,
              )
            }
          }
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const duplicate = state.subjectSections.find(
        (section) =>
          section.subjectCode === record.subjectCode &&
          section.classSectionCode === record.classSectionCode &&
          normalizeSchoolYear(section.schoolYear) === record.schoolYear &&
          section.semester === record.semester &&
          (section.status || "active") === "active",
      )

      if (duplicate)
        return res
          .status(409)
          .json({
            ok: false,
            message:
              "This subject section already exists for the selected class section and term.",
          })

      if (
        !state.subjects.some(
          (subject) => subject.code === record.subjectCode,
        ) ||
        !state.classSections.some(
          (section) => section.code === record.classSectionCode,
        )
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            message: "Select an existing subject and class section.",
          })
      }

      const archived = state.subjectSections.find(
        (section) =>
          section.subjectCode === record.subjectCode &&
          section.classSectionCode === record.classSectionCode &&
          normalizeSchoolYear(section.schoolYear) === record.schoolYear &&
          section.semester === record.semester &&
          section.status === "inactive",
      )

      const classSection = state.classSections.find(
        (section) => section.code === record.classSectionCode,
      )

      if (archived) {
        record.id = archived.id

        Object.assign(archived, record)
      } else {
        state.subjectSections.push(record)
      }

      const period = getActiveAcademicPeriodFromState(state)

      if (
        normalizeSchoolYear(period?.schoolYear) === record.schoolYear &&
        period.semester === record.semester
      ) {
        for (const student of state.users.filter(
          (user) =>
            user.role === "student" &&
            user.status === "Active" &&
            studentMatchesClassSection(user, classSection),
        )) {
          syncStudentEnrollmentsInState(
            state,
            student,
            record.classSectionCode,
            period,
          )
        }
      }

      await saveState(state)
    }

    return res.status(201).json({ ok: true, subjectSection: record })
  } catch (error) {
    console.error("Unable to create subject section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to create the subject section." })
  }
})

app.post("/api/class-sections", async (req, res) => {
  const { code, name, gradeLevel, strand, schoolYear, adviser } = req.body || {}

  if (!code || !name || !gradeLevel || !strand || !schoolYear || !adviser) {
    return res.status(400).json({
      ok: false,

      message:
        "Class section code, name, grade, strand, school year, and adviser are required.",
    })
  }

  const section = {
    code: String(code).trim().toUpperCase(),

    name: String(name).trim(),

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    adviser: String(adviser || "").trim(),

    status: "active",
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        await connection.query(
          "INSERT INTO class_sections (code, name, gradeLevel, strand, schoolYear, adviser, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",

          [
            section.code,

            section.name,

            section.gradeLevel,

            section.strand,

            section.schoolYear,

            section.adviser,
          ],
        )

        await connection.query(
          "INSERT INTO classes (code, subject, teacher, room, schedule, color, gradeLevel, strand, schoolYear) VALUES (?, ?, ?, '', '', 'emerald', ?, ?, ?) ON DUPLICATE KEY UPDATE subject = VALUES(subject), gradeLevel = VALUES(gradeLevel), strand = VALUES(strand), schoolYear = VALUES(schoolYear)",

          [
            section.code,

            section.name,

            section.adviser,

            section.gradeLevel,

            section.strand,

            section.schoolYear,
          ],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      if (state.classSections.some((item) => item.code === section.code)) {
        return res
          .status(409)
          .json({
            ok: false,
            message: "A class section with this code already exists.",
          })
      }

      state.classSections.push(section)

      await saveState(state)
    }

    return res.status(201).json({ ok: true, classSection: section })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({
          ok: false,
          message: "A class section with this code already exists.",
        })

    console.error("Unable to create class section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to create the class section." })
  }
})

app.patch("/api/class-sections/:code", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase()

  const { name, gradeLevel, strand, schoolYear, adviser } = req.body || {}

  const section = {
    code,

    name: String(name || "").trim(),

    gradeLevel: String(gradeLevel || "").trim(),

    strand: String(strand || "").trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    adviser: String(adviser || "").trim(),
  }

  if (!section.name)
    return res
      .status(400)
      .json({ ok: false, message: "Class section name is required." })

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "UPDATE class_sections SET name = ?, gradeLevel = ?, strand = ?, schoolYear = ?, adviser = ? WHERE code = ?",

        [
          section.name,
          section.gradeLevel,
          section.strand,
          section.schoolYear,
          section.adviser,
          code,
        ],
      )

      if (!result.affectedRows) {
        const [rows] = await pool.query(
          "SELECT code FROM class_sections WHERE code = ?",
          [code],
        )

        if (!rows.length)
          return res
            .status(404)
            .json({ ok: false, message: "Class section not found." })
      }

      await pool.query(
        "UPDATE classes SET subject = ?, teacher = ?, gradeLevel = ?, strand = ?, schoolYear = ? WHERE code = ?",

        [
          section.name,
          section.adviser,
          section.gradeLevel,
          section.strand,
          section.schoolYear,
          code,
        ],
      )

      await pool.query(
        "UPDATE subject_sections SET classSectionName = ? WHERE classSectionCode = ?",

        [section.name, code],
      )
    } else {
      const state = await loadState()

      const index = state.classSections.findIndex((item) => item.code === code)

      if (index < 0)
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })

      state.classSections[index] = section

      await saveState(state)
    }

    return res.json({ ok: true, classSection: section })
  } catch (error) {
    console.error("Unable to update class section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to update the class section." })
  }
})

app.delete("/api/class-sections/:code", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase()

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [sections] = await connection.query(
          "SELECT code FROM class_sections WHERE code = ? FOR UPDATE",

          [code],
        )

        if (!sections.length) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Class section not found." })
        }

        const [offerings] = await connection.query(
          "SELECT COUNT(*) AS count FROM subject_sections WHERE classSectionCode = ?",

          [code],
        )

        if (Number(offerings[0].count)) {
          await connection.rollback()

          return res
            .status(409)
            .json({
              ok: false,
              message:
                "Remove or reassign this class section's subject offerings before deleting it.",
            })
        }

        await connection.query("DELETE FROM class_sections WHERE code = ?", [
          code,
        ])

        await connection.query("DELETE FROM classes WHERE code = ?", [code])

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      if (!state.classSections.some((item) => item.code === code))
        return res
          .status(404)
          .json({ ok: false, message: "Class section not found." })

      if (state.subjectSections.some((item) => item.classSectionCode === code))
        return res
          .status(409)
          .json({
            ok: false,
            message:
              "Remove or reassign this class section's subject offerings before deleting it.",
          })

      state.classSections = state.classSections.filter(
        (item) => item.code !== code,
      )

      state.classes = state.classes.filter((item) => item.code !== code)

      await saveState(state)
    }

    return res.json({ ok: true, deleted: { code } })
  } catch (error) {
    console.error("Unable to delete class section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to delete the class section." })
  }
})

app.patch("/api/subject-sections/:id", async (req, res) => {
  const id = String(req.params.id)

  const { subjectCode, classSectionCode, teacher, schoolYear, semester } =
    req.body || {}

  if (
    !subjectCode ||
    !classSectionCode ||
    !teacher ||
    !schoolYear ||
    !semester
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        message:
          "Subject, class section, teacher, school year, and semester are required.",
      })
  }

  const record = {
    id,

    subjectCode: String(subjectCode).trim(),

    classSectionCode: String(classSectionCode).trim(),

    teacher: String(teacher).trim(),

    schoolYear: normalizeSchoolYear(schoolYear),

    semester: String(semester || "").trim(),
  }

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [subjects] = await connection.query(
          "SELECT name FROM subjects WHERE code = ? LIMIT 1",
          [record.subjectCode],
        )

        const [classes] = await connection.query(
          "SELECT name FROM class_sections WHERE code = ? LIMIT 1",
          [record.classSectionCode],
        )

        if (!subjects.length || !classes.length) {
          await connection.rollback()

          return res
            .status(400)
            .json({
              ok: false,
              message: "Select an existing subject and class section.",
            })
        }

        const [duplicates] = await connection.query(
          `SELECT id FROM subject_sections
           WHERE subjectCode = ? AND classSectionCode = ?
             AND ${normalizedSchoolYearSql("schoolYear")} = ? AND semester = ? AND id <> ? LIMIT 1`,

          [
            record.subjectCode,
            record.classSectionCode,
            record.schoolYear,
            record.semester,
            id,
          ],
        )

        if (duplicates.length) {
          await connection.rollback()

          return res
            .status(409)
            .json({
              ok: false,
              message:
                "This subject is already offered to the selected class section for this term.",
            })
        }

        record.subjectName = subjects[0].name

        record.classSectionName = classes[0].name

        const [result] = await connection.query(
          "UPDATE subject_sections SET subjectCode = ?, subjectName = ?, classSectionCode = ?, classSectionName = ?, teacher = ?, schoolYear = ?, semester = ? WHERE id = ?",

          [
            record.subjectCode,
            record.subjectName,
            record.classSectionCode,
            record.classSectionName,
            record.teacher,
            record.schoolYear,
            record.semester,
            id,
          ],
        )

        if (!result.affectedRows) {
          const [rows] = await connection.query(
            "SELECT id FROM subject_sections WHERE id = ?",
            [id],
          )

          if (!rows.length) {
            await connection.rollback()

            return res
              .status(404)
              .json({ ok: false, message: "Subject section not found." })
          }
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const index = state.subjectSections.findIndex((item) => item.id === id)

      if (index < 0)
        return res
          .status(404)
          .json({ ok: false, message: "Subject section not found." })

      if (
        state.subjectSections.some(
          (item) =>
            item.id !== id &&
            item.subjectCode === record.subjectCode &&
            item.classSectionCode === record.classSectionCode &&
            normalizeSchoolYear(item.schoolYear) === record.schoolYear &&
            item.semester === record.semester,
        )
      ) {
        return res
          .status(409)
          .json({
            ok: false,
            message:
              "This subject is already offered to the selected class section for this term.",
          })
      }

      const subject = state.subjects.find(
        (item) => item.code === record.subjectCode,
      )

      const classSection = state.classSections.find(
        (item) => item.code === record.classSectionCode,
      )

      if (!subject || !classSection)
        return res
          .status(400)
          .json({
            ok: false,
            message: "Select an existing subject and class section.",
          })

      state.subjectSections[index] = {
        ...state.subjectSections[index],
        ...record,
        subjectName: subject.name,
        classSectionName: classSection.name,
      }

      await saveState(state)

      record.subjectName = subject.name

      record.classSectionName = classSection.name

      record.enrolledStudents = state.subjectSections[index].enrolledStudents
    }

    return res.json({ ok: true, subjectSection: record })
  } catch (error) {
    console.error("Unable to update subject section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to update the subject section." })
  }
})

app.delete("/api/subject-sections/:id", async (req, res) => {
  const id = String(req.params.id)

  try {
    const pool = await ensureMysqlConnection()

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [sections] = await connection.query(
          "SELECT enrolledStudents FROM subject_sections WHERE id = ? FOR UPDATE",

          [id],
        )

        if (!sections.length) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Subject section not found." })
        }

        await connection.query(
          "UPDATE subject_sections SET status = 'inactive', enrolledStudents = ? WHERE id = ?",

          [JSON.stringify([]), id],
        )

        await connection.query(
          "UPDATE enrollments SET status = 'inactive' WHERE subjectSectionId = ? AND status = 'active'",

          [id],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const offering = state.subjectSections.find((item) => item.id === id)

      if (!offering)
        return res
          .status(404)
          .json({ ok: false, message: "Subject section not found." })

      offering.status = "inactive"

      offering.enrolledStudents = []

      for (const enrollment of state.enrollments) {
        if (
          enrollment.subjectSectionId === id &&
          (enrollment.status || "active") === "active"
        ) {
          enrollment.status = "inactive"
        }
      }

      await saveState(state)
    }

    return res.json({ ok: true, archived: { id } })
  } catch (error) {
    console.error("Unable to delete subject section:", error)

    return res
      .status(500)
      .json({ ok: false, message: "Unable to delete the subject section." })
  }
})

const allowedResourceNames = new Set([
  "assignments",

  "assessments",

  "assessment-questions",

  "scores",

  "announcements",

  "settings",

  "class-statuses",

  "profile-photos",

  "submissions",

  "assessment-attempts",

  "lessons",

  "notifications",

  "class-content",

  "materials",

  "calendar-events",
])

async function getRecordScopes(user) {
  const state = await loadState()

  const userRecord = state.users.find((entry) => entry.id === user.id)

  const sections = state.subjectSections || []

  const pool = await ensureMysqlConnection()

  const period = await getActiveAcademicPeriod(pool, state)

  const currentSections = sections.filter(
    (section) =>
      (section.status || "active") === "active" &&
      (!period ||
        (normalizeSchoolYear(section.schoolYear) ===
          normalizeSchoolYear(period.schoolYear) &&
          section.semester === period.semester)),
  )

  let visibleSections = []

  if (user.role === "teacher") {
    visibleSections = currentSections.filter(
      (section) =>
        section.teacher === user.id || section.teacher === userRecord?.name,
    )
  } else if (user.role === "student") {
    const enrolledIds = new Set(
      (state.enrollments || [])

        .filter(
          (enrollment) =>
            enrollment.studentId === user.id &&
            (enrollment.status || "active") === "active",
        )

        .map((enrollment) => enrollment.subjectSectionId),
    )

    visibleSections = currentSections.filter((section) =>
      enrolledIds.has(section.id),
    )
  }

  return new Set(
    visibleSections.flatMap((section) =>
      user.role === "student"
        ? [String(section.id)]
        : [String(section.id), String(section.classSectionCode)],
    ),
  )
}

async function authorizeRecordWrite(req, res, resource, scopeId, ownerId) {
  const { role, id } = req.user

  if (role === "admin") return { allowed: true, ownerId: ownerId || "" }

  if (resource === "profile-photos") {
    return { allowed: true, ownerId: id }
  }

  if (resource === "notifications") {
    return { allowed: true, ownerId: id }
  }

  if (role === "student" && resource === "submissions") {
    if (req.method !== "POST") {
      return { allowed: false, ownerId: id }
    }

    const scopes = await getRecordScopes(req.user)

    return {
      allowed: scopes.has(String(scopeId)),

      ownerId: id,
    }
  }

  const teacherResources = new Set([
    "assignments",

    "assessments",

    "assessment-questions",

    "announcements",

    "scores",

    "lessons",

    "class-content",

    "materials",

    "calendar-events",
  ])

  if (role === "teacher" && teacherResources.has(resource)) {
    const scopes = await getRecordScopes(req.user)

    return {
      allowed: Boolean(scopeId) && scopes.has(String(scopeId)),

      ownerId: id,
    }
  }

  return { allowed: false, ownerId: id }
}

function canReadRecord(record, resource, user, scopes) {
  if (user.role === "admin") return true

  if (["profile-photos", "notifications"].includes(resource)) {
    return record.ownerId === user.id
  }

  if (resource === "submissions") {
    return user.role === "teacher"
      ? scopes.has(String(record.scopeId))
      : record.ownerId === user.id
  }

  if (resource === "scores") {
    return user.role === "teacher"
      ? scopes.has(String(record.scopeId))
      : record.studentId === user.id && scopes.has(String(record.scopeId))
  }

  if (user.role === "student" && resource === "announcements") {
    return !record.scopeId || scopes.has(String(record.scopeId))
  }

  if (user.role === "student" && resource === "calendar-events") {
    return (
      (!record.scopeId || scopes.has(String(record.scopeId))) &&
      String(record.status || "").toLowerCase() === "published"
    )
  }

  if (user.role === "student") {
    return (
      [
        "assignments",
        "assessments",
        "class-content",
        "lessons",
        "materials",
      ].includes(resource) &&
      scopes.has(String(record.scopeId)) &&
      String(record.status || "").toLowerCase() === "published"
    )
  }

  if (user.role === "teacher") {
    return (
      [
        "assignments",
        "assessments",
        "assessment-questions",
        "announcements",
        "calendar-events",
        "class-content",
        "lessons",
        "materials",
      ].includes(resource) && scopes.has(String(record.scopeId))
    )
  }

  return false
}

function sanitizeRecordPayload(payload) {
  const {
    resource: _resource,

    id: _id,

    scopeId: _scopeId,

    ownerId: _ownerId,

    updatedAt: _updatedAt,

    ...recordPayload
  } = payload

  return recordPayload
}

async function findStoredRecord(resource, id) {
  const pool = await ensureMysqlConnection()

  if (pool) {
    const [rows] = await pool.query(
      "SELECT id, scopeId, ownerId, payload FROM lms_records WHERE resource = ? AND id = ? LIMIT 1",

      [resource, id],
    )

    const row = rows[0]

    if (!row) return null

    const payload =
      typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload

    return {
      ...payload,

      resource,

      id: row.id,

      scopeId: row.scopeId,

      ownerId: row.ownerId,
    }
  }

  const state = await loadState()

  return (
    (state.records || []).find(
      (record) => record.resource === resource && record.id === id,
    ) || null
  )
}

async function findStoredRecords(resource) {
  const pool = await ensureMysqlConnection()

  if (pool) {
    const [rows] = await pool.query(
      "SELECT id, scopeId, ownerId, payload, updatedAt FROM lms_records WHERE resource = ? ORDER BY updatedAt DESC",

      [resource],
    )

    return rows.map((row) => ({
      ...((typeof row.payload === "string"
        ? JSON.parse(row.payload)
        : row.payload) || {}),

      resource,

      id: row.id,

      scopeId: row.scopeId,

      ownerId: row.ownerId,

      updatedAt: row.updatedAt,
    }))
  }

  const state = await loadState()

  return (state.records || [])

    .filter((record) => record.resource === resource)

    .map((record) => ({
      ...sanitizeRecordPayload(record),

      resource,

      id: record.id,

      scopeId: record.scopeId || "",

      ownerId: record.ownerId || "",

      updatedAt: record.updatedAt,
    }))
}

async function loadAssessmentQuestions(assessment) {
  const questionsRecord = await findStoredRecord(
    "assessment-questions",

    assessment.scopeId,
  )

  const questionsByAssessment = questionsRecord?.questions

  const questions = Array.isArray(questionsByAssessment)
    ? questionsByAssessment
    : questionsByAssessment &&
        typeof questionsByAssessment === "object" &&
        !Array.isArray(questionsByAssessment)
      ? questionsByAssessment[String(assessment.title || "")] ||
        questionsByAssessment[String(assessment.id)] ||
        []
      : []

  return Array.isArray(questions)
    ? questions.filter(
        (question) =>
          question &&
          typeof question.prompt === "string" &&
          Array.isArray(question.options) &&
          question.options.length >= 2 &&
          Number.isInteger(question.correctAnswer) &&
          question.correctAnswer >= 0 &&
          question.correctAnswer < question.options.length,
      )
    : []
}

async function authorizeAssessmentRead(req, assessment) {
  if (
    !assessment ||
    String(assessment.status || "").toLowerCase() !== "published"
  ) {
    return false
  }

  if (req.user.role === "admin") return true

  const scopes = await getRecordScopes(req.user)

  return scopes.has(String(assessment.scopeId))
}

app.get("/api/assessments/:id/questions", async (req, res) => {
  try {
    const assessment = await findStoredRecord(
      "assessments",

      String(req.params.id),
    )

    if (!(await authorizeAssessmentRead(req, assessment))) {
      return res
        .status(404)
        .json({ ok: false, message: "Assessment not found." })
    }

    const questions = await loadAssessmentQuestions(assessment)

    return res.json({
      assessmentId: assessment.id,

      title: assessment.title,

      type: assessment.type,

      questions: questions.map(({ prompt, options }) => ({ prompt, options })),
    })
  } catch (error) {
    console.error("Unable to load assessment questions:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load assessment questions.",
    })
  }
})

app.get("/api/assessments/:id/attempts", async (req, res) => {
  try {
    const assessment = await findStoredRecord(
      "assessments",

      String(req.params.id),
    )

    if (!assessment) {
      return res
        .status(404)
        .json({ ok: false, message: "Assessment not found." })
    }

    if (req.user.role !== "admin" && req.user.role !== "student") {
      const scopes = await getRecordScopes(req.user)

      if (!scopes.has(String(assessment.scopeId))) {
        return res
          .status(403)
          .json({
            ok: false,
            message: "You are not allowed to view these attempts.",
          })
      }
    } else if (req.user.role === "student") {
      const scopes = await getRecordScopes(req.user)

      if (!scopes.has(String(assessment.scopeId))) {
        return res
          .status(403)
          .json({
            ok: false,
            message: "You are not enrolled in this assessment's class.",
          })
      }
    }

    const attempts = (await findStoredRecords("assessment-attempts"))

      .filter(
        (attempt) =>
          attempt.assessmentId === assessment.id &&
          (req.user.role !== "student" || attempt.ownerId === req.user.id),
      )

      .map(
        ({
          id,

          assessmentId,

          attemptNumber,

          correctAnswers,

          questionCount,

          scorePercent,

          submittedAt,

          ownerId,
        }) => ({
          id,

          assessmentId,

          studentId: ownerId,

          attemptNumber,

          correctAnswers,

          questionCount,

          scorePercent,

          submittedAt,
        }),
      )

    return res.json(attempts)
  } catch (error) {
    console.error("Unable to load assessment attempts:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to load assessment attempts.",
    })
  }
})

app.post("/api/assessments/:id/attempts", async (req, res) => {
  if (req.user.role !== "student") {
    return res
      .status(403)
      .json({
        ok: false,
        message: "Only students can submit an assessment attempt.",
      })
  }

  const answers = req.body?.answers

  if (!Array.isArray(answers) || !answers.every(Number.isInteger)) {
    return res
      .status(400)
      .json({
        ok: false,
        message: "A valid answer is required for every question.",
      })
  }

  try {
    const assessment = await findStoredRecord(
      "assessments",

      String(req.params.id),
    )

    if (!(await authorizeAssessmentRead(req, assessment))) {
      return res
        .status(404)
        .json({ ok: false, message: "Assessment not found." })
    }

    const availableDate = Date.parse(String(assessment.availableDate || ""))

    if (Number.isFinite(availableDate) && availableDate > Date.now()) {
      return res
        .status(400)
        .json({ ok: false, message: "This assessment is not available yet." })
    }

    const questions = await loadAssessmentQuestions(assessment)

    if (!questions.length || answers.length !== questions.length) {
      return res
        .status(400)
        .json({
          ok: false,
          message: "Answer every configured question before submitting.",
        })
    }

    if (
      answers.some(
        (answer, index) =>
          answer < 0 || answer >= questions[index].options.length,
      )
    ) {
      return res
        .status(400)
        .json({ ok: false, message: "One or more answers are invalid." })
    }

    const maximumAttempts = Math.max(
      1,
      Number.parseInt(String(assessment.attempts || "1"), 10) || 1,
    )

    const pool = await ensureMysqlConnection()

    let record

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [rows] = await connection.query(
          "SELECT id, ownerId, payload FROM lms_records WHERE resource = 'assessment-attempts' AND scopeId = ? ORDER BY id FOR UPDATE",

          [String(assessment.scopeId)],
        )

        const existingAttempts = rows

          .map((row) => ({
            id: row.id,

            ownerId: row.ownerId,

            ...(typeof row.payload === "string"
              ? JSON.parse(row.payload)
              : row.payload),
          }))

          .filter(
            (attempt) =>
              attempt.assessmentId === assessment.id &&
              attempt.ownerId === req.user.id,
          )

        if (existingAttempts.length >= maximumAttempts) {
          await connection.rollback()

          return res
            .status(409)
            .json({ ok: false, message: "You have used all allowed attempts." })
        }

        record = createAssessmentAttempt(
          assessment,

          req.user.id,

          existingAttempts.length + 1,

          answers,

          questions,
        )

        await connection.query(
          "INSERT INTO lms_records (resource, id, scopeId, ownerId, payload, updatedAt) VALUES ('assessment-attempts', ?, ?, ?, ?, NOW())",

          [
            record.id,

            String(assessment.scopeId),

            req.user.id,

            JSON.stringify(record),
          ],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        if (error.code === "ER_DUP_ENTRY") {
          return res
            .status(409)
            .json({
              ok: false,
              message: "This assessment attempt was already submitted.",
            })
        }

        throw error
      } finally {
        connection.release()
      }
    } else {
      record = await serializeAssessmentAttempt(async () => {
        const state = await loadState()

        state.records ||= []

        const existingAttempts = state.records.filter(
          (attempt) =>
            attempt.resource === "assessment-attempts" &&
            attempt.scopeId === assessment.scopeId &&
            attempt.assessmentId === assessment.id &&
            attempt.ownerId === req.user.id,
        )

        if (existingAttempts.length >= maximumAttempts) {
          const error = new Error("You have used all allowed attempts.")

          error.status = 409

          throw error
        }

        const created = createAssessmentAttempt(
          assessment,

          req.user.id,

          existingAttempts.length + 1,

          answers,

          questions,
        )

        state.records.push({
          ...created,

          resource: "assessment-attempts",

          id: created.id,

          scopeId: String(assessment.scopeId),

          ownerId: req.user.id,

          updatedAt: new Date().toISOString(),
        })

        await saveState(state)

        return created
      })
    }

    return res.status(201).json({ ok: true, attempt: record })
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({ ok: false, message: error.message })
    }

    console.error("Unable to submit assessment attempt:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to submit this assessment attempt.",
    })
  }
})

let assessmentAttemptQueue = Promise.resolve()

function serializeAssessmentAttempt(operation) {
  const result = assessmentAttemptQueue.then(operation, operation)

  assessmentAttemptQueue = result.then(
    () => undefined,

    () => undefined,
  )

  return result
}

function createAssessmentAttempt(
  assessment,
  studentId,
  attemptNumber,
  answers,
  questions,
) {
  const correctAnswers = answers.reduce(
    (total, answer, index) =>
      total + Number(answer === questions[index].correctAnswer),

    0,
  )

  return {
    id: `${assessment.id}:${studentId}:${attemptNumber}`,

    assessmentId: assessment.id,

    attemptNumber,

    answers,

    correctAnswers,

    questionCount: questions.length,

    scorePercent: Math.round((correctAnswers / questions.length) * 10000) / 100,

    submittedAt: new Date().toISOString(),
  }
}

function validateScorePayload(payload, scopeId, state) {
  const ranges = {
    quiz1: 20,

    quiz2: 20,

    activity: 50,

    performance: 100,

    exam: 50,
  }

  for (const [field, maximum] of Object.entries(ranges)) {
    const value = Number(payload[field])

    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      return `${field} must be between 0 and ${maximum}.`
    }
  }

  if (typeof payload.studentId !== "string" || !payload.studentId) {
    return "A student is required for this score."
  }

  const student = state.users.find(
    (user) => user.id === payload.studentId && user.role === "student",
  )

  if (!student) return "The selected student does not exist."

  const section = state.subjectSections.find((item) => item.id === scopeId)

  if (!section) return "Scores must be assigned to a subject section."

  const enrollment = state.enrollments.some(
    (item) =>
      item.studentId === payload.studentId &&
      item.subjectSectionId === section.id &&
      (item.status || "active") === "active",
  )

  if (!enrollment)
    return "The selected student is not enrolled in this subject section."

  return ""
}

app.get("/api/records/:resource", async (req, res) => {
  const resource = String(req.params.resource)

  if (!allowedResourceNames.has(resource)) {
    return res
      .status(404)
      .json({ ok: false, message: "Unknown record collection." })
  }

  try {
    const pool = await ensureMysqlConnection()

    let records

    if (pool) {
      const [rows] = await pool.query(
        "SELECT id, scopeId, ownerId, payload, updatedAt FROM lms_records WHERE resource = ? ORDER BY updatedAt DESC",

        [resource],
      )

      records = rows.map((row) => ({
        ...((typeof row.payload === "string"
          ? JSON.parse(row.payload)
          : row.payload) || {}),

        id: row.id,

        scopeId: row.scopeId,

        ownerId: row.ownerId,

        updatedAt: row.updatedAt,
      }))
    } else {
      const state = await loadState()

      records = (state.records || [])

        .filter((record) => record.resource === resource)

        .map((record) => ({
          ...sanitizeRecordPayload(record),

          resource,

          id: record.id,

          scopeId: record.scopeId || "",

          ownerId: record.ownerId || "",

          updatedAt: record.updatedAt,
        }))
    }

    const scopes =
      req.user.role === "admin" ? null : await getRecordScopes(req.user)

    records = records.filter((record) => {
      if (
        req.query.scopeId !== undefined &&
        record.scopeId !== req.query.scopeId
      ) {
        return false
      }

      if (
        req.user.role === "admin" &&
        req.query.ownerId !== undefined &&
        record.ownerId !== req.query.ownerId
      ) {
        return false
      }

      return canReadRecord(record, resource, req.user, scopes)
    })

    return res.json(records)
  } catch (error) {
    console.error(`Unable to load ${resource}:`, error)

    return res
      .status(500)
      .json({ ok: false, message: `Unable to load ${resource}.` })
  }
})

app.post("/api/records/:resource", async (req, res) => {
  const resource = String(req.params.resource)

  const { id, scopeId = "", ownerId = "", payload } = req.body || {}

  if (!allowedResourceNames.has(resource)) {
    return res
      .status(404)
      .json({ ok: false, message: "Unknown record collection." })
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return res
      .status(400)
      .json({ ok: false, message: "A record payload is required." })
  }

  let recordPayload = sanitizeRecordPayload(payload)

  const recordId = String(id || crypto.randomUUID())

  try {
    const access = await authorizeRecordWrite(
      req,
      res,
      resource,
      scopeId,
      ownerId,
    )

    if (!access.allowed) {
      return res
        .status(403)
        .json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
    }

    const existing = await findStoredRecord(resource, recordId)

    if (
      req.user.role !== "admin" &&
      existing &&
      (String(existing.scopeId || "") !== String(scopeId) ||
        (resource === "scores" &&
          existing.studentId !== recordPayload.studentId) ||
        (["profile-photos", "notifications", "submissions"].includes(
          resource,
        ) &&
          existing.ownerId !== access.ownerId))
    ) {
      return res
        .status(403)
        .json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
    }

    if (resource === "scores") {
      const state = await loadState()

      const validationError = validateScorePayload(
        recordPayload,

        String(scopeId),

        state,
      )

      if (validationError) {
        return res.status(400).json({ ok: false, message: validationError })
      }

      const student = state.users.find(
        (user) => user.id === recordPayload.studentId,
      )

      const section = state.subjectSections.find(
        (item) => item.id === String(scopeId),
      )

      recordPayload = {
        ...recordPayload,

        name: student.name,

        subject: section.subjectName,

        teacher: section.teacher,
      }
    }

    const pool = await ensureMysqlConnection()

    if (pool) {
      if (resource === "settings" && recordId === "lms-settings") {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()

          await connection.query(
            "INSERT INTO lms_records (resource, id, scopeId, ownerId, payload, updatedAt) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE scopeId = VALUES(scopeId), ownerId = VALUES(ownerId), payload = VALUES(payload), updatedAt = NOW()",

            [
              resource,
              recordId,
              String(scopeId),
              access.ownerId,
              JSON.stringify(recordPayload),
            ],
          )

          const period = await getActiveAcademicPeriod(connection)

          if (period) {
            const [classSections] = await connection.query(
              "SELECT code, name, gradeLevel, strand FROM class_sections",
            )

            const [students] = await connection.query(
              "SELECT id, name, gradeLevel, strand, `section`, status FROM users WHERE role = 'student' AND status = 'Active'",
            )

            for (const student of students) {
              const classSection = classSections.find((section) =>
                studentMatchesClassSection(student, section),
              )

              if (classSection) {
                await syncStudentEnrollmentsInMysql(
                  connection,

                  student,

                  classSection.code,

                  period,
                )
              }
            }
          }

          await connection.commit()
        } catch (error) {
          await connection.rollback()

          throw error
        } finally {
          connection.release()
        }
      } else {
        await pool.query(
          "INSERT INTO lms_records (resource, id, scopeId, ownerId, payload, updatedAt) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE scopeId = VALUES(scopeId), ownerId = VALUES(ownerId), payload = VALUES(payload), updatedAt = NOW()",

          [
            resource,
            recordId,
            String(scopeId),
            access.ownerId,
            JSON.stringify(recordPayload),
          ],
        )
      }
    } else {
      const state = await loadState()

      state.records ||= []

      const existing = state.records.find(
        (record) => record.resource === resource && record.id === recordId,
      )

      const record = {
        ...recordPayload,

        resource,

        id: recordId,

        scopeId: String(scopeId),

        ownerId: access.ownerId,

        updatedAt: new Date().toISOString(),
      }

      if (existing) Object.assign(existing, record)
      else state.records.push(record)

      const period =
        resource === "settings" && recordId === "lms-settings"
          ? getActiveAcademicPeriodFromState(state)
          : null

      if (period) {
        for (const student of state.users.filter(
          (user) => user.role === "student" && user.status === "Active",
        )) {
          const classSection = state.classSections.find((section) =>
            studentMatchesClassSection(student, section),
          )

          if (classSection) {
            syncStudentEnrollmentsInState(
              state,

              student,

              classSection.code,

              period,
            )
          }
        }
      }

      await saveState(state)
    }

    return res.status(201).json({
      ok: true,

      record: {
        ...recordPayload,

        id: recordId,

        scopeId: String(scopeId),

        ownerId: access.ownerId,
      },
    })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res
        .status(409)
        .json({ ok: false, message: "This record already exists." })

    console.error(`Unable to create ${resource} record:`, error)

    return res
      .status(500)
      .json({ ok: false, message: `Unable to create ${resource} record.` })
  }
})

app.patch("/api/records/:resource/:id", async (req, res) => {
  const resource = String(req.params.resource)

  const id = String(req.params.id)

  const { scopeId = "", ownerId = "", payload } = req.body || {}

  if (!allowedResourceNames.has(resource))
    return res
      .status(404)
      .json({ ok: false, message: "Unknown record collection." })

  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return res
      .status(400)
      .json({ ok: false, message: "A record payload is required." })

  let recordPayload = sanitizeRecordPayload(payload)

  try {
    const existing = await findStoredRecord(resource, id)

    if (!existing)
      return res.status(404).json({ ok: false, message: "Record not found." })

    const access = await authorizeRecordWrite(
      req,

      res,

      resource,

      existing.scopeId,

      existing.ownerId,
    )

    if (!access.allowed) {
      return res
        .status(403)
        .json({
          ok: false,
          message: "You are not allowed to modify this record.",
        })
    }

    if (resource === "scores") {
      if (existing.studentId !== recordPayload.studentId) {
        return res
          .status(403)
          .json({
            ok: false,
            message: "A score cannot be reassigned to another student.",
          })
      }

      const state = await loadState()

      const validationError = validateScorePayload(
        recordPayload,

        existing.scopeId,

        state,
      )

      if (validationError) {
        return res.status(400).json({ ok: false, message: validationError })
      }

      const student = state.users.find(
        (user) => user.id === recordPayload.studentId,
      )

      const section = state.subjectSections.find(
        (item) => item.id === existing.scopeId,
      )

      recordPayload = {
        ...recordPayload,

        name: student.name,

        subject: section.subjectName,

        teacher: section.teacher,
      }
    }

    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "UPDATE lms_records SET scopeId = ?, ownerId = ?, payload = ?, updatedAt = NOW() WHERE resource = ? AND id = ?",

        [
          req.user.role === "admin" ? String(scopeId) : existing.scopeId,
          access.ownerId,
          JSON.stringify(recordPayload),
          resource,
          id,
        ],
      )

      if (!result.affectedRows)
        return res.status(404).json({ ok: false, message: "Record not found." })
    } else {
      const state = await loadState()

      const index = (state.records || []).findIndex(
        (record) => record.resource === resource && record.id === id,
      )

      if (index < 0)
        return res.status(404).json({ ok: false, message: "Record not found." })

      state.records[index] = {
        ...recordPayload,

        resource,

        id,

        scopeId: req.user.role === "admin" ? String(scopeId) : existing.scopeId,

        ownerId: access.ownerId,

        updatedAt: new Date().toISOString(),
      }

      await saveState(state)
    }

    return res.json({
      ok: true,

      record: {
        ...recordPayload,

        resource,

        id,

        scopeId: req.user.role === "admin" ? String(scopeId) : existing.scopeId,

        ownerId: access.ownerId,
      },
    })
  } catch (error) {
    console.error(`Unable to update ${resource} record:`, error)

    return res
      .status(500)
      .json({ ok: false, message: `Unable to update ${resource} record.` })
  }
})

app.delete("/api/records/:resource/:id", async (req, res) => {
  const resource = String(req.params.resource)

  const id = String(req.params.id)

  if (!allowedResourceNames.has(resource))
    return res
      .status(404)
      .json({ ok: false, message: "Unknown record collection." })

  try {
    const existing = await findStoredRecord(resource, id)

    if (!existing)
      return res.status(404).json({ ok: false, message: "Record not found." })

    const access = await authorizeRecordWrite(
      req,

      res,

      resource,

      existing.scopeId,

      existing.ownerId,
    )

    const canDeleteOwnNotification =
      resource === "notifications" &&
      existing.ownerId === req.user.id &&
      access.allowed

    if (
      !access.allowed ||
      (req.user.role !== "admin" && !canDeleteOwnNotification)
    ) {
      return res
        .status(403)
        .json({
          ok: false,
          message: "Administrator access is required to delete records.",
        })
    }

    const pool = await ensureMysqlConnection()

    if (pool) {
      const [result] = await pool.query(
        "DELETE FROM lms_records WHERE resource = ? AND id = ?",

        [resource, id],
      )

      if (!result.affectedRows)
        return res.status(404).json({ ok: false, message: "Record not found." })
    } else {
      const state = await loadState()

      const records = state.records || []

      if (
        !records.some(
          (record) => record.resource === resource && record.id === id,
        )
      )
        return res.status(404).json({ ok: false, message: "Record not found." })

      state.records = records.filter(
        (record) => record.resource !== resource || record.id !== id,
      )

      await saveState(state)
    }

    return res.json({ ok: true, deleted: { resource, id } })
  } catch (error) {
    console.error(`Unable to delete ${resource} record:`, error)

    return res
      .status(500)
      .json({ ok: false, message: `Unable to delete ${resource} record.` })
  }
})

app.post("/api/enrollments", async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      ok: false,

      message: "Only administrators can change student enrollments.",
    })
  }

  const { subjectSectionId, studentId, adminId, password } = req.body || {}

  if (!subjectSectionId || !studentId) {
    return res.status(400).json({
      ok: false,

      message: "Subject section and student are required.",
    })
  }

  try {
    const authorization = await verifyAdministrator(adminId, password)

    if (authorization.error) {
      return res.status(authorization.error.status).json({
        ok: false,

        message: authorization.error.message,
      })
    }

    const pool = await ensureMysqlConnection()

    let record

    if (pool) {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

        const [sections] = await connection.query(
          "SELECT * FROM subject_sections WHERE id = ? FOR UPDATE",

          [subjectSectionId],
        )

        const section = sections[0]

        if (!section || section.status === "inactive") {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Subject section not found." })
        }

        const [students] = await connection.query(
          "SELECT id, name, gradeLevel, strand, `section`, status FROM users WHERE id = ? AND role = 'student' LIMIT 1",

          [studentId],
        )

        const student = students[0]

        if (!student) {
          await connection.rollback()

          return res
            .status(404)
            .json({ ok: false, message: "Student not found." })
        }

        const [classSections] = await connection.query(
          "SELECT code, name, gradeLevel, strand FROM class_sections WHERE code = ? LIMIT 1",

          [section.classSectionCode],
        )

        if (!studentMatchesClassSection(student, classSections[0])) {
          await connection.rollback()

          return res.status(400).json({
            ok: false,

            message:
              "This student is not eligible for the selected class section.",
          })
        }

        const enrolledStudents = parseStudentRoster(section.enrolledStudents)

        const [existing] = await connection.query(
          "SELECT id, status FROM enrollments WHERE studentId = ? AND subjectSectionId = ? ORDER BY enrolledAt DESC LIMIT 1 FOR UPDATE",

          [studentId, subjectSectionId],
        )

        if (existing[0]?.status === "active") {
          await connection.rollback()

          return res.status(409).json({
            ok: false,

            message: "Student is already enrolled in this subject section.",
          })
        }

        record = {
          id: `enr-${crypto.randomUUID()}`,

          studentId: student.id,

          studentName: student.name,

          subjectSectionId: section.id,

          subjectCode: section.subjectCode,

          subjectName: section.subjectName,

          teacher: section.teacher,

          schoolYear: section.schoolYear,

          semester: section.semester,

          status: "active",

          enrolledAt: new Date().toISOString(),
        }

        if (existing.length) {
          record.id = existing[0].id

          await connection.query(
            `UPDATE enrollments SET studentName = ?, subjectCode = ?, subjectName = ?,
             teacher = ?, enrolledAt = ?, schoolYear = ?, semester = ?, status = 'active'
             WHERE id = ?`,

            [
              record.studentName,

              record.subjectCode,

              record.subjectName,

              record.teacher,

              record.enrolledAt.slice(0, 19).replace("T", " "),

              record.schoolYear,

              record.semester,

              record.id,
            ],
          )
        } else {
          await connection.query(
            `INSERT INTO enrollments
             (id, studentId, studentName, subjectSectionId, subjectCode, subjectName,
              teacher, enrolledAt, schoolYear, semester, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,

            [
              record.id,

              record.studentId,

              record.studentName,

              record.subjectSectionId,

              record.subjectCode,

              record.subjectName,

              record.teacher,

              record.enrolledAt.slice(0, 19).replace("T", " "),

              record.schoolYear,

              record.semester,
            ],
          )
        }

        enrolledStudents.push(studentId)

        await connection.query(
          "UPDATE subject_sections SET enrolledStudents = ? WHERE id = ?",

          [JSON.stringify(enrolledStudents), subjectSectionId],
        )

        await connection.commit()
      } catch (error) {
        await connection.rollback()

        if (error.code === "ER_DUP_ENTRY") {
          return res.status(409).json({
            ok: false,

            message: "Student is already enrolled in this subject section.",
          })
        }

        throw error
      } finally {
        connection.release()
      }
    } else {
      const state = await loadState()

      const section = state.subjectSections.find(
        (item) => item.id === subjectSectionId,
      )

      if (!section || (section.status || "active") === "inactive") {
        return res
          .status(404)
          .json({ ok: false, message: "Subject section not found." })
      }

      const student = state.users.find(
        (user) => user.id === studentId && user.role === "student",
      )

      if (!student) {
        return res
          .status(404)
          .json({ ok: false, message: "Student not found." })
      }

      const classSection = state.classSections.find(
        (item) => item.code === section.classSectionCode,
      )

      if (!studentMatchesClassSection(student, classSection)) {
        return res.status(400).json({
          ok: false,

          message:
            "This student is not eligible for the selected class section.",
        })
      }

      const existing = state.enrollments.find(
        (item) =>
          item.studentId === studentId &&
          item.subjectSectionId === subjectSectionId &&
          (item.status || "active") === "active",
      )

      if (existing) {
        return res.status(409).json({
          ok: false,

          message: "Student is already enrolled in this subject section.",
        })
      }

      record = {
        id: `enr-${crypto.randomUUID()}`,

        studentId: student.id,

        studentName: student.name,

        subjectSectionId: section.id,

        subjectCode: section.subjectCode,

        subjectName: section.subjectName,

        teacher: section.teacher,

        schoolYear: section.schoolYear,

        semester: section.semester,

        status: "active",

        enrolledAt: new Date().toISOString(),
      }

      const historic = state.enrollments

        .filter(
          (item) =>
            item.studentId === studentId &&
            item.subjectSectionId === subjectSectionId,
        )

        .pop()

      if (historic) record.id = historic.id

      if (historic) Object.assign(historic, record)
      else state.enrollments.push(record)

      section.enrolledStudents.push(studentId)

      await saveState(state)
    }

    return res.status(201).json({ ok: true, enrollment: record })
  } catch (error) {
    console.error("Unable to add student enrollment:", error)

    return res.status(500).json({
      ok: false,

      message: "Unable to add the student to this subject section.",
    })
  }
})

app.delete(
  "/api/enrollments/:subjectSectionId/:studentId",
  async (req, res) => {
    const { subjectSectionId, studentId } = req.params

    const { adminId, password } = req.body || {}

    try {
      const authorization = await verifyAdministrator(adminId, password)

      if (authorization.error) {
        return res.status(authorization.error.status).json({
          ok: false,

          message: authorization.error.message,
        })
      }

      const pool = await ensureMysqlConnection()

      if (pool) {
        const connection = await pool.getConnection()

        try {
          await connection.beginTransaction()

          const [sections] = await connection.query(
            "SELECT enrolledStudents FROM subject_sections WHERE id = ? FOR UPDATE",

            [subjectSectionId],
          )

          if (!sections.length) {
            await connection.rollback()

            return res
              .status(404)
              .json({ ok: false, message: "Subject section not found." })
          }

          const enrolledStudents = parseStudentRoster(
            sections[0].enrolledStudents,
          )

          const [existing] = await connection.query(
            "SELECT id FROM enrollments WHERE studentId = ? AND subjectSectionId = ? AND status = 'active' FOR UPDATE",

            [studentId, subjectSectionId],
          )

          if (!enrolledStudents.includes(studentId) && !existing.length) {
            await connection.rollback()

            return res.status(404).json({
              ok: false,

              message: "Student is not enrolled in this subject section.",
            })
          }

          await connection.query(
            "UPDATE enrollments SET status = 'inactive' WHERE studentId = ? AND subjectSectionId = ? AND status = 'active'",

            [studentId, subjectSectionId],
          )

          await connection.query(
            "UPDATE subject_sections SET enrolledStudents = ? WHERE id = ?",

            [
              JSON.stringify(enrolledStudents.filter((id) => id !== studentId)),

              subjectSectionId,
            ],
          )

          await connection.commit()
        } catch (error) {
          await connection.rollback()

          throw error
        } finally {
          connection.release()
        }
      } else {
        const state = await loadState()

        const section = state.subjectSections.find(
          (item) => item.id === subjectSectionId,
        )

        if (!section) {
          return res
            .status(404)
            .json({ ok: false, message: "Subject section not found." })
        }

        const activeEnrollment = state.enrollments.some(
          (item) =>
            item.studentId === studentId &&
            item.subjectSectionId === subjectSectionId &&
            (item.status || "active") === "active",
        )

        const isEnrolled =
          section.enrolledStudents.includes(studentId) || activeEnrollment

        if (!isEnrolled) {
          return res.status(404).json({
            ok: false,

            message: "Student is not enrolled in this subject section.",
          })
        }

        section.enrolledStudents = section.enrolledStudents.filter(
          (id) => id !== studentId,
        )

        for (const enrollment of state.enrollments) {
          if (
            enrollment.studentId === studentId &&
            enrollment.subjectSectionId === subjectSectionId &&
            (enrollment.status || "active") === "active"
          ) {
            enrollment.status = "inactive"
          }
        }

        await saveState(state)
      }

      return res.json({ ok: true, removed: { subjectSectionId, studentId } })
    } catch (error) {
      console.error("Unable to remove student enrollment:", error)

      return res.status(500).json({
        ok: false,

        message: "Unable to remove the student from this subject section.",
      })
    }
  },
)

const distPath = path.resolve(__dirname, "../dist")

app.use(express.static(distPath))

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

async function startServer() {
  await ensureMysqlConnection()

  app.listen(port, () => {
    console.log(`SNSHS LMS backend running on http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error("SNSHS LMS backend startup failed.", error)

  process.exitCode = 1
})
