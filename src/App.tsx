import { useEffect, useState } from "react"
import defaultProfile from "./assets/default-profile.png"
import logo from "./assets/snhs-logo.png"

type Role = "student" | "teacher" | "admin"
type IconName = "grid" | "book" | "layers" | "file" | "check" | "quiz" | "chart" | "bell" | "user" | "logout" | "users" | "briefcase" | "report" | "settings" | "search" | "menu" | "close" | "plus" | "arrow" | "clock" | "calendar" | "room" | "download" | "edit" | "trash" | "eye" | "filter" | "chevron" | "award" | "activity"

const schoolTimeZone = "Asia/Manila"
const studentStrandOptions = ["Stem", "Gas", "TVL-ICT", "ICT", "ABM", "HUMSS"]

function normalizeStrand(value: string) {
  return value.trim().toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = localStorage.getItem("snhs-session-token")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

async function saveApiRecord(
  resource: string,
  record: Record<string, unknown>,
  scopeId = "",
  id?: string,
  ownerId = "",
) {
  const recordId = id || crypto.randomUUID()
  const response = await apiFetch(`/api/records/${resource}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: recordId,
      scopeId,
      ownerId,
      payload: record,
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.record) {
    throw new Error(payload?.message || `Unable to save ${resource}.`)
  }
  window.dispatchEvent(new Event("snhs-records-updated"))
  return payload.record
}

function ProfileAvatar({
  role,
  className,
  src,
}: {
  role: Role
  className: string
  src?: string | null
}) {
  const photo = src || defaultProfile
  const profileName =
    role === "student"
      ? "Student User"
      : role === "teacher"
        ? "Faculty User"
        : "System Administrator"

  return (
    <img
      className={`${className} user-photo`}
      src={photo}
      alt={`${profileName} profile`}
    />
  )
}

function useSchoolTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const date = new Intl.DateTimeFormat("en-PH", {
    timeZone: schoolTimeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now)
  const time = new Intl.DateTimeFormat("en-PH", {
    timeZone: schoolTimeZone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now)
  const hour = Number(
    new Intl.DateTimeFormat("en-PH", {
      timeZone: schoolTimeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  )
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return { date, time, greeting }
}

const paths: Record<IconName, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6" />
    </>
  ),
  check: (
    <>
      <path d="M9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  quiz: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9.1 9a3 3 0 1 1 5.5 1.7c-1 .8-2.1 1.2-2.1 2.8" />
      <path d="M12.5 17h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 3 3 5-7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
  logout: (
    <>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" />
    </>
  ),
  report: (
    <>
      <path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.1h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.1v-4H3A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.1h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.36.72.6 1 .3.25.64.38 1 .4h.1v4H21a1.7 1.7 0 0 0-1.6.6Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12M18 6 6 18" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  arrow: (
    <>
      <path d="m9 18 6-6-6-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  room: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
      <path d="M5 21h14" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16l-6 7v6l-4 2v-8Z" />
    </>
  ),
  chevron: (
    <>
      <path d="m6 9 6 6 6-6" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="m8 13-2 9 6-3 6 3-2-9" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </>
  ),
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const nav: Record<Role, {
  id: string
  label: string
  icon: IconName
}[]> = {
  student: [
    ["dashboard", "Dashboard", "grid"],
    ["classes", "My Classes", "book"],
    ["assessments", "Quizzes & Exams", "quiz"],
    ["grades", "My Grades", "chart"],
    ["announcements", "Announcements", "bell"],
    ["calendar", "Calendar", "calendar"],
  ].map(([id, label, icon]) => ({ id, label, icon: icon as IconName })),
  teacher: [
    ["dashboard", "Dashboard", "grid"],
    ["classes", "My Classes", "book"],
    ["grades", "Gradebook", "chart"],
    ["announcements", "Announcements", "bell"],
    ["reports", "Reports", "report"],
  ].map(([id, label, icon]) => ({ id, label, icon: icon as IconName })),
  admin: [
    ["dashboard", "Dashboard", "grid"],
    ["students", "Manage Students", "users"],
    ["teachers", "Manage Teachers", "briefcase"],
    ["subjects", "Subject Management", "layers"],
    ["classes", "Class Sections", "book"],
    ["announcements", "Announcements", "bell"],
    ["reports", "Reports", "report"],
    ["activity-logs", "Activity Logs", "activity"],
    ["settings", "System Settings", "settings"],
  ].map(([id, label, icon]) => ({ id, label, icon: icon as IconName })),
}

type ClassRecord = {
  subject: string
  code: string
  teacher: string
  room: string
  schedule: string
  color: string
  gradeLevel: string
  strand: string
  schoolYear: string
  semester?: string
  classSectionName?: string
  isEnrolled?: boolean
}

const emptyClassRecord: ClassRecord = {
  subject: "",
  code: "",
  teacher: "",
  room: "",
  schedule: "",
  color: "emerald",
  gradeLevel: "",
  strand: "",
  schoolYear: "",
}
const classes: ClassRecord[] = []
const students: string[][] = []
const teachers: string[][] = []

type GradingSettings = {
  written: number
  performance: number
  exams: number
  passingGrade: number
}

type RecordedScore = {
  studentId: string
  name: string
  quiz1: number
  quiz2: number
  activity: number
  performance: number
  exam: number
}

type AssessmentQuestion = {
  prompt: string
  options: string[]
}

type AssessmentAttempt = {
  id: string
  assessmentId: string
  studentId: string
  attemptNumber: number
  correctAnswers: number
  questionCount: number
  scorePercent: number
  submittedAt: string
}

const defaultGradingSettings: GradingSettings = {
  written: 20,
  performance: 30,
  exams: 50,
  passingGrade: 75,
}

function useApiRecords(resource: string) {
  const [records, setRecords] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    const loadRecords = () => {
      void apiFetch(`/api/records/${resource}`)
        .then(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok || !Array.isArray(payload)) {
            throw new Error(payload?.message || `Unable to load ${resource}.`)
          }
          return payload
        })
        .then((payload) => {
          if (!active) return
          setRecords(payload)
          setError("")
        })
        .catch((cause: unknown) => {
          if (active) {
            setError(
              cause instanceof Error
                ? cause.message
                : `Unable to load ${resource}.`,
            )
          }
        })
    }
    loadRecords()
    window.addEventListener("snhs-records-updated", loadRecords)
    return () => {
      active = false
      window.removeEventListener("snhs-records-updated", loadRecords)
    }
  }, [resource])
  return { records, error }
}

function useGradingSettings() {
  const { records } = useApiRecords("settings")
  const saved = records.find((record) => record.id === "lms-settings")
  const weights =
    saved?.weights && typeof saved.weights === "object"
      ? saved.weights as Record<string, unknown>
      : {}
  const result = {
    written: Number(weights.written),
    performance: Number(weights.performance),
    exams: Number(weights.exams),
    passingGrade: Number(saved?.passingGrade),
  }
  return Object.values(result).every(Number.isFinite) &&
    result.written + result.performance + result.exams === 100
    ? result
    : defaultGradingSettings
}

function calculateGradeBreakdown(
  score: RecordedScore,
  settings: GradingSettings = defaultGradingSettings,
) {
  const written =
    ((score.quiz1 + score.quiz2) / 40) * 50 + (score.activity / 50) * 50
  const performance = score.performance
  const exams = (score.exam / 50) * 100
  const final =
    written * (settings.written / 100) +
    performance * (settings.performance / 100) +
    exams * (settings.exams / 100)
  return { written, performance, exams, final }
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function Button({
  children,
  variant = "primary",
  icon,
  onClick,
  type = "button",
  disabled = false,
  title,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  icon?: IconName
  onClick?: () => void
  type?: "button" | "submit"
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon && <Icon name={icon} size={17} />}
      <span>{children}</span>
    </button>
  )
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: string
}) {
  const value = String(children).toLowerCase().replace(/ /g, "-")
  return <span className={`badge badge-${tone || value}`}>{children}</span>
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={`card ${className}`}>{children}</section>
}

function SecureAssessment({ children }: { children: React.ReactNode }) {
  const blockAction = (event: React.SyntheticEvent) => event.preventDefault()
  const blockShortcut = (event: React.KeyboardEvent) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      ["c", "v", "x"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault()
    }
  }

  return (
    <div
      className="secure-assessment"
      onCopy={blockAction}
      onCut={blockAction}
      onPaste={blockAction}
      onContextMenu={blockAction}
      onDragStart={blockAction}
      onKeyDownCapture={blockShortcut}
    >
      {children}
    </div>
  )
}

function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

function SearchFilter({
  placeholder = "Search records...",
  value,
  onChange,
}: {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <div className="filter-row">
      <label className="search-box">
        <Icon name="search" size={18} />
        <input
          aria-label="Search"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
        />
      </label>
    </div>
  )
}

function DataTable({
  headers,
  rows,
  actions = true,
  onView,
  onEdit,
  onDelete,
  paginate = false,
  pageSize = 5,
}: {
  headers: string[]
  rows: (string | React.ReactNode)[][]
  actions?: boolean
  onView?: (index: number) => void
  onEdit?: (index: number) => void
  onDelete?: (index: number) => void
  paginate?: boolean
  pageSize?: number
}) {
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortDirection, setSortDirection] =
    useState<"ascending" | "descending">("ascending")
  const [tablePage, setTablePage] = useState(1)
  useEffect(() => {
    setTablePage(1)
  }, [rows.length])
  const sortableColumns = headers.map((_, columnIndex) =>
    rows.every(
      (row) =>
        typeof row[columnIndex] === "string" ||
        typeof row[columnIndex] === "number",
    ),
  )
  const displayedRows = rows
    .map((row, originalIndex) => ({ row, originalIndex }))
    .sort((first, second) => {
      if (sortColumn === null) return 0
      const firstValue = String(first.row[sortColumn] ?? "")
      const secondValue = String(second.row[sortColumn] ?? "")
      const comparison = firstValue.localeCompare(secondValue, "en-PH", {
        numeric: true,
        sensitivity: "base",
      })
      return sortDirection === "ascending" ? comparison : -comparison
    })
  const visibleRows = paginate
    ? displayedRows.slice((tablePage - 1) * pageSize, tablePage * pageSize)
    : displayedRows
  const updateSort = (columnIndex: number) => {
    if (!sortableColumns[columnIndex]) return
    if (sortColumn === columnIndex) {
      setSortDirection((direction) =>
        direction === "ascending" ? "descending" : "ascending",
      )
    } else {
      setSortColumn(columnIndex)
      setSortDirection("ascending")
    }
    setTablePage(1)
  }
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h, columnIndex) => (
                <th
                  key={h}
                  aria-sort={
                    sortColumn === columnIndex ? sortDirection : undefined
                  }
                >
                  {sortableColumns[columnIndex] ? (
                    <button
                      className="table-sort"
                      onClick={() => updateSort(columnIndex)}
                    >
                      {h}
                      <Icon name="chevron" size={12} />
                    </button>
                  ) : (
                    h
                  )}
                </th>
              ))}
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ row, originalIndex }) => (
              <tr key={originalIndex}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
                {actions && (
                  <td>
                    <div className="row-actions">
                      {onView && (
                        <button
                          aria-label="View"
                          onClick={() => onView(originalIndex)}
                        >
                          <Icon name="eye" size={17} />
                        </button>
                      )}
                      {onEdit && (
                        <button
                          aria-label="Edit"
                          onClick={() => onEdit(originalIndex)}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          aria-label="Delete"
                          title="Delete"
                          onClick={() => onDelete(originalIndex)}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginate && (
        <Pagination
          total={rows.length}
          pageSize={pageSize}
          page={tablePage}
          onPageChange={setTablePage}
        />
      )}
    </>
  )
}

function Modal({
  title,
  children,
  close,
}: {
  title: string
  children: React.ReactNode
  close: () => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">SNSHS LMS</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AdminDeleteDialog({
  kind,
  recordName,
  recordId,
  close,
  onDeleted,
}: {
  kind: "students" | "teachers" | "subjects" | "classes"
  recordName: string
  recordId: string
  close: () => void
  onDeleted: () => void
}) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const confirmDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    let session: { role?: Role } | null = null
    try {
      session = JSON.parse(localStorage.getItem("snhs-demo-session") || "null")
    } catch {
      setError("Your administrator session is invalid. Sign in again.")
      return
    }
    if (session?.role !== "admin") {
      setError("Sign in with an administrator account to continue.")
      return
    }

    setSubmitting(true)
    try {
      const response = await apiFetch(
        `/api/admin/records/${kind}/${encodeURIComponent(recordId)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to delete this record.")
      }
      onDeleted()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete this record.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Delete ${recordName}?`} close={close}>
      <form onSubmit={confirmDelete}>
        <div className="recovery-body">
          <p>
            This action cannot be undone. Enter your administrator password to
            confirm deleting <strong>{recordName}</strong>.
          </p>
          <label className="field">
            <span>Administrator Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!password || submitting}
          >
            {submitting ? "Deleting..." : "Confirm Delete"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [recovery, setRecovery] = useState(0)
  const [schoolId, setSchoolId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const signIn = async () => {
    const normalizedId = schoolId.trim().toUpperCase()

    try {
      const response = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: normalizedId, password }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setError(payload?.message || "The school ID or password is incorrect.")
        return
      }

      const role = payload?.user?.role
      if (
        !["student", "teacher", "admin"].includes(role) ||
        typeof payload?.token !== "string"
      ) {
        setError("The server returned an invalid login response.")
        return
      }

      localStorage.setItem("snhs-session-token", payload.token)
      localStorage.setItem(
        "snhs-demo-session",
        JSON.stringify({ schoolId: normalizedId, role }),
      )
      setError("")
      onLogin(role as Role)
    } catch {
      setError(
        "Unable to reach the LMS server. Check your connection and try again.",
      )
    }
  }

  return (
    <main className="login-page">
      <div className="login-accent accent-one" />
      <div className="login-accent accent-two" />
      <div className="login-wrap">
        <Card className="login-card">
          <div className="school-mark">
            <img src={logo} alt="St. Nicholas Senior High School" />
          </div>
          <div className="login-title">
            <p className="overline">WELCOME TO SNSHS LMS</p>
            <h1>
              St. Nicholas Senior
              <br />
              High School
            </h1>
            <p>Sign in with your assigned school account.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void signIn()
            }}
          >
            <label className="field">
              <span>School ID</span>
              <div>
                <Icon name="user" size={19} />
                <input
                  required
                  value={schoolId}
                  onChange={(event) => {
                    setSchoolId(event.target.value)
                    setError("")
                  }}
                  autoComplete="username"
                  placeholder="Enter your school ID"
                  aria-label="School ID"
                />
              </div>
            </label>
            <label className="field">
              <span>Password</span>
              <div>
                <Icon name="settings" size={19} />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError("")
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  aria-label="Password"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name="eye" size={18} />
                </button>
              </div>
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit">LOG IN</Button>
          </form>
          <button className="forgot-link" onClick={() => setRecovery(1)}>
            Forgot your password?
          </button>
        </Card>
      </div>
      {recovery > 0 && (
        <div className="modal-backdrop">
          <div className="modal recovery-modal">
            <div className="modal-head">
              <div>
                <span className="eyebrow">ACCOUNT RECOVERY</span>
                <h2>Password assistance</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close password recovery"
                onClick={() => setRecovery(0)}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="recovery-body">
              <span className="recovery-icon">
                <Icon name="user" size={24} />
              </span>
              <p>
                Password reset is not configured for this system. Contact your
                school administrator for help; no password has been changed.
              </p>
              <div className="modal-actions">
                <Button variant="ghost" onClick={() => setRecovery(0)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "green",
}: {
  icon: IconName
  label: string
  value: string
  detail: string
  tone?: string
}) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon stat-${tone}`}>
        <Icon name={icon} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </Card>
  )
}

function Dashboard({
  role,
  userId,
  navigate,
}: {
  role: Role
  userId: string
  navigate: (page: string) => void
}) {
  type DashboardStats = {
    totals?: {
      students: number
      teachers: number
      subjects: number
      sections: number
      enrollments: number
    }
    myClasses?: number
    myStudents?: number
    mySubjects?: number
    gradeLevel?: string
    gradeDistribution: { gradeLevel: string; count: number }[]
    classes: {
      id: string
      subject: string
      teacher: string
      room: string
      schedule: string
      color: string
    }[]
  }
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null,
  )
  const [dashboardError, setDashboardError] = useState("")
  const { records: upcomingAssignments, error: upcomingAssignmentError } =
    useApiRecords("assignments")
  const { records: upcomingAssessments, error: upcomingAssessmentError } =
    useApiRecords("assessments")
  const schoolTime = useSchoolTime()
  useEffect(() => {
    let active = true
    setDashboardStats(null)
    setDashboardError("")
    void apiFetch("/api/dashboard/stats")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(
            payload?.message || "Unable to load dashboard statistics.",
          )
        }
        return payload as DashboardStats
      })
      .then((payload) => {
        if (active) setDashboardStats(payload)
      })
      .catch((error: unknown) => {
        if (active) {
          setDashboardError(
            error instanceof Error
              ? error.message
              : "Unable to load dashboard statistics.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [userId])

  const upcomingRecords: Array<Record<string, unknown> & { kind: string }> = [
    ...upcomingAssignments.map((record) => ({ ...record, kind: "Assignment" })),
    ...upcomingAssessments.map((record) => ({
      ...record,
      kind: String(record.type || "Assessment").toUpperCase(),
    })),
  ]
  const upcomingItems: Array<Record<string, unknown> & {
    kind: string
    due: Date
  }> = upcomingRecords
    .map((record) => ({
      ...record,
      due: new Date(String(record.dueDate || record.availableDate || "")),
    }))
    .filter((record) => !Number.isNaN(record.due.getTime()))
    .sort((left, right) => left.due.getTime() - right.due.getTime())
    .slice(0, 3)
  const loadingDetail = dashboardError ? "Unavailable" : "Loading live data"
  const stats =
    role === "admin"
      ? [
          {
            icon: "users" as IconName,
            label: "Total Students",
            value: dashboardStats?.totals
              ? String(dashboardStats.totals.students)
              : "—",
            detail: dashboardStats ? "Registered students" : loadingDetail,
            tone: "green",
          },
          {
            icon: "briefcase" as IconName,
            label: "Total Teachers",
            value: dashboardStats?.totals
              ? String(dashboardStats.totals.teachers)
              : "—",
            detail: dashboardStats ? "Registered teachers" : loadingDetail,
            tone: "blue",
          },
          {
            icon: "layers" as IconName,
            label: "Total Subjects",
            value: dashboardStats?.totals
              ? String(dashboardStats.totals.subjects)
              : "—",
            detail: dashboardStats ? "Database records" : loadingDetail,
            tone: "violet",
          },
          {
            icon: "book" as IconName,
            label: "Total Sections",
            value: dashboardStats?.totals
              ? String(dashboardStats.totals.sections)
              : "—",
            detail: dashboardStats ? "Database records" : loadingDetail,
            tone: "amber",
          },
          {
            icon: "check" as IconName,
            label: "Total Enrollments",
            value: dashboardStats?.totals
              ? String(dashboardStats.totals.enrollments)
              : "—",
            detail: dashboardStats
              ? "Active subject enrollments"
              : loadingDetail,
            tone: "blue",
          },
        ]
      : role === "teacher"
        ? [
            {
              icon: "book" as IconName,
              label: "My Classes",
              value: dashboardStats
                ? String(dashboardStats.myClasses || 0)
                : "—",
              detail: dashboardStats ? "Assigned offerings" : loadingDetail,
              tone: "green",
            },
            {
              icon: "users" as IconName,
              label: "My Students",
              value: dashboardStats
                ? String(dashboardStats.myStudents || 0)
                : "—",
              detail: dashboardStats
                ? "Across assigned classes"
                : loadingDetail,
              tone: "blue",
            },
          ]
        : [
            {
              icon: "book" as IconName,
              label: "My Classes",
              value: dashboardStats
                ? String(dashboardStats.myClasses || 0)
                : "—",
              detail: dashboardStats ? "Current enrollments" : loadingDetail,
              tone: "green",
            },
            {
              icon: "layers" as IconName,
              label: "My Subjects",
              value: dashboardStats
                ? String(dashboardStats.mySubjects || 0)
                : "—",
              detail: dashboardStats ? "Current enrollments" : loadingDetail,
              tone: "blue",
            },
          ]
  return (
    <>
      <section className="welcome">
        <div>
          <p className="overline">
            {role === "admin" ? "SYSTEM OVERVIEW · " : ""}
            {schoolTime.date.toUpperCase()} · {schoolTime.time} PHT
          </p>
          <h1>{schoolTime.greeting}</h1>
          <p>Your school information and activity are shown here.</p>
        </div>
        <div className="welcome-badge">
          <img src={logo} alt="" />
          <div>
            <small>ACCOUNT ROLE</small>
            <strong>{role === "admin" ? "Administrator" : role}</strong>
          </div>
        </div>
      </section>
      <div className="stat-grid">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
            tone={stat.tone}
          />
        ))}
      </div>
      {dashboardError && (
        <p className="form-error" role="alert">
          {dashboardError}
        </p>
      )}
      <div className="dashboard-grid">
        <Card className="span-two">
          <div className="card-head">
            <div>
              <h2>
                {role === "admin" ? "Enrollment overview" : "Today’s Classes"}
              </h2>
              <p>
                {role === "admin"
                  ? "Student distribution by grade level"
                  : `Your schedule for ${schoolTime.date}`}
              </p>
            </div>
            <button onClick={() => navigate("classes")}>
              View all <Icon name="arrow" size={15} />
            </button>
          </div>
          {role === "admin" ? (
            dashboardStats ? (
              dashboardStats.gradeDistribution.length ? (
                <div className="enrollment-bars">
                  {dashboardStats.gradeDistribution.map((grade) => (
                    <div key={grade.gradeLevel}>
                      <span>{grade.gradeLevel}</span>
                      <div>
                        <i
                          style={{
                            width: `${
                              dashboardStats.totals?.students
                                ? (grade.count /
                                    dashboardStats.totals.students) *
                                  100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <strong>{grade.count}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  No student records to display.
                </p>
              )
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading enrollment data...
              </p>
            )
          ) : dashboardStats?.classes.length ? (
            <DataTable
              actions={false}
              headers={["Subject", "Teacher", "Room", "Time"]}
              rows={dashboardStats.classes.slice(0, 3).map((classItem) => [
                <div className="subject-cell" key={classItem.id}>
                  <span className={`dot ${classItem.color}`} />
                  <b>{classItem.subject}</b>
                </div>,
                classItem.teacher,
                classItem.room || "—",
                classItem.schedule.split("· ").pop() || "—",
              ])}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              {dashboardStats
                ? "No classes are currently assigned or enrolled."
                : "Loading class data..."}
            </p>
          )}
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h2>
                {role === "teacher"
                  ? "Teacher Announcements"
                  : "Recent Activity"}
              </h2>
              <p>
                {role === "teacher"
                  ? "Updates you published for your students"
                  : "Latest updates"}
              </p>
            </div>
            <button
              onClick={() =>
                navigate(
                  role === "teacher"
                    ? "announcements"
                    : role === "admin"
                      ? "activity-logs"
                      : "notifications",
                )
              }
            >
              View all <Icon name="arrow" size={15} />
            </button>
          </div>
          <div className="activity-list">
            <p className="empty-state">No recent activity to display.</p>
          </div>
        </Card>
        {role === "student" && (
          <Card className="span-three assessment-strip">
            <div className="card-head">
              <div>
                <h2>Upcoming Quizzes & Exams</h2>
                <p>Plan ahead and stay prepared</p>
              </div>
              <button onClick={() => navigate("classes")}>
                View all <Icon name="arrow" size={15} />
              </button>
            </div>
            {(upcomingAssignmentError || upcomingAssessmentError) && (
              <p className="form-error" role="alert">
                {upcomingAssignmentError || upcomingAssessmentError}
              </p>
            )}
            {upcomingItems.length ? (
              <div className="upcoming-grid">
                {upcomingItems.map((item) => {
                  const kind = String(item.kind)
                  const destination =
                    kind === "Assignment"
                      ? "assignments"
                      : kind === "EXAM"
                        ? "exams"
                        : "quizzes"
                  return (
                    <button
                      className="upcoming-card"
                      key={String(item.id)}
                      onClick={() => navigate(destination)}
                    >
                      <div className="date-block">
                        <span>
                          {item.due.toLocaleDateString("en-PH", {
                            month: "short",
                          })}
                        </span>
                        <strong>{item.due.getDate()}</strong>
                      </div>
                      <div>
                        <b>{String(item.title || "")}</b>
                        <p>{String(item.subject || "")}</p>
                        <small>
                          <Icon name="clock" size={13} />
                          {item.due.toLocaleString("en-PH")} · {kind}
                        </small>
                      </div>
                      <Icon name="arrow" size={18} />
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="empty-state">No upcoming items to display.</p>
            )}
          </Card>
        )}
      </div>
    </>
  )
}

function ClassesPage({
  role,
  userId,
  navigate,
  openClass = () => navigate("class-details"),
}: {
  role: Role
  userId?: string
  navigate: (s: string) => void
  openClass?: (code: string) => void
}) {
  type ClassCardRecord = ClassRecord
  type StudentClassSection = {
    code: string
    name: string
    gradeLevel: string
    strand: string
    schoolYear: string
    section: string
  }
  const [classRecords, setClassRecords] = useState<ClassCardRecord[]>([])
  const [studentClassSection, setStudentClassSection] =
    useState<StudentClassSection | null>(null)
  const [classEditor, setClassEditor] = useState<"create" | "edit" | null>(null)
  const [classEditorIndex, setClassEditorIndex] = useState<number | null>(null)
  const [classDraft, setClassDraft] = useState<ClassRecord>({
    ...emptyClassRecord,
  })
  const [classError, setClassError] = useState("")
  const [teacherOptions, setTeacherOptions] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  useEffect(() => {
    let active = true
    const endpoint = role === "admin" ? "/api/classes" : "/api/subject-sections"
    const requests: Promise<Response>[] = [apiFetch(endpoint)]
    if (role === "student" && userId) {
      requests.push(
        apiFetch(`/api/students/${encodeURIComponent(userId)}/class-section`),
      )
    }
    void Promise.all(requests)
      .then(async (response) => {
        const [classResponse, sectionResponse] = response
        const classPayload = await classResponse.json().catch(() => null)
        if (!classResponse.ok || !Array.isArray(classPayload)) {
          throw new Error(classPayload?.message || "Unable to load classes.")
        }
        let sectionPayload: StudentClassSection | null = null
        if (sectionResponse) {
          const responsePayload = await sectionResponse.json().catch(() => null)
          if (sectionResponse.ok) {
            sectionPayload = responsePayload
          } else if (sectionResponse.status !== 404) {
            throw new Error(
              responsePayload?.message || "Unable to load your class section.",
            )
          }
        }
        return { classPayload, sectionPayload }
      })
      .then(({ classPayload, sectionPayload }) => {
        if (!active) return
        setStudentClassSection(sectionPayload)
        const records =
          role === "admin"
            ? classPayload.map((item) => ({
                ...item,
                subject: String(item.subject || item.name || ""),
              }))
            : classPayload.map((item) => ({
                subject: String(item.subjectName || ""),
                code: String(item.id),
                teacher: String(item.teacher || ""),
                room: String(item.room || ""),
                schedule: String(item.schedule || ""),
                color: String(item.color || "emerald"),
                gradeLevel: String(item.gradeLevel || ""),
                strand: String(item.strand || ""),
                schoolYear: String(item.schoolYear || ""),
                classSectionName: String(item.classSectionName || ""),
              }))
        setClassRecords(records)
      })
      .catch((error: unknown) => {
        if (active) {
          setClassError(
            error instanceof Error ? error.message : "Unable to load classes.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [role, userId])
  useEffect(() => {
    if (role !== "admin") return
    let active = true
    void apiFetch("/api/teachers")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(payload?.message || "Unable to load teachers.")
        }
        return payload
      })
      .then((payload) => {
        if (active) {
          setTeacherOptions(payload.map((teacher) => String(teacher.name)))
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setClassError(
            error instanceof Error ? error.message : "Unable to load teachers.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [role])
  const visibleClasses = role === "teacher" ? classRecords : classRecords
  const openClassEditor = (index?: number) => {
    if (index === undefined) {
      setClassEditor("create")
      setClassEditorIndex(null)
      setClassDraft({ ...emptyClassRecord })
    } else {
      setClassEditor("edit")
      setClassEditorIndex(index)
      setClassDraft({ ...visibleClasses[index] })
    }
  }
  const closeClassEditor = () => {
    setClassEditor(null)
    setClassEditorIndex(null)
  }
  const saveClassRecord = async () => {
    setClassError("")
    const isCreating = classEditor === "create"
    if (
      !classDraft.subject.trim() ||
      !classDraft.code.trim() ||
      !classDraft.gradeLevel.trim() ||
      !classDraft.strand.trim() ||
      !classDraft.schoolYear.trim() ||
      !classDraft.teacher.trim()
    ) {
      setClassError(
        "Class name, code, grade level, strand, school year, and teacher are required.",
      )
      return
    }
    const originalCode =
      classEditorIndex === null
        ? ""
        : visibleClasses[classEditorIndex]?.code || ""
    try {
      const response = await apiFetch(
        isCreating
          ? "/api/classes"
          : `/api/classes/${encodeURIComponent(originalCode)}`,
        {
          method: isCreating ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(classDraft),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.classSection) {
        throw new Error(payload?.message || "Unable to save the class section.")
      }
      const saved = {
        ...payload.classSection,
        subject: String(payload.classSection.subject || ""),
      }
      const next = isCreating
        ? [...classRecords, saved]
        : classRecords.map((classItem) =>
            classItem.code === originalCode ? saved : classItem,
          )
      setClassRecords(next)
      closeClassEditor()
    } catch (error) {
      setClassError(
        error instanceof Error
          ? error.message
          : "Unable to save the class section.",
      )
    }
  }
  const requestClassDelete = () => {
    if (classEditorIndex === null) return
    const classRecord = visibleClasses[classEditorIndex]
    if (!classRecord) return
    setDeleteTarget({ id: classRecord.code, name: classRecord.subject })
    closeClassEditor()
  }
  return (
    <>
      <PageHeading
        title={
          role === "admin"
            ? "Class Section Management"
            : role === "student"
              ? "My Subjects"
              : "My Class Sections"
        }
        description={
          role === "admin"
            ? "Create and manage class sections for the current school year."
            : role === "teacher"
              ? "Class sections assigned to you this semester."
              : "Subjects assigned to your class section for the current term."
        }
        action={
          role === "admin" ? (
            <Button icon="plus" onClick={() => openClassEditor()}>
              Create Class Section
            </Button>
          ) : undefined
        }
      />
      {classError && (
        <p className="form-error" role="alert">
          {classError}
        </p>
      )}
      {role === "student" && studentClassSection && (
        <Card className="table-card">
          <label className="field">
            <span>Strand</span>
            <select value={studentClassSection.strand} disabled>
              {studentStrandOptions.map((strand) => (
                <option key={strand} value={strand}>
                  {strand}
                </option>
              ))}
            </select>
          </label>
          <p className="attachment-help">
            Section {studentClassSection.section} · {studentClassSection.name} ·{" "}
            {studentClassSection.gradeLevel}
          </p>
        </Card>
      )}
      <div className="class-grid">
        {visibleClasses.map((c, i) => (
          <Card className="class-card" key={c.code}>
            <div className={`class-cover cover-${c.color}`}>
              <span>{c.code}</span>
              <Icon
                name={i === 3 ? "activity" : i === 2 ? "layers" : "book"}
                size={36}
              />
            </div>
            <div className="class-body">
              <div className="class-title">
                <div>
                  <p>{c.code}</p>
                  <h2>{c.subject}</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>
                    <Icon name="user" size={15} />
                    Teacher
                  </dt>
                  <dd>{role === "teacher" ? "You" : c.teacher}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="users" size={15} />
                    Class Section
                  </dt>
                  <dd>
                    {c.classSectionName ||
                      [c.gradeLevel, c.strand].filter(Boolean).join(" · ") ||
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Icon name="room" size={15} />
                    Room
                  </dt>
                  <dd>{c.room}</dd>
                </div>
                <div>
                  <dt>
                    <Icon name="calendar" size={15} />
                    Schedule
                  </dt>
                  <dd>{c.schedule}</dd>
                </div>
              </dl>
              <div className="class-actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (role === "admin") openClassEditor(i)
                    else openClass(c.code)
                  }}
                >
                  {role === "admin"
                    ? "MANAGE CLASS SECTION"
                    : role === "teacher"
                      ? "OPEN CLASS SECTION"
                      : "OPEN SUBJECT"}
                </Button>{" "}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {role === "student" && !visibleClasses.length && !classError && (
        <p className="empty-state">
          No subjects are currently offered for your grade and class section.
        </p>
      )}
      {role === "admin" && classEditor && (
        <Modal
          title={
            classEditor === "create"
              ? "Create Class Section"
              : "Manage Class Section"
          }
          close={closeClassEditor}
        >
          <div className="modal-form">
            <label className="field">
              <span>Class Section Name</span>
              <input
                value={classDraft.subject}
                onChange={(event) =>
                  setClassDraft({ ...classDraft, subject: event.target.value })
                }
                placeholder="Enter class section name"
              />
            </label>
            <label className="field">
              <span>Class Section Code</span>
              <input
                value={classDraft.code}
                onChange={(event) =>
                  setClassDraft({
                    ...classDraft,
                    code: event.target.value.toUpperCase(),
                  })
                }
                placeholder="Enter class section code"
              />
            </label>
            <label className="field">
              <span>Grade Level</span>
              <select
                value={classDraft.gradeLevel}
                required
                onChange={(event) =>
                  setClassDraft({
                    ...classDraft,
                    gradeLevel: event.target.value,
                  })
                }
              >
                <option value="">Select a grade level</option>
                <option>Grade 11</option>
                <option>Grade 12</option>
              </select>
            </label>
            <label className="field">
              <span>Strand</span>
              <select
                value={classDraft.strand}
                required
                onChange={(event) =>
                  setClassDraft({ ...classDraft, strand: event.target.value })
                }
              >
                <option value="">Select a strand</option>
                {studentStrandOptions.map((strand) => (
                  <option key={strand}>{strand}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>School Year</span>
              <input
                value={classDraft.schoolYear}
                required
                onChange={(event) =>
                  setClassDraft({
                    ...classDraft,
                    schoolYear: event.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              <span>Assigned Teacher</span>
              <select
                value={classDraft.teacher}
                required
                onChange={(event) =>
                  setClassDraft({ ...classDraft, teacher: event.target.value })
                }
              >
                <option value="">Select a teacher</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher}>{teacher}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Room</span>
              <input
                value={classDraft.room}
                onChange={(event) =>
                  setClassDraft({ ...classDraft, room: event.target.value })
                }
                placeholder="Room or laboratory"
              />
            </label>
            <label className="field full">
              <span>Class Schedule</span>
              <input
                value={classDraft.schedule}
                onChange={(event) =>
                  setClassDraft({ ...classDraft, schedule: event.target.value })
                }
                placeholder="Example: Mon / Wed · 8:00–9:30 AM"
              />
            </label>
            <label className="field">
              <span>Card Color</span>
              <select
                value={classDraft.color}
                onChange={(event) =>
                  setClassDraft({ ...classDraft, color: event.target.value })
                }
              >
                <option value="emerald">Emerald</option>
                <option value="blue">Blue</option>
                <option value="amber">Amber</option>
                <option value="violet">Violet</option>
              </select>
            </label>
          </div>
          <div className="modal-actions class-editor-actions">
            {classEditor === "edit" && (
              <Button variant="danger" onClick={requestClassDelete}>
                Delete Class Section
              </Button>
            )}
            <Button variant="ghost" onClick={closeClassEditor}>
              Cancel
            </Button>
            <Button
              onClick={saveClassRecord}
              disabled={
                !classDraft.subject.trim() ||
                !classDraft.code.trim() ||
                !classDraft.room.trim() ||
                !classDraft.schedule.trim()
              }
            >
              {classEditor === "create"
                ? "Create Class Section"
                : "Save Changes"}
            </Button>
          </div>
        </Modal>
      )}
      {role === "admin" && deleteTarget && (
        <AdminDeleteDialog
          kind="classes"
          recordId={deleteTarget.id}
          recordName={`Class Section ${deleteTarget.name}`}
          close={() => setDeleteTarget(null)}
          onDeleted={() => {
            const next = classRecords.filter(
              (classItem) => classItem.code !== deleteTarget.id,
            )
            setClassRecords(next)
            setDeleteTarget(null)
            setClassError("")
          }}
        />
      )}
    </>
  )
}

function MaterialsPage({
  role,
  openModal,
}: {
  role: Role
  openModal: (s: string) => void
}) {
  const { records, error } = useApiRecords("materials")
  const [search, setSearch] = useState("")
  const [selectedMaterial, setSelectedMaterial] =
    useState<Record<string, unknown> | null>(null)
  const filteredRecords = records.filter((record) =>
    [record.title, record.subject, record.description].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
  )

  return (
    <>
      <PageHeading
        title="Learning Materials"
        description={
          role === "student"
            ? "Access resources shared by your teachers."
            : "Manage learning resources for your classes."
        }
        action={
          role !== "student" ? (
            <Button
              icon="plus"
              onClick={() => openModal("Add Learning Material")}
            >
              Add Material
            </Button>
          ) : undefined
        }
      />
      <SearchFilter
        placeholder="Search materials by title or subject..."
        value={search}
        onChange={setSearch}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="material-grid">
        {filteredRecords.map((material, i) => (
          <Card className="material-card" key={String(material.id)}>
            <div className={`file-icon file-${i}`}>
              <Icon name="file" size={25} />
              <small>{String(material.type || "FILE")}</small>
            </div>
            <div className="material-info">
              <div>
                <Badge tone="published">
                  {String(material.status || "Published")}
                </Badge>
                <span>
                  {String(material.updatedAt || material.createdAt || "")}
                </span>
              </div>
              <h2>{String(material.title || "")}</h2>
              <p>{String(material.description || "")}</p>
              <dl>
                <div>
                  <dt>Subject</dt>
                  <dd>{String(material.subject || "—")}</dd>
                </div>
              </dl>
              <Button
                variant="secondary"
                icon="eye"
                onClick={() => setSelectedMaterial(material)}
              >
                View material
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {!filteredRecords.length && !error && (
        <p className="empty-state">
          {search
            ? "No materials match your search."
            : "No learning materials have been added yet."}
        </p>
      )}
      {selectedMaterial && (
        <Modal
          title={String(selectedMaterial.title || "Learning material")}
          close={() => setSelectedMaterial(null)}
        >
          <div className="record-details">
            <div>
              <span>Subject</span>
              <strong>{String(selectedMaterial.subject || "—")}</strong>
            </div>
            <div>
              <span>Type</span>
              <strong>{String(selectedMaterial.type || "—")}</strong>
            </div>
            <div>
              <span>Description</span>
              <strong>{String(selectedMaterial.description || "—")}</strong>
            </div>
            {typeof selectedMaterial.fileData === "string" && (
              <a
                href={selectedMaterial.fileData}
                download={String(
                  selectedMaterial.fileName ||
                    selectedMaterial.title ||
                    "learning-material",
                )}
              >
                Download file
              </a>
            )}
            {!selectedMaterial.fileData &&
              typeof selectedMaterial.url === "string" && (
                <a href={selectedMaterial.url} target="_blank" rel="noreferrer">
                  Open file
                </a>
              )}
          </div>
        </Modal>
      )}
    </>
  )
}

function AssignmentsPage({
  role,
  openModal,
  userId,
}: {
  role: Role
  openModal: (s: string) => void
  userId: string
}) {
  const { records, error } = useApiRecords("assignments")
  const { records: submissions } = useApiRecords("submissions")
  const [selectedAssignment, setSelectedAssignment] =
    useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)
  const [savingError, setSavingError] = useState("")
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [assignmentTab, setAssignmentTab] =
    useState<"all" | "todo" | "submitted" | "graded">("all")
  const [localSubmittedIds, setLocalSubmittedIds] = useState<string[]>([])
  const getAssignmentSubmission = (assignment: Record<string, unknown>) =>
    submissions.find(
      (submission) =>
        String(submission.assignmentId || "") === String(assignment.id || "") &&
        String(submission.ownerId || "") === userId,
    )
  const assignmentSubmitted = (assignment: Record<string, unknown>) =>
    Boolean(getAssignmentSubmission(assignment)) ||
    localSubmittedIds.includes(String(assignment.id))
  const assignmentGraded = (assignment: Record<string, unknown>) =>
    getAssignmentSubmission(assignment)?.status === "Graded"
  const matchingAssignments = records.filter((assignment) =>
    [assignment.title, assignment.subject, assignment.description].some(
      (value) =>
        String(value || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ),
  )
  const visibleAssignments = matchingAssignments.filter((assignment) => {
    if (role !== "student" || assignmentTab === "all") return true
    if (assignmentTab === "todo") return !assignmentSubmitted(assignment)
    if (assignmentTab === "graded") return assignmentGraded(assignment)
    return assignmentSubmitted(assignment) && !assignmentGraded(assignment)
  })
  const saveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAssignment?.id) return
    setSaving(true)
    setSavingError("")
    const form = new FormData(event.currentTarget)
    const payload = {
      ...selectedAssignment,
      title: String(form.get("title") || "").trim(),
      description: String(form.get("description") || "").trim(),
      dueDate: String(form.get("dueDate") || ""),
      points: String(form.get("points") || ""),
      status: String(form.get("status") || "Draft"),
    }
    try {
      const response = await apiFetch(
        `/api/records/assignments/${encodeURIComponent(String(selectedAssignment.id))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scopeId: String(selectedAssignment.scopeId || ""),
            payload,
          }),
        },
      )
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.record) {
        throw new Error(result?.message || "Unable to update the assignment.")
      }
      setSelectedAssignment(null)
    } catch (cause) {
      setSavingError(
        cause instanceof Error
          ? cause.message
          : "Unable to update the assignment.",
      )
    } finally {
      setSaving(false)
    }
  }
  const submitAssignment = async () => {
    if (!selectedAssignment?.id || !userId) return
    setSaving(true)
    setSavingError("")
    const assignmentId = String(selectedAssignment.id)
    try {
      const response = await apiFetch(`/api/records/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `${assignmentId}:${userId}`,
          scopeId: String(selectedAssignment.scopeId || ""),
          ownerId: userId,
          payload: {
            assignmentId,
            title: String(selectedAssignment.title || ""),
            status: "Submitted",
            submittedAt: new Date().toISOString(),
          },
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.record) {
        throw new Error(result?.message || "Unable to submit the assignment.")
      }
      setLocalSubmittedIds((current) =>
        current.includes(assignmentId) ? current : [...current, assignmentId],
      )
      setSelectedAssignment(null)
    } catch (cause) {
      setSavingError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit the assignment.",
      )
    } finally {
      setSaving(false)
    }
  }
  if (role === "student")
    return (
      <>
        <PageHeading
          title="Assignments"
          description="Track your work, deadlines, and submissions."
        />
        <div className="tabs">
          <button
            type="button"
            className={assignmentTab === "all" ? "active" : ""}
            aria-pressed={assignmentTab === "all"}
            onClick={() => setAssignmentTab("all")}
          >
            All Assignments <span>{matchingAssignments.length}</span>
          </button>
          <button
            type="button"
            className={assignmentTab === "todo" ? "active" : ""}
            aria-pressed={assignmentTab === "todo"}
            onClick={() => setAssignmentTab("todo")}
          >
            To Do{" "}
            <span>
              {
                matchingAssignments.filter((item) => !assignmentSubmitted(item))
                  .length
              }
            </span>
          </button>
          <button
            type="button"
            className={assignmentTab === "submitted" ? "active" : ""}
            aria-pressed={assignmentTab === "submitted"}
            onClick={() => setAssignmentTab("submitted")}
          >
            Submitted{" "}
            <span>
              {
                matchingAssignments.filter(
                  (item) =>
                    assignmentSubmitted(item) && !assignmentGraded(item),
                ).length
              }
            </span>
          </button>
          <button
            type="button"
            className={assignmentTab === "graded" ? "active" : ""}
            aria-pressed={assignmentTab === "graded"}
            onClick={() => setAssignmentTab("graded")}
          >
            Graded{" "}
            <span>{matchingAssignments.filter(assignmentGraded).length}</span>
          </button>
        </div>
        <div className="assignment-list">
          {visibleAssignments.map((assignment, i) => (
            <Card className="assignment-card" key={String(assignment.id)}>
              <div className={`assignment-icon a-${i}`}>
                <Icon name="check" />
              </div>
              <div className="assignment-main">
                <div>
                  <Badge>
                    {assignmentGraded(assignment)
                      ? "Graded"
                      : assignmentSubmitted(assignment)
                        ? "Submitted"
                        : String(assignment.status || "Published")}
                  </Badge>
                  <span>{String(assignment.subject || "")}</span>
                </div>
                <h2>{String(assignment.title || "")}</h2>
                <p>{String(assignment.description || "")}</p>
                <div className="assignment-meta">
                  <span>
                    <Icon name="calendar" size={15} />
                    Due {String(assignment.dueDate || "—")}
                  </span>
                  <span>
                    <Icon name="award" size={15} />
                    {String(assignment.points || "—")} points
                  </span>
                </div>
              </div>
              <Button
                variant={
                  assignmentSubmitted(assignment) ? "secondary" : "primary"
                }
                onClick={() => {
                  setSelectedAssignment(assignment)
                  setEditing(false)
                  setSavingError("")
                }}
              >
                {assignmentSubmitted(assignment)
                  ? "View submission"
                  : "View assignment"}
              </Button>
            </Card>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!visibleAssignments.length && !error && (
          <p className="empty-state">
            {search
              ? "No assignments match your search."
              : assignmentTab === "all"
                ? "No assignments have been published for you yet."
                : `No ${
                    assignmentTab === "todo" ? "to-do" : assignmentTab
                  } assignments.`}
          </p>
        )}
        {selectedAssignment && (
          <Modal
            title={String(selectedAssignment.title || "Assignment")}
            close={() => setSelectedAssignment(null)}
          >
            <div className="recovery-body">
              <p>
                {String(
                  selectedAssignment.description ||
                    "No instructions were added.",
                )}
              </p>
              <p>Due: {String(selectedAssignment.dueDate || "—")}</p>
              {savingError && (
                <p className="form-error" role="alert">
                  {savingError}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <Button
                variant="ghost"
                onClick={() => setSelectedAssignment(null)}
              >
                Close
              </Button>
              {!assignmentSubmitted(selectedAssignment) && (
                <Button
                  onClick={() => void submitAssignment()}
                  disabled={saving || !userId}
                >
                  {saving ? "Submitting..." : "Submit assignment"}
                </Button>
              )}
            </div>
          </Modal>
        )}
      </>
    )
  const rows = visibleAssignments.map((assignment) => [
    <b>{String(assignment.title || "")}</b>,
    String(assignment.subject || ""),
    String(assignment.dueDate || "—"),
    submissions.filter(
      (submission) => submission.assignmentId === assignment.id,
    ).length,
    <Badge>{String(assignment.status || "Draft")}</Badge>,
  ])
  return (
    <>
      <PageHeading
        title="Assignments"
        description={
          role === "teacher"
            ? "Create assignments and monitor student submissions."
            : "Manage all assignments across the school."
        }
        action={
          <Button icon="plus" onClick={() => openModal("Create Assignment")}>
            Create Assignment
          </Button>
        }
      />
      <SearchFilter
        placeholder="Search assignments..."
        value={search}
        onChange={setSearch}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card className="table-card">
        <DataTable
          headers={[
            "Assignment",
            "Class / Subject",
            "Due Date",
            "Submissions",
            "Status",
          ]}
          rows={rows}
          onView={(index) => {
            setSelectedAssignment(visibleAssignments[index])
            setEditing(false)
          }}
          onEdit={(index) => {
            setSelectedAssignment(visibleAssignments[index])
            setEditing(true)
            setSavingError("")
          }}
          paginate
        />
      </Card>
      {!rows.length && !error && (
        <p className="empty-state">
          {search
            ? "No assignments match your search."
            : "No assignments have been created yet."}
        </p>
      )}
      {selectedAssignment && (
        <Modal
          title={
            editing
              ? "Edit Assignment"
              : String(selectedAssignment.title || "Assignment")
          }
          close={() => setSelectedAssignment(null)}
        >
          {editing ? (
            <form onSubmit={saveAssignment}>
              <div className="modal-form">
                <label className="field full">
                  <span>Title</span>
                  <input
                    name="title"
                    required
                    defaultValue={String(selectedAssignment.title || "")}
                  />
                </label>
                <label className="field full">
                  <span>Instructions</span>
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={String(selectedAssignment.description || "")}
                  />
                </label>
                <label className="field">
                  <span>Due Date</span>
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={String(selectedAssignment.dueDate || "")}
                  />
                </label>
                <label className="field">
                  <span>Points</span>
                  <input
                    name="points"
                    type="number"
                    min="1"
                    defaultValue={String(selectedAssignment.points || "")}
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    name="status"
                    defaultValue={String(selectedAssignment.status || "Draft")}
                  >
                    <option>Draft</option>
                    <option>Published</option>
                  </select>
                </label>
              </div>
              {savingError && (
                <p className="form-error" role="alert">
                  {savingError}
                </p>
              )}
              <div className="modal-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAssignment(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="recovery-body">
              <p>
                {String(
                  selectedAssignment.description ||
                    "No instructions were added.",
                )}
              </p>
              <p>Due: {String(selectedAssignment.dueDate || "—")}</p>
              <div className="modal-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAssignment(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function AssessmentsPage({
  role,
  openModal,
  userId,
  section = "all",
}: {
  role: Role
  openModal: (s: string) => void
  userId: string
  section?: "all" | "quizzes" | "exams"
}) {
  const { records, error } = useApiRecords("assessments")
  const [selectedAssessment, setSelectedAssessment] =
    useState<Record<string, unknown> | null>(null)
  const [editing, setEditing] = useState(false)
  const [savingError, setSavingError] = useState("")
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [assessmentTab, setAssessmentTab] = useState<"all" | "available">("all")
  const [assessmentQuestions, setAssessmentQuestions] =
    useState<AssessmentQuestion[]>([])
  const [assessmentAttempts, setAssessmentAttempts] =
    useState<AssessmentAttempt[]>([])
  const [assessmentAnswers, setAssessmentAnswers] = useState<number[]>([])
  const [assessmentLoadError, setAssessmentLoadError] = useState("")
  const [assessmentLoading, setAssessmentLoading] = useState(false)
  const [takingAssessment, setTakingAssessment] = useState(false)
  const matchingAssessments = records.filter((assessment) => {
    const type = String(assessment.type || "").toLowerCase()
    const typeMatches =
      section === "all" ||
      (section === "quizzes" && type === "quiz") ||
      (section === "exams" && type === "exam")
    return (
      typeMatches &&
      [assessment.title, assessment.subject].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      )
    )
  })
  const availableAssessments = matchingAssessments.filter((assessment) => {
    const availableDate = Date.parse(String(assessment.availableDate || ""))
    return (
      String(assessment.status || "").toLowerCase() === "published" &&
      (!Number.isFinite(availableDate) || availableDate <= Date.now())
    )
  })
  const visibleData =
    role === "student" && assessmentTab === "available"
      ? availableAssessments
      : matchingAssessments
  const selectedAssessmentDate = Date.parse(
    String(selectedAssessment?.availableDate || ""),
  )
  const selectedAssessmentIsScheduled =
    Number.isFinite(selectedAssessmentDate) &&
    selectedAssessmentDate > Date.now()
  const saveAssessment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedAssessment?.id) return
    setSaving(true)
    setSavingError("")
    const form = new FormData(event.currentTarget)
    const payload = {
      ...selectedAssessment,
      title: String(form.get("title") || "").trim(),
      questions: String(form.get("questions") || ""),
      duration: String(form.get("duration") || ""),
      attempts: String(form.get("attempts") || ""),
      passingScore: String(form.get("passingScore") || ""),
      availableDate: String(form.get("availableDate") || ""),
      status: String(form.get("status") || "Draft"),
    }
    try {
      const response = await apiFetch(
        `/api/records/assessments/${encodeURIComponent(String(selectedAssessment.id))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scopeId: String(selectedAssessment.scopeId || ""),
            payload,
          }),
        },
      )
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.record) {
        throw new Error(result?.message || "Unable to update the assessment.")
      }
      setSelectedAssessment(null)
    } catch (cause) {
      setSavingError(
        cause instanceof Error
          ? cause.message
          : "Unable to update the assessment.",
      )
    } finally {
      setSaving(false)
    }
  }
  const openStudentAssessment = async (assessment: Record<string, unknown>) => {
    setSelectedAssessment(assessment)
    setAssessmentQuestions([])
    setAssessmentAttempts([])
    setAssessmentAnswers([])
    setAssessmentLoadError("")
    setTakingAssessment(false)
    setAssessmentLoading(true)
    try {
      const assessmentId = encodeURIComponent(String(assessment.id || ""))
      const [questionsResponse, attemptsResponse] = await Promise.all([
        apiFetch(`/api/assessments/${assessmentId}/questions`),
        apiFetch(`/api/assessments/${assessmentId}/attempts`),
      ])
      const [questionsPayload, attemptsPayload] = await Promise.all([
        questionsResponse.json().catch(() => null),
        attemptsResponse.json().catch(() => null),
      ])
      if (
        !questionsResponse.ok ||
        !Array.isArray(questionsPayload?.questions)
      ) {
        throw new Error(
          questionsPayload?.message || "Unable to load assessment questions.",
        )
      }
      if (!attemptsResponse.ok || !Array.isArray(attemptsPayload)) {
        throw new Error(
          attemptsPayload?.message || "Unable to load assessment attempts.",
        )
      }
      setAssessmentQuestions(questionsPayload.questions)
      setAssessmentAttempts(attemptsPayload)
    } catch (cause) {
      setAssessmentLoadError(
        cause instanceof Error
          ? cause.message
          : "Unable to load this assessment.",
      )
    } finally {
      setAssessmentLoading(false)
    }
  }
  const submitAssessmentAttempt = async () => {
    if (!selectedAssessment?.id) return
    if (
      assessmentAnswers.length !== assessmentQuestions.length ||
      assessmentAnswers.some((answer) => answer < 0)
    ) {
      setAssessmentLoadError("Answer every question before submitting.")
      return
    }
    setSaving(true)
    setAssessmentLoadError("")
    try {
      const response = await apiFetch(
        `/api/assessments/${encodeURIComponent(String(selectedAssessment.id))}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: assessmentAnswers }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.attempt) {
        throw new Error(payload?.message || "Unable to submit this assessment.")
      }
      setAssessmentAttempts((current) => [...current, payload.attempt])
      setTakingAssessment(false)
    } catch (cause) {
      setAssessmentLoadError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit this assessment.",
      )
    } finally {
      setSaving(false)
    }
  }
  if (role === "student")
    return (
      <>
        <PageHeading
          title="Quizzes & Exams"
          description="View and complete your scheduled assessments."
        />
        <div className="tabs">
          <button
            type="button"
            className={assessmentTab === "all" ? "active" : ""}
            aria-pressed={assessmentTab === "all"}
            onClick={() => setAssessmentTab("all")}
          >
            All <span>{matchingAssessments.length}</span>
          </button>
          <button
            type="button"
            className={assessmentTab === "available" ? "active" : ""}
            aria-pressed={assessmentTab === "available"}
            onClick={() => setAssessmentTab("available")}
          >
            Available <span>{availableAssessments.length}</span>
          </button>
        </div>
        <div className="assessment-grid">
          {visibleData.map((assessment, i) => (
            <Card className="assessment-card" key={String(assessment.id)}>
              <div className="assessment-top">
                <span className={`assessment-type type-${i % 2}`}>
                  <Icon name="quiz" />
                  {String(assessment.type || "Assessment").toUpperCase()}
                </span>
                <Badge>{String(assessment.status || "Published")}</Badge>
              </div>
              <h2>{String(assessment.title || "")}</h2>
              <p>{String(assessment.subject || "")}</p>
              <div className="assessment-details">
                <div>
                  <strong>{String(assessment.questions || "—")}</strong>
                  <span>Questions</span>
                </div>
                <div>
                  <strong>{String(assessment.duration || "—")}</strong>
                  <span>Time limit</span>
                </div>
                <div>
                  <strong>{String(assessment.attempts || "—")}</strong>
                  <span>Attempts</span>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => void openStudentAssessment(assessment)}
              >
                Take assessment
              </Button>
            </Card>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!visibleData.length && !error && (
          <p className="empty-state">
            {assessmentTab === "available"
              ? "No assessments are currently available to take."
              : "No assessments are available yet."}
          </p>
        )}
        {selectedAssessment && (
          <Modal
            title={String(selectedAssessment.title || "Assessment")}
            close={() => {
              if (!saving) setSelectedAssessment(null)
            }}
          >
            <div className="recovery-body">
              <p>
                {String(
                  selectedAssessment.description ||
                    "No instructions were added.",
                )}
              </p>
              <p>
                {assessmentQuestions.length ||
                  String(selectedAssessment.questions || "—")}{" "}
                questions · {String(selectedAssessment.duration || "—")} minutes
              </p>
              {assessmentLoading && <p role="status">Loading assessment...</p>}
              {assessmentLoadError && (
                <p className="form-error" role="alert">
                  {assessmentLoadError}
                </p>
              )}
              {!assessmentLoading &&
                !assessmentLoadError &&
                !assessmentQuestions.length && (
                  <p>No questions have been configured for this assessment.</p>
                )}
              {assessmentAttempts.map((attempt) => (
                <p key={attempt.id}>
                  Attempt {attempt.attemptNumber}: {attempt.correctAnswers}/
                  {attempt.questionCount} correct · {attempt.scorePercent}%
                </p>
              ))}
              {takingAssessment && (
                <div className="assessment-attempt-questions">
                  {assessmentQuestions.map((question, questionIndex) => (
                    <fieldset
                      className="field full"
                      key={`${questionIndex}-${question.prompt}`}
                    >
                      <legend>
                        {questionIndex + 1}. {question.prompt}
                      </legend>
                      {question.options.map((option, optionIndex) => (
                        <label
                          className="assessment-answer-option"
                          key={optionIndex}
                        >
                          <input
                            type="radio"
                            name={`assessment-answer-${questionIndex}`}
                            checked={
                              assessmentAnswers[questionIndex] === optionIndex
                            }
                            onChange={() =>
                              setAssessmentAnswers((current) =>
                                current.map((answer, index) =>
                                  index === questionIndex
                                    ? optionIndex
                                    : answer,
                                ),
                              )
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <Button
                variant="ghost"
                onClick={() => setSelectedAssessment(null)}
                disabled={saving}
              >
                Close
              </Button>
              {takingAssessment ? (
                <Button
                  onClick={() => void submitAssessmentAttempt()}
                  disabled={
                    saving || assessmentAnswers.some((answer) => answer < 0)
                  }
                >
                  {saving ? "Submitting..." : "Submit answers"}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setAssessmentAnswers(assessmentQuestions.map(() => -1))
                    setAssessmentLoadError("")
                    setTakingAssessment(true)
                  }}
                  disabled={
                    assessmentLoading ||
                    selectedAssessmentIsScheduled ||
                    !assessmentQuestions.length ||
                    assessmentAttempts.length >=
                      Math.max(1, Number(selectedAssessment.attempts) || 1)
                  }
                >
                  {assessmentAttempts.length >=
                  Math.max(1, Number(selectedAssessment.attempts) || 1)
                    ? "No attempts remaining"
                    : selectedAssessmentIsScheduled
                      ? "Not available yet"
                      : "Start attempt"}
                </Button>
              )}
            </div>
          </Modal>
        )}
      </>
    )
  return (
    <>
      <PageHeading
        title={
          section === "quizzes"
            ? "Quiz Management"
            : section === "exams"
              ? "Exam Management"
              : "Quiz & Exam Management"
        }
        description={
          role === "teacher"
            ? "Create quizzes and exams for your classes."
            : `Review all ${
                section === "all" ? "quizzes and exams" : section
              } in the system.`
        }
        action={
          <div className="button-group">
            {section !== "exams" && (
              <Button
                variant="secondary"
                icon="plus"
                onClick={() => openModal("Create Quiz")}
              >
                Create Quiz
              </Button>
            )}
            {section !== "quizzes" && (
              <Button icon="plus" onClick={() => openModal("Create Exam")}>
                Create Exam
              </Button>
            )}
          </div>
        }
      />
      <SearchFilter
        placeholder="Search assessments..."
        value={search}
        onChange={setSearch}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card className="table-card">
        <DataTable
          headers={[
            "Assessment",
            "Subject",
            "Questions",
            "Attempts",
            "Date",
            "Status",
          ]}
          rows={visibleData.map((assessment) => [
            <b>{String(assessment.title || "")}</b>,
            String(assessment.subject || ""),
            String(assessment.questions || "—"),
            String(assessment.attempts || "—"),
            String(assessment.availableDate || "—"),
            <Badge>{String(assessment.status || "Draft")}</Badge>,
          ])}
          onView={(index) => {
            setSelectedAssessment(visibleData[index])
            setEditing(false)
          }}
          onEdit={(index) => {
            setSelectedAssessment(visibleData[index])
            setEditing(true)
            setSavingError("")
          }}
          paginate
        />
      </Card>
      {!visibleData.length && !error && (
        <p className="empty-state">
          No assessments have been created for this view yet.
        </p>
      )}
      {selectedAssessment && (
        <Modal
          title={
            editing
              ? "Edit Assessment"
              : String(selectedAssessment.title || "Assessment")
          }
          close={() => setSelectedAssessment(null)}
        >
          {editing ? (
            <form onSubmit={saveAssessment}>
              <div className="modal-form">
                <label className="field full">
                  <span>Title</span>
                  <input
                    name="title"
                    required
                    defaultValue={String(selectedAssessment.title || "")}
                  />
                </label>
                <label className="field">
                  <span>Questions</span>
                  <input
                    name="questions"
                    type="number"
                    min="1"
                    defaultValue={String(selectedAssessment.questions || "")}
                  />
                </label>
                <label className="field">
                  <span>Duration in minutes</span>
                  <input
                    name="duration"
                    type="number"
                    min="1"
                    defaultValue={String(selectedAssessment.duration || "")}
                  />
                </label>
                <label className="field">
                  <span>Attempts</span>
                  <input
                    name="attempts"
                    type="number"
                    min="1"
                    defaultValue={String(selectedAssessment.attempts || "")}
                  />
                </label>
                <label className="field">
                  <span>Passing Score</span>
                  <input
                    name="passingScore"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={String(selectedAssessment.passingScore || "")}
                  />
                </label>
                <label className="field">
                  <span>Available Date</span>
                  <input
                    name="availableDate"
                    type="datetime-local"
                    defaultValue={String(
                      selectedAssessment.availableDate || "",
                    )}
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    name="status"
                    defaultValue={String(selectedAssessment.status || "Draft")}
                  >
                    <option>Draft</option>
                    <option>Published</option>
                  </select>
                </label>
              </div>
              {savingError && (
                <p className="form-error" role="alert">
                  {savingError}
                </p>
              )}
              <div className="modal-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAssessment(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="recovery-body">
              <p>
                {String(
                  selectedAssessment.description ||
                    "No instructions were added.",
                )}
              </p>
              <p>
                {String(selectedAssessment.questions || "—")} questions ·{" "}
                {String(selectedAssessment.duration || "—")} minutes
              </p>
              <div className="modal-actions">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAssessment(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}

function ClassDetails({
  role,
  navigate,
  classCode,
}: {
  role: Role
  navigate: (s: string) => void
  classCode: string
}) {
  const [tab, setTab] = useState("Overview")
  const [teacherAction, setTeacherAction] = useState("")
  const [teacherFile, setTeacherFile] = useState("")
  const [teacherFileData, setTeacherFileData] = useState("")
  const [teacherMaterialTitle, setTeacherMaterialTitle] = useState("")
  const [teacherMaterialDescription, setTeacherMaterialDescription] =
    useState("")
  const [classAssignments, setClassAssignments] = useState<Array<{
    id?: string
    title: string
    dueDate: string
    dueTime: string
    points: string
    status: string
    instructions: string
    attachment: string
  }>>([])
  const [assignmentIndex, setAssignmentIndex] = useState<number | null>(null)
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    dueDate: "",
    dueTime: "",
    points: "",
    status: "Draft",
    instructions: "",
    attachment: "",
  })
  const [classQuizzes, setClassQuizzes] = useState<Array<{
    id?: string
    type?: string
    title: string
    questions: string
    duration: string
    attempts: string
    passingScore: string
    availableDate: string
    status: string
  }>>([])
  const [classExams, setClassExams] = useState(classQuizzes)
  const [classMaterials, setClassMaterials] =
    useState<Record<string, unknown>[]>([])
  const [classStudents, setClassStudents] = useState<Record<string, unknown>[]>(
    [],
  )
  const [classSubmissions, setClassSubmissions] =
    useState<Record<string, unknown>[]>([])
  const [classAnnouncements, setClassAnnouncements] =
    useState<Record<string, unknown>[]>([])
  const [assessmentIndex, setAssessmentIndex] = useState<number | null>(null)
  const [assessmentDraft, setAssessmentDraft] = useState({
    title: "",
    questions: "",
    duration: "",
    attempts: "1",
    passingScore: "75",
    availableDate: "",
    status: "Draft",
  })
  const [assessmentRecordTitle, setAssessmentRecordTitle] = useState("")
  const [assessmentAttemptsById, setAssessmentAttemptsById] =
    useState<Record<string, AssessmentAttempt[]>>({})
  const [assessmentAttemptError, setAssessmentAttemptError] = useState("")
  const [assessmentQuestions, setAssessmentQuestions] =
    useState<Record<string, {
      prompt: string
      options: string[]
      correctAnswer: number
    }[]>>({})
  const [questionDraft, setQuestionDraft] = useState({
    prompt: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
  })
  const [autoSaveStatus, setAutoSaveStatus] = useState("")
  const loadAssessmentAttempts = async (assessmentId: string) => {
    setAssessmentAttemptError("")
    try {
      const response = await apiFetch(
        `/api/assessments/${encodeURIComponent(assessmentId)}/attempts`,
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(payload?.message || "Unable to load student attempts.")
      }
      setAssessmentAttemptsById((current) => ({
        ...current,
        [assessmentId]: payload,
      }))
    } catch (error) {
      setAssessmentAttemptError(
        error instanceof Error
          ? error.message
          : "Unable to load student attempts.",
      )
    }
  }
  const [selectedClass, setSelectedClass] = useState({
    ...emptyClassRecord,
  })
  const readTeacherFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setAutoSaveStatus("Files must be 5 MB or smaller.")
      setTeacherFile("")
      setTeacherFileData("")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setAutoSaveStatus("Unable to read the selected file.")
        return
      }
      setTeacherFile(file.name)
      setTeacherFileData(reader.result)
      setTeacherMaterialTitle(
        (current) => current || file.name.replace(/\.[^.]+$/, ""),
      )
      setAutoSaveStatus("")
    }
    reader.onerror = () =>
      setAutoSaveStatus("Unable to read the selected file.")
    reader.readAsDataURL(file)
  }
  useEffect(() => {
    let active = true
    const endpoint = role === "admin" ? "/api/classes" : "/api/subject-sections"
    void apiFetch(endpoint)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(payload?.message || "Unable to load this class.")
        }
        return payload
      })
      .then((records) => {
        const record = records.find((item) =>
          role === "admin" ? item.code === classCode : item.id === classCode,
        )
        if (!active || !record) return
        setSelectedClass(
          role === "admin"
            ? {
                ...record,
                subject: String(record.subject || record.name || ""),
              }
            : {
                subject: String(record.subjectName || ""),
                code: String(record.id),
                teacher: String(record.teacher || ""),
                room: "",
                schedule: "",
                color: "emerald",
                gradeLevel: String(record.gradeLevel || ""),
                strand: String(record.strand || ""),
                schoolYear: String(record.schoolYear || ""),
              },
        )
      })
      .catch((error: unknown) => {
        if (active) {
          setAutoSaveStatus(
            error instanceof Error
              ? error.message
              : "Unable to load this class.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [classCode, role])
  useEffect(() => {
    let active = true
    const loadRecords = async () => {
      try {
        const [
          assignmentsResponse,
          assessmentsResponse,
          questionsResponse,
          materialsResponse,
          lessonsResponse,
          announcementsResponse,
          enrollmentsResponse,
          submissionsResponse,
        ] = await Promise.all([
          apiFetch(
            `/api/records/assignments?scopeId=${encodeURIComponent(classCode)}`,
          ),
          apiFetch(
            `/api/records/assessments?scopeId=${encodeURIComponent(classCode)}`,
          ),
          apiFetch(
            `/api/records/assessment-questions?scopeId=${encodeURIComponent(classCode)}`,
          ),
          apiFetch(
            `/api/records/materials?scopeId=${encodeURIComponent(classCode)}`,
          ),
          apiFetch(
            `/api/records/lessons?scopeId=${encodeURIComponent(classCode)}`,
          ),
          apiFetch("/api/records/announcements"),
          apiFetch("/api/enrollments"),
          apiFetch("/api/records/submissions"),
        ])
        const [
          assignments,
          assessments,
          questionRecords,
          materials,
          lessons,
          announcements,
          enrollments,
          submissions,
        ] = await Promise.all([
          assignmentsResponse.json(),
          assessmentsResponse.json(),
          questionsResponse.json(),
          materialsResponse.json(),
          lessonsResponse.json(),
          announcementsResponse.json(),
          enrollmentsResponse.json(),
          submissionsResponse.json(),
        ])
        if (
          !assignmentsResponse.ok ||
          !assessmentsResponse.ok ||
          !questionsResponse.ok ||
          !materialsResponse.ok ||
          !lessonsResponse.ok ||
          !announcementsResponse.ok ||
          !enrollmentsResponse.ok ||
          !submissionsResponse.ok
        ) {
          throw new Error("Unable to load class learning records.")
        }
        if (!active) return
        setClassAssignments(Array.isArray(assignments) ? assignments : [])
        const assessmentRecords = Array.isArray(assessments) ? assessments : []
        setClassQuizzes(
          assessmentRecords.filter((record) => record.type === "quiz"),
        )
        setClassExams(
          assessmentRecords.filter((record) => record.type === "exam"),
        )
        setClassMaterials([
          ...(Array.isArray(materials) ? materials : []),
          ...(Array.isArray(lessons) ? lessons : []),
        ])
        setClassStudents(
          Array.isArray(enrollments)
            ? enrollments.filter(
                (record) => String(record.subjectSectionId) === classCode,
              )
            : [],
        )
        setClassSubmissions(
          Array.isArray(submissions)
            ? submissions.filter(
                (record) => String(record.scopeId || "") === classCode,
              )
            : [],
        )
        setClassAnnouncements(
          Array.isArray(announcements)
            ? announcements.filter(
                (record) => String(record.scopeId || "") === classCode,
              )
            : [],
        )
        const savedQuestions = Array.isArray(questionRecords)
          ? questionRecords[0]?.questions
          : null
        setAssessmentQuestions(savedQuestions || {})
      } catch (error) {
        if (active) {
          setAutoSaveStatus(
            error instanceof Error
              ? error.message
              : "Unable to load class learning records.",
          )
        }
      }
    }
    const refresh = () => void loadRecords()
    refresh()
    window.addEventListener("snhs-records-updated", refresh)
    return () => {
      active = false
      window.removeEventListener("snhs-records-updated", refresh)
    }
  }, [classCode])
  useEffect(() => {
    if (!teacherAction || (tab !== "Quizzes" && tab !== "Exams")) return
    setAutoSaveStatus("Saving…")
    const timer = window.setTimeout(async () => {
      try {
        await saveApiRecord(
          "assessment-questions",
          { questions: assessmentQuestions },
          classCode,
          classCode,
        )
        setAutoSaveStatus("Questions saved")
      } catch (error) {
        setAutoSaveStatus(
          error instanceof Error ? error.message : "Unable to save questions.",
        )
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [assessmentQuestions, teacherAction, tab, classCode])
  const tabs =
    role === "teacher"
      ? ["Overview", "Students", "Lessons", "Assignments", "Quizzes", "Exams"]
      : [
          "Overview",
          "Learning Materials",
          "Assignments",
          "Quizzes",
          "Exams",
          "Announcements",
        ]
  useEffect(() => {
    if (!tabs.includes(tab)) setTab("Overview")
  }, [role, tab])
  const submissionsToReview = classSubmissions.filter(
    (submission) =>
      submission.status === "Submitted" &&
      classAssignments.some(
        (assignment) => assignment.id === submission.assignmentId,
      ),
  )
  const teacherTabItems: Record<string, {
    title: string
    description: string
    icon: IconName
  }[]> = {
    Students: classStudents.map((student) => ({
      title: String(student.studentName || student.studentId || ""),
      description: String(student.studentId || ""),
      icon: "user",
    })),
    Lessons: classMaterials.map((material) => ({
      title: String(material.title || material.name || "Untitled material"),
      description: String(material.description || material.status || ""),
      icon: material.resource === "lessons" ? "book" : "file",
    })),
    Assignments: [
      ...classAssignments.map((assignment) => ({
        title: assignment.title,
        description: `${assignment.status} · Due ${assignment.dueDate} at ${assignment.dueTime} · ${assignment.points} points`,
        icon: "check" as IconName,
      })),
    ],
    Quizzes: classQuizzes.map((quiz) => ({
      title: quiz.title,
      description: `${quiz.questions} questions · ${quiz.duration} minutes · ${quiz.status}`,
      icon: "quiz" as IconName,
    })),
    Exams: classExams.map((exam) => ({
      title: exam.title,
      description: `${exam.questions} questions · ${exam.duration} minutes · ${exam.status}`,
      icon: "quiz" as IconName,
    })),
  }
  return (
    <>
      <button className="back-link" onClick={() => navigate("classes")}>
        <Icon name="chevron" size={15} /> Back to My Classes
      </button>
      <Card className="class-detail-hero">
        <div className="class-detail-mark">
          <Icon name="book" size={32} />
        </div>
        <div>
          <span className="eyebrow">{selectedClass.code}</span>
          <h1>{selectedClass.subject}</h1>
          <p>
            {[
              selectedClass.teacher,
              selectedClass.gradeLevel,
              selectedClass.strand,
            ]
              .filter(Boolean)
              .join(" · ") || "Class details"}
          </p>
        </div>
        <dl>
          <div>
            <dt>Room</dt>
            <dd>{selectedClass.room}</dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{selectedClass.schedule}</dd>
          </div>
          <div>
            <dt>School Year</dt>
            <dd>{selectedClass.schoolYear || "—"}</dd>
          </div>
          <div>
            <dt>{role === "teacher" ? "Students" : "Teacher"}</dt>
            <dd>
              {role === "teacher"
                ? `${classStudents.length} enrolled`
                : selectedClass.teacher}
            </dd>
          </div>
        </dl>
      </Card>
      <div className="tabs detail-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        role === "teacher" ? (
          <div className="teacher-overview">
            <div className="class-management-stats">
              {[
                ["Students", String(classStudents.length), "users"],
                ["Lessons", String(classMaterials.length), "book"],
                ["Assignments", String(classAssignments.length), "check"],
                ["Quizzes", String(classQuizzes.length), "quiz"],
                ["Exams", String(classExams.length), "report"],
              ].map(([label, value, icon]) => (
                <button key={label} onClick={() => setTab(label)}>
                  <span>
                    <Icon name={icon as IconName} size={18} />
                  </span>
                  <div>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
            <div className="detail-grid">
              <div className="detail-stack">
                <Card className="class-announcement teacher-announcement-card">
                  <span>
                    <Icon name="bell" size={18} />
                  </span>
                  <div>
                    <small>CLASS ANNOUNCEMENTS</small>
                    {classAnnouncements.length ? (
                      classAnnouncements.slice(0, 1).map((announcement) => (
                        <div key={String(announcement.id)}>
                          <h2>{String(announcement.title || "")}</h2>
                          <p>{String(announcement.body || "")}</p>
                        </div>
                      ))
                    ) : (
                      <p>
                        No announcements have been published for this class.
                      </p>
                    )}
                  </div>
                </Card>
                <Card className="detail-section">
                  <div className="card-head">
                    <div>
                      <h2>Submissions to Review</h2>
                      <p>Student work waiting for feedback</p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => setTab("Assignments")}
                    >
                      View Assignments
                    </Button>
                  </div>
                  {submissionsToReview.length ? (
                    <div className="timeline-list">
                      {classAssignments
                        .filter((assignment) =>
                          submissionsToReview.some(
                            (submission) =>
                              submission.assignmentId === assignment.id,
                          ),
                        )
                        .map((assignment) => {
                          const count = submissionsToReview.filter(
                            (submission) =>
                              submission.assignmentId === assignment.id,
                          ).length
                          return (
                            <button
                              key={String(assignment.id)}
                              onClick={() => setTab("Assignments")}
                            >
                              <i />
                              <span>
                                <b>{assignment.title}</b>
                                <small>{count} submission(s) to review</small>
                              </span>
                              <Badge>{count} pending</Badge>
                            </button>
                          )
                        })}
                    </div>
                  ) : (
                    <p className="empty-state">
                      No submissions are waiting for review.
                    </p>
                  )}
                </Card>
              </div>
              <div className="detail-stack">
                <Card className="detail-section">
                  <div className="card-head">
                    <div>
                      <h2>Published Class Content</h2>
                      <p>Content currently available to students</p>
                    </div>
                  </div>
                  <button
                    className="resource-row"
                    onClick={() => setTab("Lessons")}
                  >
                    <span>
                      <Icon name="book" />
                    </span>
                    <div>
                      <b>{classMaterials.length} learning materials</b>
                      <small>Open class materials</small>
                    </div>
                    <Icon name="arrow" size={16} />
                  </button>
                  <button
                    className="resource-row"
                    onClick={() => setTab("Assignments")}
                  >
                    <span>
                      <Icon name="check" />
                    </span>
                    <div>
                      <b>{classAssignments.length} assignments</b>
                      <small>Open class assignments</small>
                    </div>
                    <Icon name="arrow" size={16} />
                  </button>
                  <button
                    className="resource-row"
                    onClick={() => setTab("Quizzes")}
                  >
                    <span>
                      <Icon name="quiz" />
                    </span>
                    <div>
                      <b>{classQuizzes.length} quizzes</b>
                      <small>Open class quizzes</small>
                    </div>
                    <Icon name="arrow" size={16} />
                  </button>
                </Card>
                <Card className="class-progress-card">
                  <div>
                    <span>Enrolled students</span>
                    <strong>{classStudents.length}</strong>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="detail-grid">
            <div className="detail-stack">
              <Card className="class-announcement">
                <span>
                  <Icon name="bell" size={18} />
                </span>
                <div>
                  <small>CLASS ANNOUNCEMENTS</small>
                  {classAnnouncements.length ? (
                    classAnnouncements.slice(0, 1).map((announcement) => (
                      <div key={String(announcement.id)}>
                        <h2>{String(announcement.title || "")}</h2>
                        <p>{String(announcement.body || "")}</p>
                      </div>
                    ))
                  ) : (
                    <p>No announcements have been published for this class.</p>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setTab("Announcements")}
                  >
                    View Announcements
                  </Button>
                </div>
              </Card>
              <Card className="detail-section">
                <div className="card-head">
                  <div>
                    <h2>Upcoming Activities</h2>
                    <p>Your next class requirements</p>
                  </div>
                </div>
                <div className="timeline-list">
                  {classAssignments.map((assignment) => (
                    <button
                      key={String(assignment.id || assignment.title)}
                      onClick={() => setTab("Assignments")}
                    >
                      <i />
                      <span>
                        <b>{assignment.title}</b>
                        <small>
                          {assignment.dueDate
                            ? `Due ${assignment.dueDate}`
                            : "Assignment"}
                        </small>
                      </span>
                      <Badge>{String(assignment.status || "Published")}</Badge>
                    </button>
                  ))}
                  {classQuizzes.map((assessment) => (
                    <button
                      key={String(assessment.id || assessment.title)}
                      onClick={() => navigate("assessments")}
                    >
                      <i />
                      <span>
                        <b>{assessment.title}</b>
                        <small>
                          Quiz · {assessment.availableDate || "Available"}
                        </small>
                      </span>
                      <Badge>{String(assessment.status || "Published")}</Badge>
                    </button>
                  ))}
                  {classExams.map((assessment) => (
                    <button
                      key={String(assessment.id || assessment.title)}
                      onClick={() => navigate("assessments")}
                    >
                      <i />
                      <span>
                        <b>{assessment.title}</b>
                        <small>
                          Exam · {assessment.availableDate || "Available"}
                        </small>
                      </span>
                      <Badge>{String(assessment.status || "Published")}</Badge>
                    </button>
                  ))}
                  {!classAssignments.length &&
                    !classQuizzes.length &&
                    !classExams.length && (
                      <p className="empty-state">
                        No upcoming class activities have been published.
                      </p>
                    )}
                </div>
              </Card>
            </div>
            <div className="detail-stack">
              <Card className="teacher-summary">
                <ProfileAvatar role="teacher" className="avatar" />
                <div>
                  <small>CLASS TEACHER</small>
                  <h2>{selectedClass.teacher || "Unassigned"}</h2>
                  <p>{selectedClass.subject}</p>
                </div>
              </Card>
              <Card className="detail-section">
                <div className="card-head">
                  <div>
                    <h2>Recent Materials</h2>
                    <p>Latest learning resources</p>
                  </div>
                </div>
                {classMaterials.slice(0, 3).map((material) => (
                  <div className="resource-row" key={String(material.id)}>
                    <span>
                      <Icon name="file" />
                    </span>
                    <div>
                      <b>
                        {String(
                          material.title ||
                            material.name ||
                            "Untitled material",
                        )}
                      </b>
                      <small>
                        {String(
                          material.description || material.fileName || "",
                        )}
                      </small>
                    </div>
                  </div>
                ))}
                {!classMaterials.length && (
                  <p className="empty-state">
                    No learning materials are available.
                  </p>
                )}
              </Card>
            </div>
          </div>
        )
      ) : role === "teacher" ? (
        <Card className="subject-hub teacher-class-manager">
          <div className="card-head">
            <div>
              <h2>
                {selectedClass.subject} · {tab}
              </h2>
              <p>
                Manage this class's {tab.toLowerCase()} without leaving the
                subject workspace.
              </p>
            </div>
            <Button
              icon="plus"
              onClick={() => {
                setTeacherFile("")
                setTeacherFileData("")
                setTeacherMaterialTitle("")
                setTeacherMaterialDescription("")
                setTeacherFileData("")
                setTeacherMaterialTitle("")
                setTeacherMaterialDescription("")
                if (tab === "Assignments") {
                  setAssignmentIndex(null)
                  setAssignmentDraft({
                    title: "",
                    dueDate: "",
                    dueTime: "23:59",
                    points: "100",
                    status: "Draft",
                    instructions: "",
                    attachment: "",
                  })
                }
                if (tab === "Quizzes" || tab === "Exams") {
                  const emptyAssessment = {
                    title: "",
                    questions: tab === "Quizzes" ? "20" : "50",
                    duration: tab === "Quizzes" ? "30" : "60",
                    attempts: "1",
                    passingScore: "75",
                    availableDate: "",
                    status: "Draft",
                  }
                  setAssessmentIndex(null)
                  setAssessmentRecordTitle("")
                  setQuestionDraft({
                    prompt: "",
                    options: ["", "", "", ""],
                    correctAnswer: 0,
                  })
                  setAssessmentDraft(emptyAssessment)
                }
                setTeacherAction(
                  tab === "Lessons"
                    ? "Attach Lesson File"
                    : `Add ${
                        tab === "Students" ? "Student" : tab.slice(0, -1)
                      }`,
                )
              }}
            >
              {tab === "Lessons"
                ? "Attach Lesson File"
                : `Add ${tab === "Students" ? "Student" : tab.slice(0, -1)}`}
            </Button>
          </div>
          <div className="teacher-manager-list">
            {(teacherTabItems[tab] || []).map((item, itemIndex) => (
              <button
                className="resource-row"
                key={item.title}
                onClick={() => {
                  setTeacherFile("")
                  if (tab === "Assignments") {
                    setAssignmentIndex(itemIndex)
                    setAssignmentDraft({ ...classAssignments[itemIndex] })
                  }
                  if (tab === "Quizzes" || tab === "Exams") {
                    const sourceAssessment =
                      tab === "Quizzes"
                        ? classQuizzes[itemIndex]
                        : classExams[itemIndex]
                    setAssessmentIndex(itemIndex)
                    setAssessmentRecordTitle(item.title)
                    setQuestionDraft(
                      assessmentQuestions[item.title]?.[0] || {
                        prompt: "",
                        options: ["", "", "", ""],
                        correctAnswer: 0,
                      },
                    )
                    setAssessmentDraft({ ...sourceAssessment })
                    if (sourceAssessment.id) {
                      void loadAssessmentAttempts(String(sourceAssessment.id))
                    }
                  }
                  setTeacherAction(
                    tab === "Lessons"
                      ? `Replace File · ${item.title}`
                      : `Edit ${item.title}`,
                  )
                }}
              >
                <span>
                  <Icon name={item.icon} />
                </span>
                <div>
                  <b>{item.title}</b>
                  <small>{item.description}</small>
                </div>
                <span className="teacher-row-action">
                  <Icon name="edit" size={16} />
                </span>
              </button>
            ))}
          </div>
        </Card>
      ) : role === "student" && tab === "Learning Materials" ? (
        <Card className="subject-hub">
          <div className="card-head">
            <div>
              <h2>{selectedClass.subject} Materials</h2>
              <p>Lessons and teacher resources for this subject.</p>
            </div>
          </div>
          {classMaterials.map((material) => (
            <div className="resource-row" key={String(material.id)}>
              <span>
                <Icon name="file" />
              </span>
              <div>
                <b>
                  {String(
                    material.title || material.name || "Untitled material",
                  )}
                </b>
                <small>
                  {String(material.description || material.fileName || "")}
                </small>
              </div>
            </div>
          ))}
          {!classMaterials.length && (
            <p className="empty-state">No learning materials are available.</p>
          )}
        </Card>
      ) : role === "student" && tab === "Assignments" ? (
        <Card className="subject-hub">
          <div className="card-head">
            <div>
              <h2>{selectedClass.subject} Assignments</h2>
              <p>Activities and submission deadlines for this subject.</p>
            </div>
          </div>
          <div className="timeline-list">
            {classAssignments.map((assignment) => (
              <div
                className="resource-row"
                key={String(assignment.id || assignment.title)}
              >
                <span>
                  <Icon name="check" />
                </span>
                <div>
                  <b>{assignment.title}</b>
                  <small>
                    {assignment.dueDate
                      ? `Due ${assignment.dueDate}${
                          assignment.dueTime ? ` at ${assignment.dueTime}` : ""
                        }`
                      : String(assignment.status || "")}
                  </small>
                </div>
                <Badge>{String(assignment.status || "Published")}</Badge>
              </div>
            ))}
            {!classAssignments.length && (
              <p className="empty-state">No assignments are available.</p>
            )}
          </div>
        </Card>
      ) : role === "student" && (tab === "Quizzes" || tab === "Exams") ? (
        <Card className="subject-hub">
          <div className="card-head">
            <div>
              <h2>
                {selectedClass.subject} {tab}
              </h2>
              <p>
                Scheduled and completed {tab.toLowerCase()} for this subject.
              </p>
            </div>
          </div>
          <div className="timeline-list">
            {(tab === "Quizzes" ? classQuizzes : classExams).map(
              (assessment) => (
                <div
                  className="resource-row"
                  key={String(assessment.id || assessment.title)}
                >
                  <span>
                    <Icon name="quiz" />
                  </span>
                  <div>
                    <b>{assessment.title}</b>
                    <small>
                      {assessment.questions} questions · {assessment.duration}{" "}
                      minutes
                    </small>
                  </div>
                  <Badge>{assessment.status}</Badge>
                  <Button
                    variant="secondary"
                    onClick={() => navigate("assessments")}
                  >
                    Take assessment
                  </Button>
                </div>
              ),
            )}
            {!(tab === "Quizzes" ? classQuizzes : classExams).length && (
              <p className="empty-state">
                No {tab.toLowerCase()} are available.
              </p>
            )}
          </div>
        </Card>
      ) : role === "student" && tab === "Announcements" ? (
        <Card className="class-announcement">
          <span>
            <Icon name="bell" size={18} />
          </span>
          <div>
            <small>{selectedClass.subject.toUpperCase()} · ANNOUNCEMENTS</small>
            {classAnnouncements.length ? (
              classAnnouncements.map((announcement) => (
                <div key={String(announcement.id)}>
                  <h2>{String(announcement.title || "")}</h2>
                  <p>{String(announcement.body || "")}</p>
                </div>
              ))
            ) : (
              <p>No announcements have been published for this class.</p>
            )}
            <Button variant="ghost" onClick={() => navigate("announcements")}>
              Open All Announcements
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="tab-placeholder">
          <Icon
            name={
              tab === "Students"
                ? "users"
                : tab === "Gradebook"
                  ? "chart"
                  : "file"
            }
            size={30}
          />
          <h2>{tab}</h2>
          <p>
            All {tab.toLowerCase()} for {selectedClass.subject} are organized
            here.
          </p>
          <Button
            onClick={() =>
              navigate(
                tab === "Gradebook" || tab === "Grades"
                  ? "grades"
                  : tab === "Lessons" || tab === "Learning Materials"
                    ? "materials"
                    : tab === "Quizzes"
                      ? "quizzes"
                      : tab === "Exams"
                        ? "exams"
                        : tab.toLowerCase(),
              )
            }
          >
            Open {tab}
          </Button>
        </Card>
      )}
      {teacherAction && (
        <Modal title={teacherAction} close={() => setTeacherAction("")}>
          {tab === "Quizzes" || tab === "Exams" ? (
            <div className="modal-form assessment-editor">
              <label className="field full">
                <span>{tab === "Quizzes" ? "Quiz" : "Exam"} Title</span>
                <input
                  value={assessmentDraft.title}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      title: event.target.value,
                    })
                  }
                  placeholder={`Enter ${
                    tab === "Quizzes" ? "quiz" : "exam"
                  } title`}
                />
              </label>
              <label className="field">
                <span>Number of Questions</span>
                <input
                  type="number"
                  min="1"
                  value={assessmentDraft.questions}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      questions: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Time Limit · Minutes</span>
                <input
                  type="number"
                  min="1"
                  value={assessmentDraft.duration}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      duration: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Attempts Allowed</span>
                <input
                  type="number"
                  min="1"
                  value={assessmentDraft.attempts}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      attempts: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Passing Score · Percent</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={assessmentDraft.passingScore}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      passingScore: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Available Date</span>
                <input
                  type="date"
                  value={assessmentDraft.availableDate}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      availableDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Publication Status</span>
                <select
                  value={assessmentDraft.status}
                  onChange={(event) =>
                    setAssessmentDraft({
                      ...assessmentDraft,
                      status: event.target.value,
                    })
                  }
                >
                  <option>Draft</option>
                  <option>Scheduled</option>
                  <option>Published</option>
                </select>
              </label>
              <div className="autosave-status full" role="status">
                <Icon
                  name={autoSaveStatus === "Saving…" ? "clock" : "check"}
                  size={15}
                />
                <span>{autoSaveStatus || "Autosave is on"}</span>
              </div>
              {assessmentIndex === null ? (
                <div className="field full assessment-builder-note">
                  <span>Question Builder</span>
                  <p>
                    Save the {tab === "Quizzes" ? "quiz" : "exam"} first, then
                    open it from this list to manage its questions and answers.
                  </p>
                </div>
              ) : (
                <div className="question-builder full">
                  <div className="question-builder-head">
                    <div>
                      <span>Question Builder</span>
                      <b>
                        {
                          (assessmentQuestions[assessmentRecordTitle] || [])
                            .length
                        }{" "}
                        of {assessmentDraft.questions} questions added
                      </b>
                    </div>
                  </div>
                  <div className="question-builder-list">
                    {(assessmentQuestions[assessmentRecordTitle] || []).map(
                      (question, questionIndex) => (
                        <div
                          className="question-builder-item"
                          key={questionIndex}
                        >
                          <span>{questionIndex + 1}</span>
                          <div>
                            <b>{question.prompt}</b>
                            <small>
                              Correct answer:{" "}
                              {question.options[question.correctAnswer]}
                            </small>
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove question ${questionIndex + 1}`}
                            onClick={() =>
                              setAssessmentQuestions((current) => ({
                                ...current,
                                [assessmentRecordTitle]: (
                                  current[assessmentRecordTitle] || []
                                ).filter((_, index) => index !== questionIndex),
                              }))
                            }
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="question-builder-list">
                    <div className="question-builder-head">
                      <div>
                        <span>Student Attempts</span>
                        <b>
                          {
                            (
                              assessmentAttemptsById[
                                String(
                                  (tab === "Quizzes"
                                    ? classQuizzes
                                    : classExams)[assessmentIndex]?.id || "",
                                )
                              ] || []
                            ).length
                          }{" "}
                          submitted
                        </b>
                      </div>
                    </div>
                    {assessmentAttemptError && (
                      <p className="form-error" role="alert">
                        {assessmentAttemptError}
                      </p>
                    )}
                    {(
                      assessmentAttemptsById[
                        String(
                          (tab === "Quizzes" ? classQuizzes : classExams)[
                            assessmentIndex
                          ]?.id || "",
                        )
                      ] || []
                    ).map((attempt) => (
                      <div className="question-builder-item" key={attempt.id}>
                        <span>{attempt.attemptNumber}</span>
                        <div>
                          <b>{attempt.studentId}</b>
                          <small>
                            {attempt.correctAnswers}/{attempt.questionCount}{" "}
                            correct · {attempt.scorePercent}% ·{" "}
                            {new Date(attempt.submittedAt).toLocaleString()}
                          </small>
                        </div>
                      </div>
                    ))}
                    {!assessmentAttemptError &&
                      !assessmentAttemptsById[
                        String(
                          (tab === "Quizzes" ? classQuizzes : classExams)[
                            assessmentIndex
                          ]?.id || "",
                        )
                      ]?.length && (
                        <p>No student attempts have been submitted.</p>
                      )}
                  </div>
                  <label className="field">
                    <span>Question</span>
                    <textarea
                      rows={3}
                      value={questionDraft.prompt}
                      onChange={(event) =>
                        setQuestionDraft({
                          ...questionDraft,
                          prompt: event.target.value,
                        })
                      }
                      placeholder="Enter the question"
                    />
                  </label>
                  <div className="question-option-grid">
                    {questionDraft.options.map((option, optionIndex) => (
                      <label className="field" key={optionIndex}>
                        <span>
                          Option {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <input
                          value={option}
                          onChange={(event) =>
                            setQuestionDraft({
                              ...questionDraft,
                              options: questionDraft.options.map(
                                (currentOption, index) =>
                                  index === optionIndex
                                    ? event.target.value
                                    : currentOption,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="field">
                    <span>Correct Answer</span>
                    <select
                      value={questionDraft.correctAnswer}
                      onChange={(event) =>
                        setQuestionDraft({
                          ...questionDraft,
                          correctAnswer: Number(event.target.value),
                        })
                      }
                    >
                      {questionDraft.options.map((_, optionIndex) => (
                        <option value={optionIndex} key={optionIndex}>
                          Option {String.fromCharCode(65 + optionIndex)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    disabled={
                      !questionDraft.prompt.trim() ||
                      questionDraft.options.some((option) => !option.trim()) ||
                      (assessmentQuestions[assessmentRecordTitle] || [])
                        .length >= Number(assessmentDraft.questions)
                    }
                    onClick={() => {
                      setAssessmentQuestions((current) => ({
                        ...current,
                        [assessmentRecordTitle]: [
                          ...(current[assessmentRecordTitle] || []),
                          questionDraft,
                        ],
                      }))
                      setQuestionDraft({
                        prompt: "",
                        options: ["", "", "", ""],
                        correctAnswer: 0,
                      })
                    }}
                  >
                    Add Question
                  </Button>
                </div>
              )}
            </div>
          ) : tab === "Assignments" ? (
            <div className="modal-form assignment-editor">
              <label className="field full">
                <span>Assignment Title</span>
                <input
                  value={assignmentDraft.title}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      title: event.target.value,
                    })
                  }
                  placeholder="Enter assignment title"
                />
              </label>
              <label className="field">
                <span>Due Date</span>
                <input
                  type="date"
                  value={assignmentDraft.dueDate}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      dueDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Due Time</span>
                <input
                  type="time"
                  value={assignmentDraft.dueTime}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      dueTime: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Maximum Points</span>
                <input
                  type="number"
                  min="1"
                  value={assignmentDraft.points}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      points: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>Publication Status</span>
                <select
                  value={assignmentDraft.status}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      status: event.target.value,
                    })
                  }
                >
                  <option>Draft</option>
                  <option>Published</option>
                </select>
              </label>
              <label className="field full">
                <span>Instructions</span>
                <textarea
                  rows={4}
                  value={assignmentDraft.instructions}
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      instructions: event.target.value,
                    })
                  }
                  placeholder="Enter complete assignment instructions"
                />
              </label>
              <label className="upload-zone full">
                <Icon name="file" size={24} />
                <b>
                  {assignmentDraft.attachment ||
                    "Attach an assignment file (optional)"}
                </b>
                <span>PDF, Word, PowerPoint, or image · Maximum 50 MB</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  onChange={(event) =>
                    setAssignmentDraft({
                      ...assignmentDraft,
                      attachment: event.target.files?.[0]?.name || "",
                    })
                  }
                />
              </label>
            </div>
          ) : tab === "Lessons" ? (
            <div className="attachment-form">
              <label className="upload-zone">
                <Icon name="file" size={28} />
                <b>{teacherFile || "Choose a file to attach"}</b>
                <span>
                  PDF, Word, PowerPoint, image, audio, or video · Maximum 5 MB
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,audio/*,video/*"
                  onChange={(event) => readTeacherFile(event.target.files?.[0])}
                />
              </label>
              <label className="field">
                <span>Display title</span>
                <input
                  value={teacherMaterialTitle}
                  onChange={(event) =>
                    setTeacherMaterialTitle(event.target.value)
                  }
                  required
                />
              </label>
              <label className="field full">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={teacherMaterialDescription}
                  onChange={(event) =>
                    setTeacherMaterialDescription(event.target.value)
                  }
                />
              </label>
              <p className="attachment-help">
                The attached file will be available to students inside this
                subject's Learning Materials section.
              </p>
            </div>
          ) : (
            <div className="modal-form">
              <label className="field">
                <span>Title / Name</span>
                <input
                  defaultValue={
                    teacherAction.startsWith("Edit ")
                      ? teacherAction.replace("Edit ", "")
                      : ""
                  }
                  placeholder="Enter complete information"
                />
              </label>
              {tab !== "Students" && (
                <label className="field">
                  <span>Status</span>
                  <select defaultValue="Published">
                    <option>Published</option>
                    <option>Draft</option>
                    <option>Archived</option>
                  </select>
                </label>
              )}
              <label className="field full">
                <span>
                  {tab === "Students"
                    ? "Student Notes"
                    : "Instructions / Description"}
                </span>
                <textarea
                  rows={4}
                  placeholder={`Add details for this ${tab.toLowerCase()} record`}
                />
              </label>
            </div>
          )}
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setTeacherAction("")}>
              Cancel
            </Button>
            <Button
              disabled={
                (tab === "Lessons" &&
                  (!teacherFile ||
                    !teacherFileData ||
                    !teacherMaterialTitle.trim())) ||
                (tab === "Assignments" &&
                  (!assignmentDraft.title.trim() ||
                    !assignmentDraft.dueDate ||
                    !assignmentDraft.points)) ||
                ((tab === "Quizzes" || tab === "Exams") &&
                  (!assessmentDraft.title.trim() ||
                    !assessmentDraft.questions ||
                    !assessmentDraft.duration ||
                    !assessmentDraft.availableDate))
              }
              onClick={async () => {
                try {
                  if (tab === "Lessons") {
                    const saved = await saveApiRecord(
                      "materials",
                      {
                        title: teacherMaterialTitle.trim(),
                        description: teacherMaterialDescription.trim(),
                        fileName: teacherFile,
                        fileType: teacherFileData.split(";")[0] || "",
                        fileData: teacherFileData,
                        status: "Published",
                      },
                      classCode,
                    )
                    setClassMaterials((current) => [
                      ...current,
                      { ...saved, resource: "materials" },
                    ])
                  } else if (tab === "Assignments") {
                    const existing =
                      assignmentIndex === null
                        ? undefined
                        : classAssignments[assignmentIndex]
                    const saved = await saveApiRecord(
                      "assignments",
                      assignmentDraft,
                      classCode,
                      existing?.id,
                    )
                    const nextRecord = {
                      ...assignmentDraft,
                      id: String(saved.id),
                    }
                    setClassAssignments((current) =>
                      assignmentIndex === null
                        ? [...current, nextRecord]
                        : current.map((assignment, index) =>
                            index === assignmentIndex ? nextRecord : assignment,
                          ),
                    )
                  }
                  if (tab === "Quizzes" || tab === "Exams") {
                    if (
                      assessmentRecordTitle &&
                      assessmentRecordTitle !== assessmentDraft.title
                    ) {
                      setAssessmentQuestions((current) => {
                        const next = { ...current }
                        next[assessmentDraft.title] =
                          next[assessmentRecordTitle] || []
                        delete next[assessmentRecordTitle]
                        return next
                      })
                    }
                    const currentRecords =
                      tab === "Quizzes" ? classQuizzes : classExams
                    const existing =
                      assessmentIndex === null
                        ? undefined
                        : currentRecords[assessmentIndex]
                    const assessment = {
                      ...assessmentDraft,
                      type: tab === "Quizzes" ? "quiz" : "exam",
                    }
                    const saved = await saveApiRecord(
                      "assessments",
                      assessment,
                      classCode,
                      existing?.id,
                    )
                    const nextRecord = {
                      ...assessment,
                      id: String(saved.id),
                    }
                    const update = (current: typeof classQuizzes) =>
                      assessmentIndex === null
                        ? [...current, nextRecord]
                        : current.map((record, index) =>
                            index === assessmentIndex ? nextRecord : record,
                          )
                    if (tab === "Quizzes") setClassQuizzes(update)
                    else setClassExams(update)
                  }
                  setTeacherAction("")
                  setTeacherFile("")
                  setTeacherFileData("")
                  setTeacherMaterialTitle("")
                  setTeacherMaterialDescription("")
                } catch (error) {
                  setAutoSaveStatus(
                    error instanceof Error
                      ? error.message
                      : "Unable to save changes.",
                  )
                }
              }}
            >
              {tab === "Assignments"
                ? assignmentIndex === null
                  ? "Create Assignment"
                  : "Save Assignment"
                : tab === "Quizzes" || tab === "Exams"
                  ? assessmentIndex === null
                    ? `Create ${tab === "Quizzes" ? "Quiz" : "Exam"}`
                    : `Save ${tab === "Quizzes" ? "Quiz" : "Exam"}`
                  : tab === "Lessons"
                    ? "Attach File"
                    : "Save Changes"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function MaterialViewer({ navigate }: { navigate: (s: string) => void }) {
  const [page, setPage] = useState(0)
  const pages = [
    [
      "Functions and Relations",
      "A relation is any set of ordered pairs. A function is a special relation where every input has exactly one output.",
      "f(x) = 2x + 3",
      "Learning objectives",
      "Identify functions, evaluate function notation, and represent real-life situations using functions.",
    ],
    [
      "Relations and Ordered Pairs",
      "Relations connect values from one set to values in another set. They can be written as ordered pairs, tables, mappings, or graphs.",
      "(1, 3), (2, 5), (3, 7)",
      "Representing relations",
      "Organize inputs and outputs so that patterns and repeated values are easy to identify.",
    ],
    [
      "Domain and Range",
      "The domain is the set of all possible input values. The range is the set of resulting output values.",
      "D = {1, 2, 3}  ·  R = {3, 5, 7}",
      "Key idea",
      "List each value only once when writing the domain and range of a relation.",
    ],
    [
      "Identifying Functions",
      "A relation is a function when each input is paired with exactly one output.",
      "x → one value of y",
      "Function check",
      "Repeated outputs are allowed, but a single input cannot point to two different outputs.",
    ],
    [
      "The Vertical Line Test",
      "A graph represents a function if every vertical line intersects the graph at no more than one point.",
      "x = a",
      "Reading graphs",
      "Move an imaginary vertical line across the graph and count the intersections at each position.",
    ],
    [
      "Function Notation",
      "Function notation names a relationship and provides a concise way to describe its output.",
      "f(x) = 2x + 3",
      "Reading notation",
      "The expression f(x) is read as “f of x” and represents the output produced by input x.",
    ],
    [
      "Evaluating Functions",
      "To evaluate a function, substitute the given input everywhere the variable appears and simplify.",
      "f(4) = 2(4) + 3 = 11",
      "Worked example",
      "Use the correct order of operations after replacing the variable with the supplied value.",
    ],
    [
      "Linear Functions",
      "Linear functions have a constant rate of change and form a straight line when graphed.",
      "f(x) = mx + b",
      "Slope and intercept",
      "The value m is the slope, while b identifies where the graph crosses the y-axis.",
    ],
    [
      "Operations on Functions",
      "Functions can be added, subtracted, multiplied, and divided to create new functions.",
      "(f + g)(x) = f(x) + g(x)",
      "Combining rules",
      "Apply each function rule first, then simplify the resulting expression.",
    ],
    [
      "Composite Functions",
      "A composite function uses the output of one function as the input of another.",
      "(f ∘ g)(x) = f(g(x))",
      "Order matters",
      "Evaluate the inner function first before applying the outer function.",
    ],
    [
      "Real-World Applications",
      "Functions model relationships such as distance over time, cost per item, and changes in temperature.",
      "C(n) = 50n + 100",
      "Building a model",
      "Identify the changing quantity, the starting value, and the rate of change.",
    ],
    [
      "Review and Practice",
      "Review the main concepts before completing the practice exercises and subject assessment.",
      "input → rule → output",
      "Check your understanding",
      "Identify the domain and range, test whether relations are functions, and evaluate function notation.",
    ],
  ] as const
  const currentPage = pages[page]

  return (
    <>
      <button className="back-link" onClick={() => navigate("class-details")}>
        <Icon name="chevron" size={15} /> Back to Subject
      </button>
      <PageHeading
        title="Functions and Relations"
        description="General Mathematics · Maria Santos"
      />
      <div className="viewer-grid">
        <Card className="document-preview">
          <div className="document-toolbar">
            <span>Functions-and-Relations.pdf</span>
            <Badge>PDF</Badge>
          </div>
          <div className="paper">
            <span>GENERAL MATHEMATICS · PAGE {page + 1}</span>
            <h2>{currentPage[0]}</h2>
            <p>{currentPage[1]}</p>
            <div className="formula">{currentPage[2]}</div>
            <h3>{currentPage[3]}</h3>
            <p>{currentPage[4]}</p>
          </div>
          <div className="document-pagination">
            <Button
              variant="ghost"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {pages.length}
            </span>
            <Button
              variant="ghost"
              disabled={page === pages.length - 1}
              onClick={() =>
                setPage((current) => Math.min(pages.length - 1, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </Card>
        <Card className="material-panel">
          <h2>Material Information</h2>
          <dl>
            <div>
              <dt>Description</dt>
              <dd>
                A comprehensive guide to functions, relations, domain, and range
                with worked examples.
              </dd>
            </div>
            <div>
              <dt>Uploaded by</dt>
              <dd>Maria Santos</dd>
            </div>
            <div>
              <dt>Upload date</dt>
              <dd>May 20, 2025</dd>
            </div>
            <div>
              <dt>Material type</dt>
              <dd>
                <Badge>PDF</Badge>
              </dd>
            </div>
          </dl>
          <Button variant="secondary" onClick={() => navigate("class-details")}>
            BACK TO SUBJECT
          </Button>
        </Card>
      </div>
    </>
  )
}

function AssignmentDetails({ navigate }: { navigate: (s: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [selectedFile, setSelectedFile] = useState("")
  return (
    <SecureAssessment>
      <button className="back-link" onClick={() => navigate("class-details")}>
        <Icon name="chevron" size={15} /> Back to Subject
      </button>
      <PageHeading
        title="Functions Problem Set"
        description="General Mathematics · Maria Santos"
        action={
          <Badge tone={submitted ? "submitted" : "pending"}>
            {submitted ? "Submitted" : "Not Submitted"}
          </Badge>
        }
      />
      <div className="secure-notice">
        <Icon name="check" size={16} />
        <span>
          Academic integrity mode is enabled. Copy, cut, paste, dragging, and
          right-click are disabled.
        </span>
      </div>
      <div className="assignment-detail-grid">
        <div className="detail-stack">
          <Card className="detail-section">
            <h2>Instructions</h2>
            <p>
              Solve all ten function problems. Show your complete solution and
              label each answer clearly. Submit one PDF file or type your
              response below.
            </p>
            <div className="attachment-row">
              <span>
                <Icon name="file" />
              </span>
              <div>
                <b>Functions-Problem-Set.pdf</b>
                <small>PDF · 1.2 MB</small>
              </div>
              <Button
                variant="ghost"
                icon="eye"
                onClick={() => navigate("material-viewer")}
              >
                View
              </Button>
            </div>
          </Card>
          <Card className="detail-section submission-card">
            <div className="card-head">
              <div>
                <h2>Your Submission</h2>
                <p>Add your response and supporting file.</p>
              </div>
            </div>
            {submitted ? (
              <div className="submitted-state">
                <span>
                  <Icon name="check" />
                </span>
                <div>
                  <h2>Assignment submitted successfully</h2>
                  <p>Submitted May 22, 2025 at 3:42 PM · Awaiting grade</p>
                </div>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>Text response</span>
                  <textarea
                    rows={6}
                    placeholder="Type your response or notes for your teacher..."
                  />
                </label>
                <label className="upload-zone">
                  <Icon name="file" size={25} />
                  <b>{selectedFile || "Choose a file to upload"}</b>
                  <span>
                    {selectedFile
                      ? "File ready for submission"
                      : "PDF, Word, or image · Maximum 20 MB"}
                  </span>
                  <input
                    type="file"
                    onChange={(event) =>
                      setSelectedFile(event.target.files?.[0]?.name || "")
                    }
                  />
                </label>
                <Button onClick={() => setConfirm(true)}>
                  SUBMIT ASSIGNMENT
                </Button>
              </>
            )}
          </Card>
        </div>
        <Card className="assignment-facts">
          <h2>Assignment Details</h2>
          <dl>
            <div>
              <dt>Due date</dt>
              <dd>May 24, 2025</dd>
            </div>
            <div>
              <dt>Due time</dt>
              <dd>11:59 PM</dd>
            </div>
            <div>
              <dt>Maximum points</dt>
              <dd>100 points</dd>
            </div>
            <div>
              <dt>Late submission</dt>
              <dd>Allowed with penalty</dd>
            </div>
          </dl>
        </Card>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div className="modal confirm-modal">
            <span className="confirm-icon">
              <Icon name="check" size={24} />
            </span>
            <h2>Submit Assignment?</h2>
            <p>
              Are you sure you want to submit this assignment? You can only
              resubmit with teacher approval.
            </p>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setConfirm(false)
                  setSubmitted(true)
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </SecureAssessment>
  )
}

function LessonPage({ navigate }: { navigate: (s: string) => void }) {
  const [activeLesson, setActiveLesson] = useState(2)
  const [completedLessons, setCompletedLessons] = useState<number[]>([0, 1])
  const [mediaOpen, setMediaOpen] = useState(false)
  const lessons = [
    ["1", "Introduction to Relations"],
    ["2", "Domain and Range"],
    ["3", "Functions and Relations"],
    ["4", "Evaluating Functions"],
    ["5", "Operations on Functions"],
  ] as const
  const complete = completedLessons.includes(activeLesson)
  const downloadResource = (filename: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <button className="back-link" onClick={() => navigate("class-details")}>
        <Icon name="chevron" size={15} /> Back to Subject
      </button>
      <div className="lesson-layout">
        <Card className="lesson-sidebar">
          <div className="lesson-module-head">
            <span className="eyebrow">LESSON SERIES</span>
            <h2>Functions and Relations</h2>
            <div className="progress-track">
              <i
                style={{
                  width: `${(completedLessons.length / lessons.length) * 100}%`,
                }}
              />
            </div>
            <p>
              {completedLessons.length} of {lessons.length} lessons complete
            </p>
          </div>
          <div className="lesson-list">
            {lessons.map((lesson, index) => (
              <button
                key={lesson[0]}
                className={`${index === activeLesson ? "active" : ""} ${
                  completedLessons.includes(index) ? "complete" : ""
                }`}
                onClick={() => setActiveLesson(index)}
              >
                <span>
                  {completedLessons.includes(index) ? (
                    <Icon name="check" size={14} />
                  ) : (
                    lesson[0]
                  )}
                </span>
                <div>
                  <small>LESSON {lesson[0]}</small>
                  <b>{lesson[1]}</b>
                </div>
              </button>
            ))}
          </div>
        </Card>
        <div className="lesson-content">
          <Card className="lesson-hero">
            <div>
              <span className="eyebrow">
                GENERAL MATHEMATICS · LESSON SERIES
              </span>
              <h1>
                Lesson {lessons[activeLesson][0]}: {lessons[activeLesson][1]}
              </h1>
              <p>
                Learn how to identify functions and represent relationships
                between quantities.
              </p>
            </div>
            <Badge>{complete ? "Completed" : "In Progress"}</Badge>
          </Card>
          <Card className="lesson-paper">
            <section>
              <h2>Learning objectives</h2>
              <p>At the end of this lesson, you should be able to:</p>
              <ul>
                <li>
                  Define a relation and a function using real-world examples.
                </li>
                <li>
                  Determine whether a given relation represents a function.
                </li>
                <li>
                  Represent functions using ordered pairs, tables, graphs, and
                  equations.
                </li>
              </ul>
            </section>
            <section>
              <h2>What is a function?</h2>
              <p>
                A function is a special type of relation where every input has
                exactly one output. Think of a student ID: each ID belongs to
                one student, so the ID-to-student relationship is a function.
              </p>
              <div className="lesson-example">
                <div>
                  <span>INPUT</span>
                  <b>1, 2, 3, 4</b>
                </div>
                <Icon name="arrow" size={24} />
                <div>
                  <span>RULE: f(x) = 2x + 1</span>
                  <b>3, 5, 7, 9</b>
                </div>
              </div>
            </section>
            <section>
              <h2>The vertical line test</h2>
              <p>
                A graph represents a function if no vertical line crosses it
                more than once. If a vertical line intersects the graph at two
                or more points, one input has multiple outputs.
              </p>
              <div className="media-placeholder">
                <Icon name="chart" size={30} />
                <div>
                  <b>Interactive graph: Vertical line test</b>
                  <span>Lesson media · 4 minutes</span>
                </div>
                <Button variant="secondary" onClick={() => setMediaOpen(true)}>
                  Open media
                </Button>
              </div>
            </section>
            <section>
              <h2>Lesson resources</h2>
              <button
                className="lesson-download"
                onClick={() =>
                  downloadResource(
                    "lesson-notes.txt",
                    "SNSHS lesson notes and learning objectives.",
                  )
                }
              >
                <span>
                  <Icon name="file" />
                </span>
                <div>
                  <b>Functions and Relations Notes</b>
                  <small>PDF · 1.8 MB</small>
                </div>
                <Icon name="download" size={18} />
              </button>
              <button
                className="lesson-download"
                onClick={() =>
                  downloadResource(
                    "practice-activity.txt",
                    "SNSHS practice activity. Complete all exercises and submit through the assignment tab.",
                  )
                }
              >
                <span>
                  <Icon name="file" />
                </span>
                <div>
                  <b>Practice Activity 2.3</b>
                  <small>DOCX · 640 KB</small>
                </div>
                <Icon name="download" size={18} />
              </button>
            </section>
          </Card>
          <div className="lesson-actions">
            <Button
              variant="ghost"
              disabled={activeLesson === 0}
              onClick={() =>
                setActiveLesson((current) => Math.max(0, current - 1))
              }
            >
              Previous Lesson
            </Button>
            <Button
              icon="check"
              variant={complete ? "secondary" : "primary"}
              onClick={() =>
                setCompletedLessons((current) =>
                  current.includes(activeLesson)
                    ? current
                    : [...current, activeLesson],
                )
              }
            >
              {complete ? "LESSON COMPLETED" : "MARK AS COMPLETE"}
            </Button>
            <Button
              disabled={activeLesson === lessons.length - 1}
              onClick={() =>
                setActiveLesson((current) =>
                  Math.min(lessons.length - 1, current + 1),
                )
              }
            >
              Next Lesson
            </Button>
          </div>
        </div>
      </div>
      {mediaOpen && (
        <Modal
          title="Interactive lesson media"
          close={() => setMediaOpen(false)}
        >
          <div className="confirm-copy">
            This lesson media demonstrates the current topic with a guided
            example. Use the lesson navigation to continue when finished.
          </div>
          <div className="modal-actions">
            <Button onClick={() => setMediaOpen(false)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function QuizInstructions({ navigate }: { navigate: (s: string) => void }) {
  const [understood, setUnderstood] = useState(false)
  return (
    <SecureAssessment>
      <button className="back-link" onClick={() => navigate("class-details")}>
        <Icon name="chevron" size={15} /> Back to Subject
      </button>
      <div className="secure-notice">
        <Icon name="check" size={16} />
        <span>
          Academic integrity mode is enabled. Copy, cut, paste, dragging, and
          right-click are disabled.
        </span>
      </div>
      <div className="instructions-wrap">
        <Card className="instructions-hero">
          <span>
            <Icon name="quiz" size={30} />
          </span>
          <div>
            <span className="eyebrow">GENERAL MATHEMATICS · QUIZ</span>
            <h1>Quiz 3: Functions</h1>
            <p>Read the information below carefully before starting.</p>
          </div>
          <Badge>Available</Badge>
        </Card>
        <div className="instruction-grid">
          <Card className="instruction-main">
            <h2>Instructions</h2>
            <ol>
              <li>Select the best answer for each question.</li>
              <li>You may move between questions before submitting.</li>
              <li>Your answers are saved while this page remains open.</li>
              <li>The quiz submits automatically when time expires.</li>
            </ol>
            <div className="instruction-warning">
              <Icon name="clock" size={20} />
              <div>
                <b>Complete the quiz in one sitting</b>
                <p>The 30-minute timer begins after you select Start Quiz.</p>
              </div>
            </div>
            <label className="instruction-check">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              <span>I have read and understood the quiz instructions.</span>
            </label>
            <Button
              disabled={!understood}
              onClick={() => navigate("quiz-player")}
            >
              START QUIZ
            </Button>
          </Card>
          <Card className="quiz-facts">
            <h2>Quiz information</h2>
            <dl>
              <div>
                <dt>Questions</dt>
                <dd>20</dd>
              </div>
              <div>
                <dt>Time limit</dt>
                <dd>30 minutes</dd>
              </div>
              <div>
                <dt>Attempts allowed</dt>
                <dd>1 attempt</dd>
              </div>
              <div>
                <dt>Passing score</dt>
                <dd>75%</dd>
              </div>
              <div>
                <dt>Available until</dt>
                <dd>May 27 · 5:00 PM</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </SecureAssessment>
  )
}

function QuizPlayer({ navigate }: { navigate: (s: string) => void }) {
  const [selected, setSelected] = useState(1)
  const [question, setQuestion] = useState(4)
  const [confirm, setConfirm] = useState(false)
  return (
    <SecureAssessment>
      <div className="quiz-shell">
        <div className="secure-notice">
          <Icon name="check" size={16} />
          <span>
            Academic integrity mode is enabled. Clipboard actions and
            right-click are disabled.
          </span>
        </div>
        <Card className="quiz-header">
          <div>
            <span className="eyebrow">SNSHS LMS · ASSESSMENT</span>
            <h1>Quiz 3: Functions</h1>
            <p>General Mathematics</p>
          </div>
          <div className="quiz-timer">
            <Icon name="clock" />
            <span>Time remaining</span>
            <strong>24:18</strong>
          </div>
        </Card>
        <div className="quiz-layout">
          <Card className="question-panel">
            <div className="question-progress">
              <span>Question {question} of 20</span>
              <span>20% complete</span>
            </div>
            <div className="progress-track">
              <i style={{ width: `${question * 5}%` }} />
            </div>
            <span className="question-type">MULTIPLE CHOICE · 2 POINTS</span>
            <h2>Which of the following relations represents a function?</h2>
            <div className="answer-list">
              {[
                "{(1,2), (1,3), (2,4)}",
                "{(1,2), (2,3), (3,4)}",
                "{(2,1), (2,3), (2,5)}",
                "{(1,4), (1,5), (3,6)}",
              ].map((answer, i) => (
                <button
                  key={answer}
                  className={selected === i ? "selected" : ""}
                  onClick={() => setSelected(i)}
                >
                  <span>{String.fromCharCode(65 + i)}</span>
                  {answer}
                  <i>{selected === i && <Icon name="check" size={15} />}</i>
                </button>
              ))}
            </div>
            <div className="question-actions">
              <Button
                variant="ghost"
                onClick={() => setQuestion(Math.max(1, question - 1))}
              >
                Previous
              </Button>
              <Button onClick={() => setQuestion(Math.min(20, question + 1))}>
                Next Question
              </Button>
            </div>
          </Card>
          <Card className="question-nav">
            <h2>Question Navigator</h2>
            <p>Select a question to jump to it.</p>
            <div>
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={
                    n === question
                      ? "current"
                      : n < question
                        ? "answered"
                        : n === 9
                          ? "flagged"
                          : ""
                  }
                  onClick={() => setQuestion(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="question-legend">
              <span>
                <i className="answered" />
                Answered
              </span>
              <span>
                <i className="current" />
                Current
              </span>
              <span>
                <i className="flagged" />
                Flagged
              </span>
            </div>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              SUBMIT ASSESSMENT
            </Button>
          </Card>
        </div>
        {confirm && (
          <div className="modal-backdrop">
            <div className="modal confirm-modal">
              <span className="confirm-icon">
                <Icon name="quiz" size={24} />
              </span>
              <h2>Submit Assessment?</h2>
              <p>
                You have answered 18 of 20 questions.{" "}
                <b>2 questions are unanswered.</b>
              </p>
              <div className="modal-actions">
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Go Back
                </Button>
                <Button onClick={() => navigate("quiz-result")}>Submit</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SecureAssessment>
  )
}

function QuizResult({ navigate }: { navigate: (s: string) => void }) {
  return (
    <SecureAssessment>
      <PageHeading
        title="Quiz Result"
        description="Quiz 3: Functions · General Mathematics"
        action={
          <Button variant="secondary" onClick={() => navigate("class-details")}>
            Back to Subject
          </Button>
        }
      />
      <div className="result-layout">
        <Card className="result-summary">
          <span className="result-icon">
            <Icon name="award" size={30} />
          </span>
          <p className="eyebrow">ASSESSMENT COMPLETE</p>
          <h1>Great work, Juan!</h1>
          <p>You passed Quiz 3: Functions.</p>
          <div className="result-score">
            <strong>17</strong>
            <span>/ 20</span>
          </div>
          <Badge>Passed · 85%</Badge>
        </Card>
        <div className="result-details">
          <div className="result-stats">
            <Card>
              <span className="stat-green">
                <Icon name="check" />
              </span>
              <div>
                <strong>17</strong>
                <small>Correct answers</small>
              </div>
            </Card>
            <Card>
              <span className="stat-red">
                <Icon name="close" />
              </span>
              <div>
                <strong>3</strong>
                <small>Incorrect answers</small>
              </div>
            </Card>
            <Card>
              <span className="stat-blue">
                <Icon name="clock" />
              </span>
              <div>
                <strong>21:42</strong>
                <small>Time used</small>
              </div>
            </Card>
          </div>
          <Card className="feedback-card">
            <div className="card-head">
              <div>
                <h2>Teacher feedback</h2>
                <p>From Maria Santos</p>
              </div>
            </div>
            <p>
              Excellent understanding of function notation and domain. Review
              the vertical line test before the quarterly examination.
            </p>
          </Card>
          <Card className="review-card">
            <div>
              <h2>Answer review</h2>
              <p>Review your responses and the correct answers.</p>
            </div>
            <Button onClick={() => navigate("quiz-player")}>
              REVIEW ANSWERS
            </Button>
          </Card>
        </div>
      </div>
    </SecureAssessment>
  )
}

function GradesPage({
  role,
  selectedClassCode,
}: {
  role: Role
  selectedClassCode: string
}) {
  const settings = useGradingSettings()
  const { records: scoreRecords, error: scoreError } = useApiRecords("scores")
  const gradebook = scoreRecords
    .flatMap((record) => {
      const fields = ["quiz1", "quiz2", "activity", "performance", "exam"]
      if (
        typeof record.studentId !== "string" ||
        typeof record.name !== "string" ||
        !fields.every((field) => Number.isFinite(Number(record[field])))
      ) {
        return []
      }
      const score: RecordedScore = {
        studentId: record.studentId,
        name: record.name,
        quiz1: Number(record.quiz1),
        quiz2: Number(record.quiz2),
        activity: Number(record.activity),
        performance: Number(record.performance),
        exam: Number(record.exam),
      }
      return [
        {
          ...score,
          subject: String(record.subject || ""),
          teacher: String(record.teacher || ""),
          scopeId: String(record.scopeId || ""),
          ...calculateGradeBreakdown(score, settings),
        },
      ]
    })
    .filter(
      (grade) =>
        role !== "teacher" ||
        !selectedClassCode ||
        grade.scopeId === selectedClassCode,
    )
  const selectedGrade = gradebook[0]
  const studentSubjectGrades = gradebook.map((grade) => ({
    classItem: {
      subject: grade.subject,
      code: grade.scopeId,
      teacher: grade.teacher || "—",
      color: "emerald",
      schoolYear: "",
    },
    ...grade,
  }))
  const selectedClass = studentSubjectGrades[0]?.classItem || {
    subject: "My subjects",
    teacher: "",
    schoolYear: "",
  }
  const automaticAverage = studentSubjectGrades.length
    ? studentSubjectGrades.reduce((sum, grade) => sum + grade.final, 0) /
      studentSubjectGrades.length
    : null
  const [enrollments, setEnrollments] = useState<Record<string, unknown>[]>([])
  const [enrollmentError, setEnrollmentError] = useState("")
  const [gradeDrafts, setGradeDrafts] =
    useState<Record<string, Record<string, string>>>({})
  const [gradeSaveError, setGradeSaveError] = useState("")
  const [gradeSaveMessage, setGradeSaveMessage] = useState("")
  const [savingGrade, setSavingGrade] = useState("")
  useEffect(() => {
    if (role === "student") return
    let active = true
    void apiFetch("/api/enrollments")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            payload?.message || "Unable to load enrolled students.",
          )
        }
        return payload
      })
      .then((payload) => {
        if (active) {
          setEnrollments(payload)
          setEnrollmentError("")
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setEnrollmentError(
            cause instanceof Error
              ? cause.message
              : "Unable to load enrolled students.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [role])
  if (role === "student")
    return (
      <>
        <PageHeading
          title="My Grades"
          description="Grades currently recorded for your enrolled subjects."
        />
        <Card className="grade-summary">
          <div>
            <span>General Average</span>
            <strong>{automaticAverage?.toFixed(2) || "—"}</strong>
            {automaticAverage !== null && <Badge tone="active">Recorded</Badge>}
          </div>
          <p>
            Teachers record your assessment and activity scores. Weighted
            components and final grades are calculated from the school grading
            policy.
          </p>
        </Card>
        <Card className="table-card">
          <DataTable
            actions={false}
            headers={[
              "Subject",
              "Teacher",
              "Written Works",
              "Performance Tasks",
              "Exams",
              "Final Grade",
            ]}
            rows={studentSubjectGrades.map(({ classItem: c, ...grade }) => {
              return [
                <div className="subject-cell">
                  <span className={`dot ${c.color}`} />
                  <b>{c.subject}</b>
                </div>,
                c.teacher,
                grade.written.toFixed(2),
                grade.performance.toFixed(2),
                grade.exams.toFixed(2),
                <strong className="grade-value">
                  {grade.final.toFixed(2)}
                </strong>,
              ]
            })}
          />
        </Card>
        {scoreError && (
          <p className="form-error" role="alert">
            {scoreError}
          </p>
        )}
        {!selectedGrade && (
          <Card className="table-empty">No grades are available yet.</Card>
        )}
        {selectedGrade && (
          <Card className="calculation">
            <div className="card-head">
              <div>
                <h2>Grade Calculation</h2>
                <p>
                  {selectedClass.subject} · {selectedClass.teacher}
                </p>
              </div>
            </div>
            <div className="formula-grid">
              <div>
                <span>Written Works</span>
                <strong>
                  {selectedGrade.written.toFixed(2)} × {settings.written}%
                </strong>
                <b>
                  ={" "}
                  {(selectedGrade.written * (settings.written / 100)).toFixed(
                    2,
                  )}
                </b>
              </div>
              <div>
                <span>Performance Tasks</span>
                <strong>
                  {selectedGrade.performance.toFixed(2)} ×{" "}
                  {settings.performance}%
                </strong>
                <b>
                  ={" "}
                  {(
                    selectedGrade.performance *
                    (settings.performance / 100)
                  ).toFixed(2)}
                </b>
              </div>
              <div>
                <span>Exams</span>
                <strong>
                  {selectedGrade.exams.toFixed(2)} × {settings.exams}%
                </strong>
                <b>
                  = {(selectedGrade.exams * (settings.exams / 100)).toFixed(2)}
                </b>
              </div>
              <div className="final-formula">
                <span>FINAL GRADE</span>
                <b>{selectedGrade.final.toFixed(2)}</b>
              </div>
            </div>
          </Card>
        )}
      </>
    )
  return (
    <>
      <PageHeading
        title="Gradebook"
        description="Enter component scores; final grades are calculated automatically."
      />
      {scoreError && (
        <p className="form-error" role="alert">
          {scoreError}
        </p>
      )}
      {enrollmentError && (
        <p className="form-error" role="alert">
          {enrollmentError}
        </p>
      )}
      {gradeSaveError && (
        <p className="form-error" role="alert">
          {gradeSaveError}
        </p>
      )}
      {gradeSaveMessage && (
        <p className="success-message" role="status">
          {gradeSaveMessage}
        </p>
      )}
      <Card className="automatic-grading-note">
        <span>
          <Icon name="check" size={20} />
        </span>
        <div>
          <h2>Weighted grade calculation</h2>
          <p>
            Enter quiz scores out of 20, activity scores out of 50, performance
            task scores out of 100, and exam scores out of 50. Weighted
            components and final grades follow the administrator’s grading
            policy.
          </p>
        </div>
      </Card>
      <div className="gradebook-info">
        <div>
          <span>Written Works</span>
          <b>{settings.written}%</b>
        </div>
        <div>
          <span>Performance Tasks</span>
          <b>{settings.performance}%</b>
        </div>
        <div>
          <span>Exams</span>
          <b>{settings.exams}%</b>
        </div>
        <div>
          <span>Total</span>
          <b>100%</b>
        </div>
      </div>
      <Card className="table-card">
        <DataTable
          actions={false}
          headers={[
            "Student",
            "Subject",
            "Quiz 1",
            "Quiz 2",
            "Activity",
            "Performance",
            "Exam",
            "Final",
            "Save",
          ]}
          rows={(() => {
            const uniqueEnrollments = new Map<string, Record<string, unknown>>()
            enrollments
              .filter(
                (enrollment) =>
                  (enrollment.status || "active") === "active" &&
                  (role !== "teacher" ||
                    !selectedClassCode ||
                    String(enrollment.subjectSectionId) === selectedClassCode),
              )
              .forEach((enrollment) => {
                const key = `${String(enrollment.subjectSectionId)}:${String(enrollment.studentId)}`
                if (!uniqueEnrollments.has(key))
                  uniqueEnrollments.set(key, enrollment)
              })
            return [...uniqueEnrollments.entries()].map(([key, enrollment]) => {
              const scopeId = String(enrollment.subjectSectionId || "")
              const studentId = String(enrollment.studentId || "")
              const existing = scoreRecords.find(
                (record) =>
                  record.studentId === studentId &&
                  String(record.scopeId || "") === scopeId,
              )
              const draft =
                gradeDrafts[key] ||
                Object.fromEntries(
                  ["quiz1", "quiz2", "activity", "performance", "exam"].map(
                    (field) => [
                      field,
                      existing?.[field] === undefined
                        ? ""
                        : String(existing[field]),
                    ],
                  ),
                )
              const savedGrade = gradebook.find(
                (grade) =>
                  grade.studentId === studentId && grade.scopeId === scopeId,
              )
              return [
                <div>
                  <b>{String(enrollment.studentName || studentId)}</b>
                  <small>{studentId}</small>
                </div>,
                String(enrollment.subjectName || "—"),
                ...([
                  "quiz1",
                  "quiz2",
                  "activity",
                  "performance",
                  "exam",
                ] as const).map((field) => (
                  <input
                    className="grade-score-input"
                    aria-label={`${String(enrollment.studentName || studentId)} ${field}`}
                    type="number"
                    min="0"
                    max={
                      field === "quiz1" || field === "quiz2"
                        ? 20
                        : field === "activity" || field === "exam"
                          ? 50
                          : 100
                    }
                    step="0.1"
                    value={draft[field] || ""}
                    onChange={(event) => {
                      setGradeSaveError("")
                      setGradeSaveMessage("")
                      setGradeDrafts((current) => ({
                        ...current,
                        [key]: {
                          ...(current[key] || draft),
                          [field]: event.target.value,
                        },
                      }))
                    }}
                  />
                )),
                savedGrade ? (
                  <strong className="grade-value">
                    {savedGrade.final.toFixed(2)}
                  </strong>
                ) : (
                  "—"
                ),
                <Button
                  variant="secondary"
                  disabled={savingGrade === key || !scopeId || !studentId}
                  onClick={async () => {
                    const ranges: Record<string, number> = {
                      quiz1: 20,
                      quiz2: 20,
                      activity: 50,
                      performance: 100,
                      exam: 50,
                    }
                    const values = Object.fromEntries(
                      Object.keys(ranges).map((field) => [
                        field,
                        Number(draft[field]),
                      ]),
                    )
                    const invalid = Object.entries(ranges).find(
                      ([field, maximum]) =>
                        !draft[field]?.trim() ||
                        !Number.isFinite(values[field]) ||
                        values[field] < 0 ||
                        values[field] > maximum,
                    )
                    if (invalid) {
                      setGradeSaveError(
                        `${invalid[0]} must be a number between 0 and ${invalid[1]}.`,
                      )
                      setGradeSaveMessage("")
                      return
                    }
                    setSavingGrade(key)
                    setGradeSaveError("")
                    setGradeSaveMessage("")
                    try {
                      await saveApiRecord(
                        "scores",
                        {
                          studentId,
                          ...values,
                        },
                        scopeId,
                        String(existing?.id || `${scopeId}:${studentId}`),
                      )
                      setGradeDrafts((current) => {
                        const next = { ...current }
                        delete next[key]
                        return next
                      })
                      setGradeSaveMessage(
                        `Scores saved for ${String(enrollment.studentName || studentId)}.`,
                      )
                    } catch (cause) {
                      setGradeSaveError(
                        cause instanceof Error
                          ? cause.message
                          : "Unable to save these scores.",
                      )
                    } finally {
                      setSavingGrade("")
                    }
                  }}
                >
                  {savingGrade === key ? "Saving..." : "Save"}
                </Button>,
              ]
            })
          })()}
        />
      </Card>
      {!enrollmentError && !enrollments.length && (
        <Card className="table-empty">
          No active subject enrollments are available for grade entry.
        </Card>
      )}
    </>
  )
}

function AnnouncementsPage({
  role,
  openModal,
  unreadCount,
  onUnreadCountChange,
}: {
  role: Role
  openModal: (s: string) => void
  unreadCount: number
  onUnreadCountChange: (count: number) => void
}) {
  type Announcement = {
    id: string
    title: string
    author: string
    audience: string
    body: string
    date: string
    unread: boolean
    recent: boolean
  }
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementError, setAnnouncementError] = useState("")
  const [view, setView] = useState<"All" | "Unread" | "Recent">("All")
  const [selected, setSelected] = useState<Announcement | null>(null)
  useEffect(() => {
    let active = true
    const loadAnnouncements = async () => {
      try {
        const [announcementsResponse, notificationsResponse] =
          await Promise.all([
            apiFetch("/api/records/announcements"),
            apiFetch("/api/records/notifications"),
          ])
        const [announcementRecords, notificationRecords] = await Promise.all([
          announcementsResponse.json(),
          notificationsResponse.json(),
        ])
        if (
          !announcementsResponse.ok ||
          !notificationsResponse.ok ||
          !Array.isArray(announcementRecords) ||
          !Array.isArray(notificationRecords)
        ) {
          throw new Error("Unable to load announcements.")
        }
        let userId = ""
        try {
          userId =
            JSON.parse(localStorage.getItem("snhs-demo-session") || "null")
              ?.schoolId || ""
        } catch {
          throw new Error("Your session is invalid. Sign in again.")
        }
        const readIds = new Set(
          notificationRecords
            .filter((record) => record.read)
            .map((record) => String(record.announcementId)),
        )
        const records = announcementRecords.map((record) => {
          const createdAt = new Date(record.date || record.updatedAt)
          const age = Date.now() - createdAt.getTime()
          return {
            id: String(record.id),
            title: String(record.title || ""),
            author: String(record.author || ""),
            audience: String(record.audience || "School-wide"),
            body: String(record.body || ""),
            date: Number.isNaN(createdAt.getTime())
              ? ""
              : createdAt.toLocaleString("en-PH"),
            unread: !readIds.has(String(record.id)),
            recent: Number.isFinite(age) && age >= 0 && age < 7 * 86400000,
          }
        })
        if (!active) return
        setAnnouncements(records)
        onUnreadCountChange(records.filter((record) => record.unread).length)
        setAnnouncementError("")
      } catch (error) {
        if (active) {
          setAnnouncementError(
            error instanceof Error
              ? error.message
              : "Unable to load announcements.",
          )
        }
      }
    }
    void loadAnnouncements()
    window.addEventListener("snhs-announcements-updated", loadAnnouncements)
    return () => {
      active = false
      window.removeEventListener(
        "snhs-announcements-updated",
        loadAnnouncements,
      )
    }
  }, [onUnreadCountChange])
  const isUnread = (announcement: typeof announcements[number]) =>
    announcement.unread
  const visibleAnnouncements = announcements.filter((announcement) =>
    view === "Unread"
      ? isUnread(announcement)
      : view === "Recent"
        ? announcement.recent
        : true,
  )
  const openAnnouncement = async (announcement: Announcement) => {
    setSelected(announcement)
    if (isUnread(announcement)) {
      try {
        const userId = JSON.parse(
          localStorage.getItem("snhs-demo-session") || "null",
        )?.schoolId
        if (!userId) throw new Error("Your user identity is unavailable.")
        await saveApiRecord(
          "notifications",
          { announcementId: announcement.id, read: true },
          "",
          `${userId}-${announcement.id}`,
          userId,
        )
        setAnnouncements((current) =>
          current.map((record) =>
            record.id === announcement.id
              ? { ...record, unread: false }
              : record,
          ),
        )
        onUnreadCountChange(Math.max(0, unreadCount - 1))
      } catch (error) {
        setAnnouncementError(
          error instanceof Error ? error.message : "Unable to mark as read.",
        )
      }
    }
  }

  return (
    <>
      <PageHeading
        title="Announcements"
        description="Stay informed with the latest school and class updates."
        action={
          role !== "student" ? (
            <Button
              icon="plus"
              onClick={() => openModal("Create Announcement")}
            >
              Create Announcement
            </Button>
          ) : undefined
        }
      />
      {announcementError && (
        <p className="form-error" role="alert">
          {announcementError}
        </p>
      )}
      <div className="tabs">
        {(["All", "Unread", "Recent"] as const).map((tab) => (
          <button
            className={view === tab ? "active" : ""}
            key={tab}
            onClick={() => setView(tab)}
          >
            {tab}{" "}
            <span>
              {tab === "All"
                ? announcements.length
                : tab === "Unread"
                  ? announcements.filter(isUnread).length
                  : announcements.filter((announcement) => announcement.recent)
                      .length}
            </span>
          </button>
        ))}
      </div>
      <div className="announcement-list">
        {visibleAnnouncements.map((announcement, index) => (
          <button
            className={`card announcement ${
              isUnread(announcement) ? "unread" : ""
            }`}
            key={announcement.id}
            onClick={() => openAnnouncement(announcement)}
          >
            <div className="announcement-icon">
              <Icon name="bell" />
            </div>
            <div>
              <div>
                <Badge tone={index === 0 ? "warning" : "active"}>
                  {announcement.audience}
                </Badge>
                <span>{announcement.date}</span>
              </div>
              <h2>
                {announcement.title}
                {isUnread(announcement) && <i>Unread</i>}
              </h2>
              <p>{announcement.body}</p>
              <small>
                Posted by <b>{announcement.author}</b>
              </small>
            </div>
            <span className="announcement-arrow" aria-hidden="true">
              <Icon name="arrow" />
            </span>
          </button>
        ))}
        {!visibleAnnouncements.length && (
          <Card className="announcement-empty">
            <Icon name="check" size={24} />
            <h2>No unread announcements</h2>
            <p>You're all caught up.</p>
          </Card>
        )}
      </div>
      {selected && (
        <Modal title={selected.title} close={() => setSelected(null)}>
          <div className="announcement-detail">
            <div>
              <Badge>{selected.audience}</Badge>
              <span>{selected.date}</span>
            </div>
            <p>{selected.body}</p>
            <small>
              Posted by <b>{selected.author}</b>
            </small>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSelected(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function CalendarPage({
  role,
  openModal,
}: {
  role: Role
  openModal: (name: string) => void
}) {
  type CalendarEvent = {
    id: string
    title: string
    type: "class" | "assignment" | "quiz" | "event"
    date: Date
  }
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarError, setCalendarError] = useState("")
  const [filter, setFilter] = useState("All")
  useEffect(() => {
    let active = true
    const loadEvents = () => {
      void apiFetch("/api/records/calendar-events")
        .then(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok || !Array.isArray(payload)) {
            throw new Error(
              payload?.message || "Unable to load calendar events.",
            )
          }
          return payload
        })
        .then((records) => {
          if (!active) return
          const events = records.flatMap((record: Record<string, unknown>) => {
            const type = String(record.type || "event")
            const date = new Date(
              String(record.date || record.startAt || record.dueDate || ""),
            )
            if (
              !["class", "assignment", "quiz", "event"].includes(type) ||
              !String(record.title || "").trim() ||
              Number.isNaN(date.getTime())
            ) {
              return []
            }
            return [
              {
                id: String(record.id),
                title: String(record.title),
                type: type as CalendarEvent["type"],
                date,
              },
            ]
          })
          setCalendarEvents(events)
          setCalendarError("")
        })
        .catch((cause: unknown) => {
          if (active) {
            setCalendarError(
              cause instanceof Error
                ? cause.message
                : "Unable to load calendar events.",
            )
          }
        })
    }
    loadEvents()
    window.addEventListener("snhs-records-updated", loadEvents)
    return () => {
      active = false
      window.removeEventListener("snhs-records-updated", loadEvents)
    }
  }, [])
  const schoolDateParts = new Intl.DateTimeFormat("en-PH", {
    timeZone: schoolTimeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(schoolDateParts.find((item) => item.type === type)?.value)
  const today = new Date(part("year"), part("month") - 1, part("day"))
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDay, setSelectedDay] = useState<Date | null>(today)
  const [selectedEvent, setSelectedEvent] = useState<{
    title: string
    type: "class" | "assignment" | "quiz" | "event"
    date: Date
  } | null>(null)
  const filters = ["All", "Classes", "Assignments", "Quizzes", "School Events"]
  const typeLabel = {
    class: "Classes",
    assignment: "Assignments",
    quiz: "Quizzes",
    event: "School Events",
  }
  const monthLabel = new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
  }).format(month)
  const firstWeekday = month.getDay()
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      month.getFullYear(),
      month.getMonth(),
      index - firstWeekday + 1,
    )
    return {
      date,
      inMonth: date.getMonth() === month.getMonth(),
    }
  })
  const matchesFilter = (event: CalendarEvent) =>
    filter === "All" || typeLabel[event.type] === filter
  const monthlyAgenda = calendarEvents
    .filter(
      (event) =>
        event.date.getFullYear() === month.getFullYear() &&
        event.date.getMonth() === month.getMonth() &&
        matchesFilter(event),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5)
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  const showMonth = (offset: number) => {
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    )
    setSelectedDay(null)
  }
  const goToToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(today)
  }
  const viewingToday =
    month.getFullYear() === today.getFullYear() &&
    month.getMonth() === today.getMonth() &&
    selectedDay !== null &&
    isSameDay(selectedDay, today)
  const shortToday = today.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  })

  return (
    <>
      <PageHeading
        title="Calendar"
        description="Keep track of classes, deadlines, quizzes, exams, and school events."
        action={
          <>
            {role !== "student" && (
              <Button
                icon="plus"
                onClick={() => openModal("Create Calendar Event")}
              >
                Add Event
              </Button>
            )}
            <Button
              variant="secondary"
              icon="calendar"
              onClick={goToToday}
              disabled={viewingToday}
              title={
                viewingToday
                  ? "You are already viewing today"
                  : "Return to the current Philippine date"
              }
            >
              {viewingToday ? `Today · ${shortToday}` : "Back to today"}
            </Button>
          </>
        }
      />
      {calendarError && (
        <p className="form-error" role="alert">
          {calendarError}
        </p>
      )}
      <div className="calendar-layout">
        <Card className="calendar-card">
          <div className="calendar-toolbar">
            <div>
              <button aria-label="Previous month" onClick={() => showMonth(-1)}>
                <Icon name="chevron" size={16} />
              </button>
              <h2>{monthLabel}</h2>
              <button
                aria-label="Next month"
                className="next-month"
                onClick={() => showMonth(1)}
              >
                <Icon name="chevron" size={16} />
              </button>
            </div>
            <div className="calendar-filters">
              {filters.map((item) => (
                <button
                  key={item}
                  className={filter === item ? "active" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="calendar-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map(({ date, inMonth }) => {
              const events = inMonth
                ? calendarEvents.filter(
                    (event) =>
                      isSameDay(event.date, date) && matchesFilter(event),
                  )
                : []
              return (
                <div
                  className={`calendar-day ${!inMonth ? "outside" : ""} ${
                    isSameDay(date, today) ? "today" : ""
                  } ${
                    selectedDay && isSameDay(date, selectedDay)
                      ? "selected"
                      : ""
                  }`}
                  key={date.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDay(date)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setSelectedDay(date)
                    }
                  }}
                >
                  <span>{date.getDate()}</span>
                  {events.map((event) => (
                    <button
                      className={`calendar-event event-${event.type}`}
                      key={event.id}
                      title={event.title}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        setSelectedDay(date)
                        setSelectedEvent({ ...event, date })
                      }}
                    >
                      <i />
                      {event.title}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        </Card>
        <div className="calendar-side">
          <Card className="calendar-agenda">
            <div className="card-head">
              <div>
                <h2>Upcoming</h2>
                <p>{monthLabel}</p>
              </div>
            </div>
            {monthlyAgenda.map((item) => (
              <button
                className="agenda-item"
                key={`${item.date.getDate()}-${item.title}`}
                onClick={() => {
                  setSelectedDay(item.date)
                  setSelectedEvent(item)
                }}
              >
                <span>
                  <b>{item.date.getDate()}</b>
                  <small>
                    {item.date
                      .toLocaleDateString("en-PH", { month: "short" })
                      .toUpperCase()}
                  </small>
                </span>
                <div>
                  <b>{item.title}</b>
                  <small>{typeLabel[item.type]}</small>
                </div>
                <i className={`event-${item.type}`} />
              </button>
            ))}
            {!monthlyAgenda.length && (
              <p className="agenda-empty">No events match this filter.</p>
            )}
          </Card>
          <Card className="calendar-legend">
            <h2>Event types</h2>
            <div>
              {[
                ["class", "Classes"],
                ["assignment", "Assignments"],
                ["quiz", "Quizzes & Exams"],
                ["event", "School Events"],
              ].map((item) => (
                <span key={item[0]}>
                  <i className={`event-${item[0]}`} />
                  {item[1]}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {selectedEvent && (
        <Modal title={selectedEvent.title} close={() => setSelectedEvent(null)}>
          <div className="calendar-event-detail">
            <Badge>{typeLabel[selectedEvent.type]}</Badge>
            <p>
              {selectedEvent.date.toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <small>
              Open the related class or activity page for complete details and
              instructions.
            </small>
          </div>
          <div className="modal-actions">
            <Button onClick={() => setSelectedEvent(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function NotificationsPage({
  onUnreadCountChange,
  userId,
}: {
  onUnreadCountChange: (count: number) => void
  userId: string
}) {
  type NotificationRecord = {
    id: string
    title: string
    detail: string
    createdAt: string
    icon: IconName
    unread: boolean
  }
  const [items, setItems] = useState<NotificationRecord[]>([])
  const [view, setView] = useState("All")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void apiFetch(
      `/api/records/notifications?ownerId=${encodeURIComponent(userId)}`,
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(payload?.message || "Unable to load notifications.")
        }
        return payload
      })
      .then((records) => {
        if (!active) return
        setItems(
          records.map((record: Record<string, unknown>) => ({
            id: String(record.id),
            title: String(record.title || "Notification"),
            detail: String(record.detail || ""),
            createdAt: String(record.createdAt || record.updatedAt || ""),
            icon: (["file", "quiz", "chart", "bell", "check"].includes(
              String(record.icon),
            )
              ? String(record.icon)
              : "bell") as IconName,
            unread: record.read !== true,
          })),
        )
        setError("")
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load notifications.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [userId])
  useEffect(() => {
    onUnreadCountChange(items.filter((item) => item.unread).length)
  }, [items, onUnreadCountChange])

  const markRead = async (item: NotificationRecord) => {
    try {
      await saveApiRecord(
        "notifications",
        { title: item.title, detail: item.detail, icon: item.icon, read: true },
        "",
        item.id,
        userId,
      )
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, unread: false } : entry,
        ),
      )
      window.dispatchEvent(new Event("snhs-notifications-updated"))
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update notification.",
      )
    }
  }
  const markAllRead = async () => {
    try {
      await Promise.all(items.filter((item) => item.unread).map(markRead))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to update notifications.",
      )
    }
  }
  const clearNotification = async (item: NotificationRecord) => {
    try {
      const response = await apiFetch(
        `/api/records/notifications/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to clear notification.")
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      window.dispatchEvent(new Event("snhs-notifications-updated"))
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to clear notification.",
      )
    }
  }
  const visibleItems =
    view === "Unread" ? items.filter((item) => item.unread) : items

  return (
    <>
      <PageHeading
        title="Notifications"
        description="Review your academic reminders and recent account activity."
        action={
          <Button
            variant="secondary"
            icon="check"
            onClick={() => void markAllRead()}
            disabled={!items.some((item) => item.unread)}
          >
            Mark all as read
          </Button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="tabs">
        <button
          className={view === "All" ? "active" : ""}
          onClick={() => setView("All")}
        >
          All <span>{items.length}</span>
        </button>
        <button
          className={view === "Unread" ? "active" : ""}
          onClick={() => setView("Unread")}
        >
          Unread <span>{items.filter((item) => item.unread).length}</span>
        </button>
      </div>
      <Card className="notifications-page-list">
        {visibleItems.length ? (
          visibleItems.map((item) => (
            <div
              className={`notification-row ${item.unread ? "unread" : ""}`}
              key={item.id}
            >
              <button
                className="notification-content"
                onClick={() => void markRead(item)}
              >
                <span>
                  <Icon name={item.icon} size={19} />
                </span>
                <div>
                  <b>
                    {item.title}
                    {item.unread && <i />}
                  </b>
                  <p>{item.detail}</p>
                  <small>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : ""}
                  </small>
                </div>
              </button>
              <button
                className="notification-clear"
                aria-label={`Clear ${item.title}`}
                onClick={() => void clearNotification(item)}
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          ))
        ) : (
          <div className="notification-empty">
            <span>
              <Icon name="check" size={24} />
            </span>
            <h2>You're all caught up</h2>
            <p>There are no unread notifications right now.</p>
          </div>
        )}
      </Card>
    </>
  )
}

function ProfilePage({
  role,
  userId,
  photo,
  onPhotoChange,
}: {
  role: Role
  userId: string
  photo: string | null
  onPhotoChange: (photo: string) => void
}) {
  const isStudent = role === "student"
  const isAdmin = role === "admin"
  const [adminProfile, setAdminProfile] = useState({
    id: userId,
    name: "",
    email: "",
  })
  const [profileData, setProfileData] = useState<Record<string, string>>({})
  const [profileError, setProfileError] = useState("")
  const [profileMessage, setProfileMessage] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [passwordSaving, setPasswordSaving] = useState(false)
  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith("image/")) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") onPhotoChange(reader.result)
    }
    reader.readAsDataURL(file)
    event.target.value = ""
  }
  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError("")
    setPasswordMessage("")
    setPasswordSaving(true)
    try {
      const response = await apiFetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to update your password.")
      }
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordMessage(payload.message || "Password updated successfully.")
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : "Unable to update your password.",
      )
    } finally {
      setPasswordSaving(false)
    }
  }
  useEffect(() => {
    let active = true
    void apiFetch("/api/me")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload) {
          throw new Error(payload?.message || "Unable to load your profile.")
        }
        return payload
      })
      .then((profile) => {
        if (!active) return
        const values = {
          id: String(profile.id || ""),
          name: String(profile.name || ""),
          email: String(profile.email || ""),
          role: String(profile.role || role),
          gradeLevel: String(profile.gradeLevel || ""),
          section: String(profile.section || ""),
          subject: String(profile.subject || ""),
        }
        setProfileData(values)
        if (isAdmin) {
          setAdminProfile({
            id: values.id,
            name: values.name,
            email: values.email,
          })
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setProfileError(
            error instanceof Error
              ? error.message
              : "Unable to load your profile.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [isAdmin, role])
  const saveAdminProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileError("")
    setProfileMessage("")
    setProfileSaving(true)
    try {
      const response = await apiFetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: adminProfile.id,
          name: adminProfile.name,
          email: adminProfile.email,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.profile) {
        throw new Error(payload?.message || "Unable to save your profile.")
      }
      setAdminProfile({
        id: String(payload.profile.id),
        name: String(payload.profile.name),
        email: String(payload.profile.email),
      })
      setProfileData((current) => ({
        ...current,
        id: String(payload.profile.id),
        name: String(payload.profile.name),
        email: String(payload.profile.email),
      }))
      window.dispatchEvent(
        new CustomEvent("snhs-profile-updated", {
          detail: {
            id: String(payload.profile.id),
            name: String(payload.profile.name),
          },
        }),
      )
      setProfileMessage("Personal information updated successfully.")
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to save your profile.",
      )
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        title="My Profile"
        description="View your personal and school information."
      />
      <div className="profile-grid">
        <Card className="profile-card">
          <div className="profile-cover" />
          <label className="profile-photo-picker" title="Change profile photo">
            <ProfileAvatar role={role} className="profile-avatar" src={photo} />
            <span>
              <Icon name="edit" size={14} />
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={selectPhoto}
              aria-label="Choose a new profile photo"
            />
          </label>
          <h2>{isAdmin ? adminProfile.name : profileData.name || role}</h2>
          <p>
            {isStudent
              ? [profileData.gradeLevel, profileData.section]
                  .filter(Boolean)
                  .join(" · ") || "Student"
              : isAdmin
                ? "Administrator"
                : profileData.subject
                  ? `Teacher · ${profileData.subject}`
                  : "Teacher"}
          </p>
          <div className="profile-id">
            <span>
              {isStudent ? "STUDENT ID" : isAdmin ? "ADMIN ID" : "TEACHER ID"}
            </span>
            <strong>
              {isAdmin
                ? adminProfile.id || userId
                : profileData.id || userId || "—"}
            </strong>
          </div>
        </Card>
        <Card className="profile-details">
          <div className="card-head">
            <div>
              <h2>Personal Information</h2>
              <p>
                {isAdmin
                  ? "Edit the name, email, and administrator ID for your account."
                  : "Protected information is managed by the school administrator."}
              </p>
            </div>
          </div>
          {isAdmin ? (
            <form onSubmit={saveAdminProfile}>
              <div className="form-grid">
                <label className="field">
                  <span>Full Name</span>
                  <input
                    autoComplete="name"
                    value={adminProfile.name}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
                        name: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={adminProfile.email}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
                        email: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <div className="field">
                  <span>Administrator ID</span>
                  <input
                    value={adminProfile.id}
                    onChange={(event) =>
                      setAdminProfile({
                        ...adminProfile,
                        id: event.target.value,
                      })
                    }
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="field">
                  <span>Role</span>
                  <input value="Administrator" readOnly aria-readonly="true" />
                </div>
              </div>
              {profileError && (
                <p className="form-error" role="alert">
                  {profileError}
                </p>
              )}
              {profileMessage && (
                <p className="form-success" role="status">
                  {profileMessage}
                </p>
              )}
              <Button
                type="submit"
                disabled={
                  profileSaving ||
                  !adminProfile.id.trim() ||
                  !adminProfile.name.trim() ||
                  !adminProfile.email.trim()
                }
              >
                {profileSaving ? "Saving..." : "Save Personal Information"}
              </Button>
            </form>
          ) : (
            <div className="details-grid">
              {[
                ["Full Name", profileData.name],
                ["Role", profileData.role],
                ["ID", profileData.id],
                ["Email", profileData.email],
                ...(isStudent
                  ? [
                      ["Grade Level", profileData.gradeLevel],
                      ["Section", profileData.section],
                    ]
                  : []),
                ...(!isStudent && !isAdmin && profileData.subject
                  ? [["Subject", profileData.subject]]
                  : []),
              ]
                .filter((entry) => Boolean(entry[1]))
                .map((d) => (
                  <div key={d[0]}>
                    <span>{d[0]}</span>
                    <strong>{d[1]}</strong>
                  </div>
                ))}
            </div>
          )}
        </Card>
        <Card className="profile-details password-card">
          <div className="card-head">
            <div>
              <h2>Change Password</h2>
              <p>
                Use your current password and choose a new one with at least 12
                characters.
              </p>
            </div>
          </div>
          <form onSubmit={changePassword}>
            <div className="form-grid">
              <label className="field full">
                <span>Current Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>New Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Confirm New Password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>
            </div>
            {passwordError && (
              <p className="form-error" role="alert">
                {passwordError}
              </p>
            )}
            {passwordMessage && (
              <p className="form-success" role="status">
                {passwordMessage}
              </p>
            )}
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Card>
      </div>
    </>
  )
}

function ManagementPage({
  kind,
  navigate,
  openModal,
}: {
  kind: "students" | "teachers" | "subjects"
  navigate: (page: string) => void
  openModal: (s: string) => void
}) {
  const isStudents = kind === "students",
    isTeachers = kind === "teachers",
    isSubjects = kind === "subjects"
  const singular = isStudents ? "Student" : isTeachers ? "Teacher" : "Subject"
  const title = isStudents
    ? "Manage Students"
    : isTeachers
      ? "Manage Teachers"
      : "Subject Management"
  const headers = isStudents
    ? ["Student ID", "Name", "Grade", "Strand", "Section"]
    : isTeachers
      ? ["Teacher ID", "Name", "Subject", "Email"]
      : [
          "Subject ID",
          "Code",
          "Subject Name",
          "Grade",
          "Semester",
          "Description",
          "Units",
        ]
  const [records, setRecords] = useState<string[][]>([])
  const [classSectionOptions, setClassSectionOptions] = useState<{
    code: string
    name: string
    section: string
    gradeLevel: string
    strand: string
    schoolYear: string
    academicYearId: string
    gradeLevelId: string
    strandId: string
  }[]>([])
  const [academicYears, setAcademicYears] = useState<
    { id: string; code: string; isCurrent: boolean }[]
  >([])
  const [gradeLevels, setGradeLevels] = useState<
    { id: string; name: string; number: number }[]
  >([])
  const [strands, setStrands] = useState<
    { id: string; code: string; name: string }[]
  >([])
  const [academicYearIdByStudent, setAcademicYearIdByStudent] = useState<
    Record<string, string>
  >({})
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("")
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState("")
  const [selectedStrandId, setSelectedStrandId] = useState("")
  const [classSectionLoadError, setClassSectionLoadError] = useState("")
  const [classSectionLoading, setClassSectionLoading] = useState(false)
  const [classSectionCodeByStudentId, setClassSectionCodeByStudentId] =
    useState<Record<string, string>>({})
  const [emailByStudentId, setEmailByStudentId] =
    useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [recordError, setRecordError] = useState("")
  const [createdStudentId, setCreatedStudentId] = useState("")
  const [studentEnrollmentMessage, setStudentEnrollmentMessage] = useState("")
  const [createdTeacherId, setCreatedTeacherId] = useState("")
  const [draftEmail, setDraftEmail] = useState("")
  const [draftPassword, setDraftPassword] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [recordMode, setRecordMode] = useState<"view" | "edit" | "add" | null>(
    null,
  )
  const [selectedRecord, setSelectedRecord] = useState<number | null>(null)
  const [draft, setDraft] = useState<string[]>([])
  const [selectedClassSectionCode, setSelectedClassSectionCode] = useState("")
  useEffect(() => {
    let active = true
    const endpoint =
      kind === "students"
        ? "/api/students"
        : kind === "teachers"
          ? "/api/teachers"
          : "/api/subjects"
    void apiFetch(endpoint)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.message || `Unable to load ${kind}.`)
        }
        return payload
      })
      .then((payload) => {
        if (!active || !Array.isArray(payload)) return
        if (isStudents) {
          setRecords(
            payload.map((student) => [
              String(student.id),
              String(student.name),
              String(student.gradeLevel || ""),
              String(student.strand || ""),
              String(
                student.classSectionName ||
                  (student.classSectionCode ? student.section : "Unassigned") ||
                  "",
              ),
            ]),
          )
          setEmailByStudentId(
            Object.fromEntries(
              payload.map((student) => [
                String(student.id),
                String(student.email || ""),
              ]),
            ),
          )
          setClassSectionCodeByStudentId(
            Object.fromEntries(
              payload.map((student) => [
                String(student.id),
                String(student.classSectionCode || ""),
              ]),
            ),
          )
          setAcademicYearIdByStudent(
            Object.fromEntries(
              payload.map((student) => [
                String(student.id),
                String(student.academicYearId || ""),
              ]),
            ),
          )
        } else if (isTeachers) {
          setRecords(
            payload.map((teacher) => [
              String(teacher.id),
              String(teacher.name),
              String(teacher.subject || "—"),
              String(teacher.email || ""),
            ]),
          )
        } else {
          setRecords(
            payload.map((subject) => [
              String(subject.code),
              String(subject.code),
              String(subject.name),
              String(subject.gradeLevel || ""),
              String(subject.semester || ""),
              String(subject.description || ""),
              String(subject.units ?? 0),
            ]),
          )
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setRecordError(
            error instanceof Error ? error.message : `Unable to load ${kind}.`,
          )
        }
      })
    return () => {
      active = false
    }
  }, [isStudents, isTeachers, kind])

  useEffect(() => {
    if (!isStudents) return
    let active = true
    void Promise.all([
      apiFetch("/api/academic-years"),
      apiFetch("/api/grade-levels"),
      apiFetch("/api/strands"),
    ])
      .then(async (responses) => {
        const payloads = await Promise.all(
          responses.map(async (response) => {
            const payload = await response.json().catch(() => null)
            if (!response.ok || !Array.isArray(payload)) {
              throw new Error(payload?.message || "Unable to load academic placement options.")
            }
            return payload
          }),
        )
        if (!active) return
        const [yearRows, gradeRows, strandRows] = payloads
        const years = yearRows
          .filter((year) => String(year.status).toLowerCase() === "active")
          .map((year) => ({
          id: String(year.id),
          code: String(year.code),
          isCurrent: Boolean(year.isCurrent),
          }))
        setAcademicYears(years)
        setGradeLevels(
          gradeRows.map((grade) => ({
            id: String(grade.id),
            name: String(grade.name),
            number: Number(grade.number),
          })),
        )
        setStrands(
          strandRows.map((strand) => ({
            id: String(strand.id),
            code: String(strand.code),
            name: String(strand.name),
          })),
        )
        setSelectedAcademicYearId(
          (current) =>
            current || years.find((year) => year.isCurrent)?.id || years[0]?.id || "",
        )
      })
      .catch((error: unknown) => {
        if (active) {
          setClassSectionLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load academic placement options.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [isStudents])

  const loadAvailableClassSections = async () => {
    setClassSectionLoading(true)
    setClassSectionLoadError("")
    try {
      const query = new URLSearchParams()
      if (selectedAcademicYearId) query.set("academicYearId", selectedAcademicYearId)
      if (selectedGradeLevelId) query.set("gradeLevelId", selectedGradeLevelId)
      if (selectedStrandId) query.set("strandId", selectedStrandId)
      if (selectedClassSectionCode) {
        query.set("currentSectionCode", selectedClassSectionCode)
      }
      const response = await apiFetch(
        `/api/class-sections/available?${query.toString()}`,
      )
      const payload: unknown = await response.json().catch(() => null)
      const sections =
        isRecord(payload) && Array.isArray(payload.sections)
          ? payload.sections
          : null
      if (!response.ok || !sections) {
        throw new Error(
          (isRecord(payload) && typeof payload.message === "string"
            ? payload.message
            : "") || "Unable to load available class sections.",
        )
      }
      setClassSectionOptions(
        sections.map((value) => {
          if (!isRecord(value)) {
            throw new Error("The server returned an invalid class section.")
          }
          return {
            code: String(value.id || value.code || ""),
            name: String(value.name || ""),
            section: String(value.section || ""),
            gradeLevel: String(value.gradeLevel || ""),
            strand: String(value.strand || ""),
            schoolYear: String(value.schoolYear || ""),
            academicYearId: String(value.academicYearId || ""),
            gradeLevelId: String(value.gradeLevelId || ""),
            strandId: String(value.strandId || ""),
          }
        }),
      )
    } catch (error) {
      setClassSectionLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load available class sections.",
      )
    } finally {
      setClassSectionLoading(false)
    }
  }

  useEffect(() => {
    if (isStudents && selectedAcademicYearId) void loadAvailableClassSections()
  }, [
    isStudents,
    selectedAcademicYearId,
    selectedGradeLevelId,
    selectedStrandId,
    selectedClassSectionCode,
  ])

  const matchingClassSections = classSectionOptions.filter(
    (section) =>
      String(section.academicYearId) === String(selectedAcademicYearId) &&
      String(section.gradeLevelId) === String(selectedGradeLevelId) &&
      String(section.strandId) === String(selectedStrandId),
  )
  const openRecord = (mode: "view" | "edit" | "add", index?: number) => {
    setRecordError("")
    setCreatedStudentId("")
    setStudentEnrollmentMessage("")
    setCreatedTeacherId("")
    setRecordMode(mode)
    setSelectedRecord(index ?? null)
    setDraftEmail(
      index === undefined ? "" : emailByStudentId[records[index]?.[0]] || "",
    )
    setDraftPassword("")
    setDraft(index === undefined ? headers.map(() => "") : [...records[index]])
    const selectedStudentRecord =
      index === undefined ? undefined : records[index]
    const recordId = selectedStudentRecord?.[0] || ""
    const existingCode = recordId
      ? classSectionCodeByStudentId[recordId] ||
        ""
      : ""
    const existingYearId = recordId ? academicYearIdByStudent[recordId] || "" : ""
    const currentYearId =
      academicYears.find((year) => year.isCurrent)?.id || academicYears[0]?.id || ""
    setSelectedAcademicYearId(existingYearId || currentYearId)
    setSelectedGradeLevelId(
      gradeLevels.find((grade) => grade.name === selectedStudentRecord?.[2])?.id || "",
    )
    setSelectedStrandId(
      strands.find(
        (strand) =>
          strand.code.toLowerCase() ===
          String(selectedStudentRecord?.[3] || "").toLowerCase(),
      )?.id || "",
    )
    setSelectedClassSectionCode(existingCode)
  }
  const closeRecord = () => {
    setRecordMode(null)
    setSelectedRecord(null)
    setDraft([])
    setDraftPassword("")
    setSelectedClassSectionCode("")
    setSelectedGradeLevelId("")
    setSelectedStrandId("")
  }
  const saveRecord = async () => {
    if (isStudents) {
      try {
        const isAdding = recordMode === "add"
        const existingId =
          selectedRecord === null ? "" : records[selectedRecord]?.[0] || ""
        const response = await apiFetch(
          isAdding
            ? "/api/students"
            : `/api/students/${encodeURIComponent(existingId)}`,
          {
            method: isAdding ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: draft[1],
              email: draftEmail,
              ...(isAdding ? { password: draftPassword } : {}),
              gradeLevel: draft[2],
              strand: draft[3],
              section: draft[4],
              classSectionCode: selectedClassSectionCode,
              academicYearId: selectedAcademicYearId,
              gradeLevelId: selectedGradeLevelId,
              strandId: selectedStrandId,
            }),
          },
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.student) {
          throw new Error(payload?.message || "Unable to save the student.")
        }
        const student = payload.student
        const nextRecord = [
          String(student.id),
          String(student.name),
          String(student.gradeLevel || ""),
          String(student.strand || ""),
          String(
            student.classSectionName ||
              (student.classSectionCode ? student.section : "Unassigned") ||
              "",
          ),
        ]
        setRecords((current) =>
          isAdding
            ? [...current, nextRecord]
            : current.map((record, index) =>
                index === selectedRecord ? nextRecord : record,
              ),
        )
        setEmailByStudentId((current) => ({
          ...current,
          [String(student.id)]: String(student.email || draftEmail),
        }))
        setClassSectionCodeByStudentId((current) => ({
          ...current,
          [String(student.id)]: String(
            student.classSectionCode || selectedClassSectionCode,
          ),
        }))
        if (isAdding) setCreatedStudentId(String(student.id))
        if (isAdding || student.enrollmentChanged) {
          setStudentEnrollmentMessage(
            student.enrolledSubjects?.length
              ? `Automatically enrolled in: ${student.enrolledSubjects
                  .map(
                    (subject: { subjectCode: string; subjectName: string }) =>
                      `${subject.subjectCode} ${subject.subjectName}`,
                  )
                  .join(", ")}`
              : "No subjects are assigned for the active school year and semester yet.",
          )
        }
        closeRecord()
      } catch (error) {
        setRecordError(
          error instanceof Error
            ? error.message
            : "Unable to save the student.",
        )
      }
      return
    }

    try {
      const isAdding = recordMode === "add"
      const existing = selectedRecord === null ? null : records[selectedRecord]
      const endpoint = isSubjects
        ? isAdding
          ? "/api/subjects"
          : `/api/subjects/${encodeURIComponent(existing?.[1] || "")}`
        : isAdding
          ? "/api/teachers"
          : `/api/teachers/${encodeURIComponent(existing?.[0] || "")}`
      const response = await apiFetch(endpoint, {
        method: isAdding ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSubjects
            ? {
                code: draft[1],
                name: draft[2],
                gradeLevel: draft[3],
                semester: draft[4],
                description: draft[5],
                units: draft[6],
              }
            : {
                name: draft[1],
                subject: draft[2],
                email: draftEmail,
                status: draft[4],
                ...(isAdding ? { password: draftPassword } : {}),
              },
        ),
      })
      const payload = await response.json().catch(() => null)
      const saved = isSubjects ? payload?.subject : payload?.teacher
      if (!response.ok || !saved) {
        throw new Error(
          payload?.message || `Unable to save the ${singular.toLowerCase()}.`,
        )
      }
      const nextRecord = isSubjects
        ? [
            String(saved.code),
            String(saved.code),
            String(saved.name),
            String(saved.gradeLevel || ""),
            String(saved.semester || ""),
            String(saved.description || ""),
            String(saved.units ?? 0),
          ]
        : [
            String(saved.id),
            String(saved.name),
            String(saved.subject || "—"),
            String(saved.email || draftEmail),
          ]
      setRecords((current) =>
        isAdding
          ? [...current, nextRecord]
          : current.map((record, index) =>
              index === selectedRecord ? nextRecord : record,
            ),
      )
      if (isTeachers) {
        setEmailByStudentId((current) => ({
          ...current,
          [nextRecord[0]]: nextRecord[3],
        }))
        if (isAdding) setCreatedTeacherId(String(saved.id))
      }
      closeRecord()
    } catch (error) {
      setRecordError(
        error instanceof Error
          ? error.message
          : `Unable to save the ${singular.toLowerCase()}.`,
      )
    }
  }
  const visibleRecords = records
    .map((record, index) => ({ record, index }))
    .filter(({ record }) =>
      record.some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    )
  const rows = visibleRecords.map(({ record }) =>
    record.map((value, index) => (index === 1 ? <b>{value}</b> : value)),
  )

  return (
    <>
      <PageHeading
        title={title}
        description={`View and manage all ${kind} in the SNSHS LMS.`}
        action={
          <Button icon="plus" onClick={() => openRecord("add")}>
            Add {singular}
          </Button>
        }
      />
      {createdStudentId && (
        <div className="settings-saved" role="status">
          Student created successfully. Student ID:{" "}
          <strong>{createdStudentId}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss generated student ID"
            onClick={() => setCreatedStudentId("")}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {studentEnrollmentMessage && !recordMode && (
        <p className="settings-saved" role="status">
          {studentEnrollmentMessage}
        </p>
      )}
      {createdTeacherId && (
        <div className="settings-saved" role="status">
          Teacher created successfully. Teacher ID:{" "}
          <strong>{createdTeacherId}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss generated teacher ID"
            onClick={() => setCreatedTeacherId("")}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {recordError && !recordMode && (
        <p className="form-error" role="alert">
          {recordError}
        </p>
      )}
      <SearchFilter
        placeholder={`Search by ${
          isStudents
            ? "Student ID or name"
            : isTeachers
              ? "Teacher ID or name"
              : "subject code or name"
        }...`}
        value={search}
        onChange={setSearch}
      />
      <Card className="table-card">
        <DataTable
          headers={headers}
          rows={rows}
          onView={(index) => openRecord("view", visibleRecords[index].index)}
          onEdit={(index) => openRecord("edit", visibleRecords[index].index)}
          onDelete={(index) => {
            const record = visibleRecords[index]?.record
            if (!record) return
            setDeleteTarget({
              id: record[isStudents ? 0 : isTeachers ? 0 : 1],
              name: record[1],
            })
          }}
          paginate
        />
        {!visibleRecords.length && (
          <div className="table-empty">
            No {kind} match “{search}”. Try a different search.
          </div>
        )}
      </Card>
      {recordMode && (
        <Modal
          title={`${
            recordMode === "add"
              ? "Add"
              : recordMode === "edit"
                ? "Edit"
                : "View"
          } ${singular}`}
          close={closeRecord}
        >
          {recordMode === "view" ? (
            <div className="record-details">
              {headers.map((header, index) => (
                <div key={header}>
                  <span>{header}</span>
                  <strong>{draft[index]}</strong>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="modal-form">
                {isStudents && recordMode === "add" && (
                  <div className="field full">
                    <span>Student ID</span>
                    <p>
                      Generated automatically after the student account is
                      created.
                    </p>
                  </div>
                )}
                {isTeachers && recordMode === "add" && (
                  <div className="field full">
                    <span>Teacher ID</span>
                    <p>Generated automatically starting at 2026001.</p>
                  </div>
                )}
                {headers.map((header, index) =>
                  ((isStudents || isTeachers || isSubjects) &&
                    recordMode === "add" &&
                    index === 0) ||
                  (isStudents && index >= 2) ||
                  (isTeachers && index === 3) ||
                  (isTeachers && recordMode === "add" && index === 2) ? null : (
                    <label className="field" key={header}>
                      <span>{header}</span>
                      <input
                        required
                        type={isSubjects && index === 7 ? "number" : "text"}
                        min={isSubjects && index === 7 ? "0" : undefined}
                        step={isSubjects && index === 7 ? "0.01" : undefined}
                        value={draft[index]}
                        readOnly={(isStudents || isTeachers) && index === 0}
                        onChange={(event) =>
                          setDraft(
                            draft.map((value, fieldIndex) =>
                              fieldIndex === index ? event.target.value : value,
                            ),
                          )
                        }
                      />
                    </label>
                  ),
                )}
                {isStudents && (
                  <>
                    <label className="field">
                      <span>Academic Year</span>
                      <select
                        required
                        value={selectedAcademicYearId}
                        onChange={(event) => {
                          setSelectedAcademicYearId(event.target.value)
                          setSelectedClassSectionCode("")
                          setDraft((current) => {
                            const next = [...current]
                            next[4] = ""
                            return next
                          })
                        }}
                      >
                        <option value="">Select academic year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Grade</span>
                      <select
                        required
                        value={draft[2] || ""}
                        onChange={(event) => {
                          setSelectedClassSectionCode("")
                          setSelectedGradeLevelId(
                            gradeLevels.find(
                              (grade) => grade.name === event.target.value,
                            )?.id || "",
                          )
                          setDraft((current) => {
                            const next = [...current]
                            next[2] = event.target.value
                            next[3] = ""
                            next[4] = ""
                            return next
                          })
                        }}
                      >
                        <option value="">Select grade</option>
                        {gradeLevels.map((grade) => (
                          <option key={grade.id} value={grade.name}>
                            {grade.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Strand</span>
                      <select
                        required
                        value={draft[3] || ""}
                        onChange={(event) => {
                          setSelectedClassSectionCode("")
                          setSelectedStrandId(
                            strands.find(
                              (strand) => strand.code === event.target.value,
                            )?.id || "",
                          )
                          setDraft((current) => {
                            const next = [...current]
                            next[3] = event.target.value
                            next[4] = ""
                            return next
                          })
                        }}
                      >
                        <option value="">Select strand</option>
                        {strands.map((strand) => (
                          <option key={strand.id} value={strand.code}>
                            {strand.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Section</span>
                      <select
                        required
                        value={selectedClassSectionCode}
                        disabled={
                          !selectedAcademicYearId ||
                          !selectedGradeLevelId ||
                          !selectedStrandId ||
                          !!classSectionLoadError
                        }
                        onChange={(event) => {
                          const selectedSection = matchingClassSections.find(
                            (section) => section.code === event.target.value,
                          )
                          setSelectedClassSectionCode(event.target.value)
                          setDraft((current) => {
                            const next = [...current]
                            next[4] = selectedSection?.name || ""
                            return next
                          })
                        }}
                      >
                        <option value="">Select section</option>
                        {matchingClassSections.map((section) => (
                          <option key={section.code} value={section.code}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                      {classSectionLoading && (
                        <small role="status">Loading available sections…</small>
                      )}
                    </label>
                    {!classSectionLoading &&
                      (classSectionLoadError ? (
                        <div className="field full">
                          <small className="form-error" role="alert">
                            {classSectionLoadError}
                          </small>
                          <Button
                            variant="secondary"
                            onClick={() => void loadAvailableClassSections()}
                          >
                            Retry section loading
                          </Button>
                        </div>
                      ) : !classSectionOptions.length ? (
                        <div className="field full">
                          <small>
                            No active class sections are available for the
                            current school year.
                          </small>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              closeRecord()
                              navigate("classes")
                            }}
                          >
                            Open Section Management
                          </Button>
                        </div>
                      ) : draft[2] &&
                        draft[3] &&
                        !matchingClassSections.length ? (
                        <div className="field full">
                          <small>
                            No active section matches this grade and strand.
                          </small>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              closeRecord()
                              navigate("classes")
                            }}
                          >
                            Open Section Management
                          </Button>
                        </div>
                      ) : null)}
                    <label className="field">
                      <span>Email</span>
                      <input
                        required
                        type="email"
                        value={draftEmail}
                        onChange={(event) => setDraftEmail(event.target.value)}
                      />
                    </label>
                    {recordMode === "add" && (
                      <label className="field">
                        <span>Password</span>
                        <input
                          required
                          type="password"
                          minLength={8}
                          value={draftPassword}
                          onChange={(event) =>
                            setDraftPassword(event.target.value)
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {isTeachers && (
                  <>
                    <label className="field">
                      <span>Email</span>
                      <input
                        required
                        type="email"
                        value={draftEmail}
                        onChange={(event) => setDraftEmail(event.target.value)}
                      />
                    </label>
                    {recordMode === "add" && (
                      <label className="field">
                        <span>Initial Password</span>
                        <input
                          required
                          type="password"
                          minLength={8}
                          value={draftPassword}
                          onChange={(event) =>
                            setDraftPassword(event.target.value)
                          }
                        />
                      </label>
                    )}
                  </>
                )}
              </div>
              {recordError && (
                <p className="form-error" role="alert">
                  {recordError}
                </p>
              )}
            </>
          )}
          <div className="modal-actions">
            <Button variant="ghost" onClick={closeRecord}>
              {recordMode === "view" ? "Close" : "Cancel"}
            </Button>
            {recordMode !== "view" && (
              <Button
                onClick={saveRecord}
                disabled={
                  isStudents
                    ? recordMode === "add"
                      ? draft.slice(1).some((value) => !value.trim()) ||
                        !selectedClassSectionCode ||
                        !draftEmail.trim() ||
                        draftPassword.length < 8
                      : draft.some((value) => !value.trim()) ||
                        !selectedClassSectionCode ||
                        !draftEmail.trim()
                    : isTeachers
                      ? recordMode === "add"
                        ? !draft[1]?.trim() ||
                          !draftEmail.trim() ||
                          draftPassword.length < 8
                        : draft.slice(1).some((value) => !value.trim()) ||
                          !draftEmail.trim()
                      : isSubjects
                        ? !draft[1]?.trim() ||
                          !draft[2]?.trim() ||
                          !draft[3]?.trim() ||
                          !draft[4]?.trim() ||
                          !draft[6]?.trim()
                        : draft.slice(1).some((value) => !value.trim())
                }
              >
                {recordMode === "add" ? `Add ${singular}` : "Save Changes"}
              </Button>
            )}
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <AdminDeleteDialog
          kind={kind}
          recordId={deleteTarget.id}
          recordName={`${singular} ${deleteTarget.name}`}
          close={() => setDeleteTarget(null)}
          onDeleted={() => {
            const deletedId = deleteTarget.id
            setRecords((current) =>
              current.filter(
                (record) =>
                  record[isStudents || isTeachers ? 0 : 1] !== deletedId,
              ),
            )
            setDeleteTarget(null)
            setRecordError("")
          }}
        />
      )}
    </>
  )
}

function SubjectSectionsPage() {
  type SubjectOption = { code: string; name: string }
  type ClassOption = { code: string; name: string }
  type TeacherOption = { id: string; name: string }
  type SectionRecord = {
    id: string
    subjectCode: string
    subjectName: string
    classSectionCode: string
    classSectionName: string
    teacher: string
    schoolYear: string
    semester: string
    enrolledStudents: string[]
  }
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState("")
  const [editorMode, setEditorMode] = useState<"view" | "edit" | "add" | null>(
    null,
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    id: "",
    subjectCode: "",
    subjectName: "",
    classSectionCode: "",
    classSectionName: "",
    teacher: "",
    schoolYear: "",
    semester: "",
    enrolledStudents: [] as string[],
  })

  const loadData = async () => {
    try {
      const responses = await Promise.all([
        apiFetch("/api/subject-sections"),
        apiFetch("/api/subjects"),
        apiFetch("/api/class-sections"),
        apiFetch("/api/teachers"),
      ])
      const payloads = await Promise.all(
        responses.map(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok)
            throw new Error(
              payload?.message || "Unable to load subject-section data.",
            )
          return payload
        }),
      )
      const [sectionData, subjectData, classData, teacherData] = payloads
      if (
        ![sectionData, subjectData, classData, teacherData].every(Array.isArray)
      ) {
        throw new Error("The server returned invalid subject-section data.")
      }
      setSections(sectionData)
      setSubjects(subjectData)
      setClassOptions(classData)
      setTeacherOptions(teacherData)
      setSelectedSectionId((current) =>
        sectionData.some((section: SectionRecord) => section.id === current)
          ? current
          : sectionData[0]?.id || "",
      )
      setError("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load subject-section data.",
      )
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) || sections[0]

  const openSectionEditor = (
    mode: "view" | "edit" | "add",
    section?: SectionRecord,
  ) => {
    setError("")
    if (mode === "add") {
      const subject = subjects[0]
      const classSection = classOptions[0]
      setDraft({
        id: "",
        subjectCode: subject?.code || "",
        subjectName: subject?.name || "",
        classSectionCode: classSection?.code || "",
        classSectionName: classSection?.name || "",
        teacher: teacherOptions[0]?.name || "",
        schoolYear: "",
        semester: "",
        enrolledStudents: [],
      })
    } else if (section) {
      setDraft({ ...section, enrolledStudents: [...section.enrolledStudents] })
      setSelectedSectionId(section.id)
    }
    setEditorMode(mode)
  }

  const closeSectionEditor = () => {
    setEditorMode(null)
  }

  const saveSection = async () => {
    setError("")
    if (
      !draft.subjectCode ||
      !draft.classSectionCode ||
      !draft.teacher ||
      !draft.schoolYear.trim() ||
      !draft.semester.trim()
    ) {
      setError(
        "Select a subject, class section, and teacher, then enter the school year and semester.",
      )
      return
    }
    setSaving(true)
    const subject = subjects.find((item) => item.code === draft.subjectCode)
    const classSection = classOptions.find(
      (item) => item.code === draft.classSectionCode,
    )
    try {
      const response = await apiFetch(
        editorMode === "add"
          ? "/api/subject-sections"
          : `/api/subject-sections/${encodeURIComponent(draft.id)}`,
        {
          method: editorMode === "add" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectCode: draft.subjectCode,
            subjectName: subject?.name,
            classSectionCode: draft.classSectionCode,
            classSectionName: classSection?.name,
            teacher: draft.teacher,
            schoolYear: draft.schoolYear,
            semester: draft.semester,
          }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.subjectSection) {
        throw new Error(
          payload?.message || "Unable to save the subject section.",
        )
      }
      setSelectedSectionId(payload.subjectSection.id)
      closeSectionEditor()
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the subject section.",
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteSection = async (sectionId: string) => {
    setError("")
    setSaving(true)
    try {
      const response = await apiFetch(
        `/api/subject-sections/${encodeURIComponent(sectionId)}`,
        {
          method: "DELETE",
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok)
        throw new Error(
          payload?.message || "Unable to remove the subject section.",
        )
      closeSectionEditor()
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove the subject section.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        title="Subject Sections"
        description="Create and manage academic offerings for each class section and teacher."
        action={
          <Button icon="plus" onClick={() => openSectionEditor("add")}>
            Add Subject Section
          </Button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="table-card">
          <DataTable
            headers={[
              "Section ID",
              "Subject",
              "Class Section",
              "Teacher",
              "School Year",
              "Semester",
            ]}
            rows={sections.map((section) => [
              section.id,
              section.subjectName,
              section.classSectionName,
              section.teacher,
              section.schoolYear,
              section.semester,
            ])}
            onView={(index) => {
              const target = sections[index]
              if (!target) return
              setSelectedSectionId(target.id)
              openSectionEditor("view", target)
            }}
            onEdit={(index) => {
              const target = sections[index]
              if (!target) return
              setSelectedSectionId(target.id)
              openSectionEditor("edit", target)
            }}
            paginate
          />
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h2>Subject Section Details</h2>
              <p>Review and validate the offering before enrollment.</p>
            </div>
          </div>
          <div className="record-details">
            <div>
              <span>Subject</span>
              <strong>{selectedSection?.subjectName || "—"}</strong>
            </div>
            <div>
              <span>Class Section</span>
              <strong>{selectedSection?.classSectionName || "—"}</strong>
            </div>
            <div>
              <span>Teacher</span>
              <strong>{selectedSection?.teacher || "—"}</strong>
            </div>
            <div>
              <span>School Year</span>
              <strong>{selectedSection?.schoolYear || "—"}</strong>
            </div>
            <div>
              <span>Semester</span>
              <strong>{selectedSection?.semester || "—"}</strong>
            </div>
          </div>
        </Card>
      </div>
      {editorMode && (
        <Modal
          title={
            editorMode === "add"
              ? "Add Subject Section"
              : editorMode === "edit"
                ? "Edit Subject Section"
                : "Subject Section Details"
          }
          close={closeSectionEditor}
        >
          <div className="modal-form">
            <label className="field">
              <span>Subject</span>
              <select
                value={draft.subjectCode}
                required
                disabled={editorMode === "view" || saving}
                onChange={(event) => {
                  const subject = subjects.find(
                    (item) => item.code === event.target.value,
                  )
                  setDraft((current) => ({
                    ...current,
                    subjectCode: event.target.value,
                    subjectName: subject?.name || "",
                  }))
                }}
              >
                <option value="">Select a subject</option>
                {subjects.map((subject) => (
                  <option key={subject.code} value={subject.code}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Class Section</span>
              <select
                value={draft.classSectionCode}
                required
                disabled={editorMode === "view" || saving}
                onChange={(event) => {
                  const section = classOptions.find(
                    (item) => item.code === event.target.value,
                  )
                  setDraft((current) => ({
                    ...current,
                    classSectionCode: event.target.value,
                    classSectionName: section?.name || "",
                  }))
                }}
              >
                <option value="">Select a class section</option>
                {classOptions.map((section) => (
                  <option key={section.code} value={section.code}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Assigned Teacher</span>
              <select
                value={draft.teacher}
                required
                disabled={editorMode === "view" || saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    teacher: event.target.value,
                  }))
                }
              >
                <option value="">Select a teacher</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.name}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>School Year</span>
              <input
                required
                value={draft.schoolYear}
                disabled={editorMode === "view" || saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    schoolYear: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Semester</span>
              <select
                value={draft.semester}
                required
                disabled={editorMode === "view" || saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    semester: event.target.value,
                  }))
                }
              >
                <option value="">Select a semester</option>
                <option>Semester 1</option>
                <option>Semester 2</option>
              </select>
            </label>
            {draft.id && <p className="field full">Section ID: {draft.id}</p>}
          </div>
          <div className="modal-actions">
            <Button variant="ghost" onClick={closeSectionEditor}>
              {editorMode === "view" ? "Close" : "Cancel"}
            </Button>
            {editorMode !== "view" && (
              <Button
                onClick={() => void saveSection()}
                disabled={
                  saving ||
                  !subjects.length ||
                  !classOptions.length ||
                  !teacherOptions.length
                }
              >
                {editorMode === "add" ? "Save Section" : "Update Section"}
              </Button>
            )}
            {editorMode === "edit" && (
              <Button
                variant="danger"
                onClick={() => void deleteSection(selectedSectionId)}
                disabled={saving}
              >
                Remove Section
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}

function ManageSectionSubjectsPage() {
  type SubjectOption = { code: string; name: string; units?: number }
  type ClassOption = { code: string; name: string }
  type TeacherOption = { id: string; name: string }
  type Offering = {
    id: string
    subjectCode: string
    subjectName: string
    classSectionCode: string
    classSectionName: string
    teacher: string
    schoolYear: string
    semester: string
    status?: string
  }
  type SectionStudent = {
    id: string
    name: string
    gradeLevel: string
    strand: string
    section: string
  }
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([])
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [sectionStudents, setSectionStudents] = useState<SectionStudent[]>([])
  const [classSectionCode, setClassSectionCode] = useState("")
  const [schoolYear, setSchoolYear] = useState("")
  const [semester, setSemester] = useState("")
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [teacherByCode, setTeacherByCode] = useState<Record<string, string>>({})
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pendingRemovals, setPendingRemovals] = useState<string[] | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        apiFetch("/api/subjects"),
        apiFetch("/api/class-sections"),
        apiFetch("/api/teachers"),
        apiFetch("/api/subject-sections"),
        apiFetch("/api/records/settings"),
      ])
      const payloads = await Promise.all(
        responses.map(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(
              payload?.message || "Unable to load section subject data.",
            )
          }
          return payload
        }),
      )
      const [subjectData, classData, teacherData, offeringData, settingsData] =
        payloads
      if (
        ![
          subjectData,
          classData,
          teacherData,
          offeringData,
          settingsData,
        ].every(Array.isArray)
      ) {
        throw new Error("The server returned invalid section subject data.")
      }
      const nextSubjects = subjectData
      const nextClasses = classData
      const nextTeachers = teacherData
      const nextOfferings = offeringData
      const schoolSettings =
        settingsData.find(
          (record: { id?: string }) => record.id === "lms-settings",
        )?.schoolInfo || {}
      setSubjects(nextSubjects)
      setClassOptions(nextClasses)
      setTeacherOptions(nextTeachers)
      setOfferings(nextOfferings)
      setSchoolYear(
        (current) => current || String(schoolSettings.schoolYear || ""),
      )
      setSemester((current) => current || String(schoolSettings.semester || ""))
      setClassSectionCode((current) => current || nextClasses[0]?.code || "")
      const selectedClass = classSectionCode || nextClasses[0]?.code || ""
      const selectedYear = schoolYear || String(schoolSettings.schoolYear || "")
      const selectedSemester = semester || String(schoolSettings.semester || "")
      const matchingOfferings = nextOfferings.filter(
        (offering: Offering) =>
          offering.classSectionCode === selectedClass &&
          offering.schoolYear === selectedYear &&
          offering.semester === selectedSemester &&
          (offering.status || "active") === "active",
      )
      setSelectedCodes(
        matchingOfferings.map((offering: Offering) => offering.subjectCode),
      )
      setTeacherByCode(
        Object.fromEntries(
          matchingOfferings.map((offering: Offering) => [
            offering.subjectCode,
            offering.teacher,
          ]),
        ),
      )
      setError("")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load section subject data.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (!classSectionCode) {
      setSectionStudents([])
      return
    }
    let active = true
    void apiFetch(
      `/api/class-sections/${encodeURIComponent(classSectionCode)}/students`,
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            payload?.message || "Unable to load section students.",
          )
        }
        return payload
      })
      .then((payload) => {
        if (active) setSectionStudents(payload)
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load section students.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [classSectionCode])

  const currentOfferings = offerings.filter(
    (offering) =>
      offering.classSectionCode === classSectionCode &&
      offering.schoolYear === schoolYear &&
      offering.semester === semester &&
      (offering.status || "active") === "active",
  )
  const filteredSubjects = subjects.filter((subject) =>
    `${subject.code} ${subject.name}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  const currentClass = classOptions.find(
    (section) => section.code === classSectionCode,
  )

  const updateContext = (
    nextSectionCode: string,
    nextSchoolYear: string,
    nextSemester: string,
  ) => {
    setClassSectionCode(nextSectionCode)
    setSchoolYear(nextSchoolYear)
    setSemester(nextSemester)
    const matchingOfferings = offerings.filter(
      (offering) =>
        offering.classSectionCode === nextSectionCode &&
        offering.schoolYear === nextSchoolYear &&
        offering.semester === nextSemester &&
        (offering.status || "active") === "active",
    )
    setSelectedCodes(matchingOfferings.map((offering) => offering.subjectCode))
    setTeacherByCode(
      Object.fromEntries(
        matchingOfferings.map((offering) => [
          offering.subjectCode,
          offering.teacher,
        ]),
      ),
    )
  }

  const saveAssignments = async (removeCodes: string[] = []) => {
    setError("")
    if (
      !classSectionCode ||
      !schoolYear.trim() ||
      !semester ||
      (!selectedCodes.length && !removeCodes.length)
    ) {
      setError(
        "Select a section, school year, semester, and at least one subject.",
      )
      return
    }
    const assignments = selectedCodes.map((subjectCode) => ({
      subjectCode,
      teacher: teacherByCode[subjectCode] || "",
    }))
    if (assignments.some((assignment) => !assignment.teacher)) {
      setError("Assign a teacher to each selected subject.")
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch("/api/section-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSectionCode,
          schoolYear: schoolYear.trim(),
          semester,
          assignments,
          removeSubjectCodes: removeCodes,
          confirmRemoval: removeCodes.length > 0,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to save section subjects.")
      }
      setPendingRemovals(null)
      await loadData()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save section subjects.",
      )
    } finally {
      setSaving(false)
    }
  }

  const beginSave = () => {
    const removals = currentOfferings
      .map((offering) => offering.subjectCode)
      .filter((subjectCode) => !selectedCodes.includes(subjectCode))
    if (removals.length) {
      setPendingRemovals(removals)
      return
    }
    void saveAssignments()
  }

  return (
    <>
      <PageHeading
        title="Manage Section Subjects"
        description="Assign subjects and teachers to a section for the active academic period. Students in that section are enrolled automatically."
        action={
          <Button icon="check" onClick={beginSave} disabled={loading || saving}>
            {saving ? "Saving..." : "Save Assignments"}
          </Button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card>
        <div className="modal-form">
          <label className="field">
            <span>Academic Year</span>
            <input
              required
              placeholder="Set the active school year in System Settings"
              value={schoolYear}
              onChange={(event) =>
                updateContext(classSectionCode, event.target.value, semester)
              }
            />
          </label>
          <label className="field">
            <span>Semester</span>
            <select
              required
              value={semester}
              onChange={(event) =>
                updateContext(classSectionCode, schoolYear, event.target.value)
              }
            >
              <option value="">Select a semester</option>
              <option>Semester 1</option>
              <option>Semester 2</option>
            </select>
          </label>
          <label className="field">
            <span>Section</span>
            <select
              required
              value={classSectionCode}
              onChange={(event) =>
                updateContext(event.target.value, schoolYear, semester)
              }
            >
              <option value="">Select a section</option>
              {classOptions.map((section) => (
                <option key={section.code} value={section.code}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      <Card>
        <div className="card-head">
          <div>
            <h2>Available Subjects</h2>
            <p>Select multiple subjects and assign a teacher to each one.</p>
          </div>
        </div>
        <SearchFilter
          placeholder="Search subject code or name..."
          value={search}
          onChange={setSearch}
        />
        <div className="record-list">
          {filteredSubjects.map((subject) => {
            const checked = selectedCodes.includes(subject.code)
            return (
              <div className="record-list-item" key={subject.code}>
                <label className="field">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setSelectedCodes((current) =>
                        event.target.checked
                          ? [...current, subject.code]
                          : current.filter((code) => code !== subject.code),
                      )
                      if (
                        event.target.checked &&
                        !teacherByCode[subject.code]
                      ) {
                        setTeacherByCode((current) => ({
                          ...current,
                          [subject.code]: teacherOptions[0]?.name || "",
                        }))
                      }
                    }}
                  />
                  <span>
                    {subject.code} · {subject.name}
                  </span>
                </label>
                {checked && (
                  <label className="field">
                    <span>Assigned Teacher</span>
                    <select
                      required
                      value={teacherByCode[subject.code] || ""}
                      onChange={(event) =>
                        setTeacherByCode((current) => ({
                          ...current,
                          [subject.code]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select a teacher</option>
                      {teacherOptions.map((teacher) => (
                        <option key={teacher.id} value={teacher.name}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )
          })}
          {!loading && !filteredSubjects.length && (
            <p className="empty-state">No subjects match your search.</p>
          )}
        </div>
      </Card>
      <Card className="table-card">
        <div className="card-head">
          <div>
            <h2>
              {currentClass?.name || "Selected Section"} · Assigned Subjects
            </h2>
            <p>
              {schoolYear || "No school year"} · {semester || "No semester"}
            </p>
          </div>
        </div>
        <DataTable
          actions={false}
          headers={[
            "Subject Code",
            "Subject Name",
            "Units",
            "Assigned Teacher",
            "Action",
          ]}
          rows={currentOfferings.map((offering) => {
            const subject = subjects.find(
              (item) => item.code === offering.subjectCode,
            )
            return [
              offering.subjectCode,
              offering.subjectName,
              String(subject?.units ?? "—"),
              offering.teacher,
              <Button
                key={offering.id}
                variant="danger"
                onClick={() =>
                  setSelectedCodes((current) =>
                    current.filter((code) => code !== offering.subjectCode),
                  )
                }
              >
                Remove
              </Button>,
            ]
          })}
          paginate
        />
        {!loading && !currentOfferings.length && (
          <p className="empty-state">
            No subjects are assigned for this section and academic period.
          </p>
        )}
      </Card>
      <Card className="table-card">
        <div className="card-head">
          <div>
            <h2>{currentClass?.name || "Selected Section"} · Students</h2>
            <p>{sectionStudents.length} students assigned to this section</p>
          </div>
        </div>
        <DataTable
          actions={false}
          headers={["Student ID", "Student Name", "Grade", "Strand", "Section"]}
          rows={sectionStudents.map((student) => [
            student.id,
            student.name,
            student.gradeLevel,
            student.strand,
            student.section,
          ])}
          paginate
        />
        {!loading && !sectionStudents.length && (
          <p className="empty-state">
            No students are assigned to this section yet.
          </p>
        )}
      </Card>
      {pendingRemovals && (
        <Modal
          title="Confirm Subject Removal"
          close={() => setPendingRemovals(null)}
        >
          <p>
            Removing these subjects deactivates current enrollments but
            preserves enrollment and academic history:
          </p>
          <ul>
            {pendingRemovals.map((code) => (
              <li key={code}>
                {code} —{" "}
                {subjects.find((subject) => subject.code === code)?.name || ""}
              </li>
            ))}
          </ul>
          <div className="modal-actions">
            <Button variant="ghost" onClick={() => setPendingRemovals(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={saving}
              onClick={() => void saveAssignments(pendingRemovals)}
            >
              Confirm Removal
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function ClassSectionsWorkspacePage({
  activePage,
  navigate,
  openClass,
}: {
  activePage: string
  navigate: (s: string) => void
  openClass: (code: string) => void
}) {
  const currentTab =
    activePage === "subject-sections" ? "subject-sections" : "classes"

  return (
    <>
      <div className="tab-group">
        <button
          type="button"
          className={currentTab === "classes" ? "active" : ""}
          onClick={() => navigate("classes")}
        >
          Class Sections
        </button>
        <button
          type="button"
          className={currentTab === "subject-sections" ? "active" : ""}
          onClick={() => navigate("subject-sections")}
        >
          Subject Sections
        </button>
      </div>
      {currentTab === "subject-sections" ? (
        <ManageSectionSubjectsPage />
      ) : (
        <ClassesPage role="admin" navigate={navigate} openClass={openClass} />
      )}
    </>
  )
}

function SubjectEnrollmentPage() {
  type EnrollmentStudent = {
    id: string
    name: string
    gradeLevel: string
    strand: string
    section: string
  }
  type EnrollmentSection = {
    id: string
    subjectCode: string
    subjectName: string
    classSectionCode: string
    classSectionName: string
    teacher: string
    schoolYear: string
    semester: string
    enrolledStudents: string[]
  }
  type EnrollmentClassSection = {
    code: string
    name: string
    gradeLevel: string
    strand: string
  }

  const [studentRecords, setStudentRecords] = useState<EnrollmentStudent[]>([])
  const [sections, setSections] = useState<EnrollmentSection[]>([])
  const [classSections, setClassSections] = useState<EnrollmentClassSection[]>(
    [],
  )
  const [selectedSectionId, setSelectedSectionId] = useState("")
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([])
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([])
  const [adminId, setAdminId] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [enrollmentStatus, setEnrollmentStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadEnrollmentData = async () => {
    setLoading(true)
    try {
      const responses = await Promise.all([
        apiFetch("/api/students"),
        apiFetch("/api/subject-sections"),
        apiFetch("/api/class-sections"),
      ])
      const payloads = await Promise.all(
        responses.map(async (response) => {
          const payload = await response.json().catch(() => null)
          if (!response.ok) {
            throw new Error(
              payload?.message || "Unable to load enrollment data.",
            )
          }
          return payload
        }),
      )
      const [studentData, sectionData, classSectionData] = payloads
      if (
        !Array.isArray(studentData) ||
        !Array.isArray(sectionData) ||
        !Array.isArray(classSectionData)
      ) {
        throw new Error("The server returned invalid enrollment data.")
      }

      setStudentRecords(studentData)
      setSections(
        sectionData.map((section: EnrollmentSection) => ({
          ...section,
          enrolledStudents: Array.isArray(section.enrolledStudents)
            ? section.enrolledStudents.map(String)
            : [],
        })),
      )
      setClassSections(classSectionData)
      setSelectedSectionId((current) => current || sectionData[0]?.id || "")
    } catch (error) {
      setEnrollmentStatus(
        error instanceof Error
          ? error.message
          : "Unable to load enrollment data.",
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    try {
      const session = JSON.parse(
        localStorage.getItem("snhs-demo-session") || "null",
      )
      if (session?.role === "admin" && typeof session.schoolId === "string") {
        setAdminId(session.schoolId)
      }
    } catch {
      setEnrollmentStatus(
        "Your administrator session is invalid. Sign in again.",
      )
    }
    void loadEnrollmentData()
  }, [])

  const selectedSection = sections.find(
    (section) => section.id === selectedSectionId,
  )
  const selectedClassSection = classSections.find(
    (classSection) => classSection.code === selectedSection?.classSectionCode,
  )
  const enrolledIds = new Set(selectedSection?.enrolledStudents || [])
  const enrolledStudents = studentRecords.filter((student) =>
    enrolledIds.has(student.id),
  )
  const eligibleStudents = studentRecords.filter((student) => {
    if (enrolledIds.has(student.id) || !selectedClassSection) return false
    const normalize = (value: string) => value.trim().toLowerCase()
    const normalizeStrand = (value: string) =>
      normalize(value) === "ict" ? "tvl-ict" : normalize(value)
    const sectionSuffix =
      selectedClassSection.name.split("-").pop()?.trim() || ""
    return (
      normalize(student.gradeLevel) ===
        normalize(selectedClassSection.gradeLevel) &&
      (!student.strand ||
        normalizeStrand(student.strand) ===
          normalizeStrand(selectedClassSection.strand)) &&
      [selectedClassSection.name, selectedClassSection.code, sectionSuffix]
        .map(normalize)
        .includes(normalize(student.section))
    )
  })

  const updateEnrollments = async (action: "add" | "remove") => {
    if (!adminId) {
      setEnrollmentStatus(
        "Administrator access is required to change enrollments.",
      )
      return
    }
    if (!selectedSection) {
      setEnrollmentStatus("Select a subject section first.")
      return
    }
    if (!adminPassword) {
      setEnrollmentStatus(
        "Enter your administrator password to confirm this change.",
      )
      return
    }
    const studentIds = action === "add" ? selectedToAdd : selectedToRemove
    if (!studentIds.length) {
      setEnrollmentStatus(
        `Select at least one student to ${
          action === "add" ? "add" : "remove"
        }.`,
      )
      return
    }

    setSaving(true)
    setEnrollmentStatus("")
    let updated = 0
    try {
      for (const studentId of studentIds) {
        const response = await apiFetch(
          action === "add"
            ? "/api/enrollments"
            : `/api/enrollments/${encodeURIComponent(selectedSection.id)}/${encodeURIComponent(studentId)}`,
          {
            method: action === "add" ? "POST" : "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subjectSectionId: selectedSection.id,
              studentId,
              adminId,
              password: adminPassword,
            }),
          },
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(
            payload?.message || "Unable to update the selected enrollment.",
          )
        }
        updated += 1
      }
      setSelectedToAdd([])
      setSelectedToRemove([])
      setAdminPassword("")
      setEnrollmentStatus(
        `${updated} student${updated === 1 ? "" : "s"} ${
          action === "add" ? "added to" : "removed from"
        } ${selectedSection.subjectName}.`,
      )
    } catch (error) {
      setEnrollmentStatus(
        `${
          updated
            ? `Updated ${updated} student${updated === 1 ? "" : "s"}. `
            : ""
        }${
          error instanceof Error
            ? error.message
            : "Unable to update enrollment."
        }`,
      )
    } finally {
      await loadEnrollmentData()
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        title="Subject Enrollment"
        description="Review and manage student enrollment for each subject section."
      />
      <Card className="class-enrollment-panel">
        <div className="card-head">
          <div>
            <h2>Manage Subject Section Enrollment</h2>
            <p>
              Add eligible students or remove existing enrollments without
              affecting student accounts or other records.
            </p>
          </div>
        </div>
        <div className="modal-form">
          <label className="field">
            <span>Subject Section</span>
            <select
              value={selectedSectionId}
              onChange={(event) => {
                setSelectedSectionId(event.target.value)
                setSelectedToAdd([])
                setSelectedToRemove([])
              }}
              disabled={loading || saving || !sections.length}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.subjectName} · {section.classSectionName} ·{" "}
                  {section.schoolYear} {section.semester}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Eligible Students</span>
            <select
              multiple
              value={selectedToAdd}
              onChange={(event) =>
                setSelectedToAdd(
                  Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                )
              }
              disabled={loading || saving || !eligibleStudents.length}
            >
              {eligibleStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.id})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Currently Enrolled Students</span>
            <select
              multiple
              value={selectedToRemove}
              onChange={(event) =>
                setSelectedToRemove(
                  Array.from(
                    event.target.selectedOptions,
                    (option) => option.value,
                  ),
                )
              }
              disabled={loading || saving || !enrolledStudents.length}
            >
              {enrolledStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.id})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Administrator Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              disabled={saving || !adminId}
              placeholder={
                adminId
                  ? "Required to change enrollment"
                  : "Administrator sign-in required"
              }
            />
          </label>
          <div className="modal-actions">
            <Button
              onClick={() => void updateEnrollments("add")}
              disabled={loading || saving || !selectedToAdd.length || !adminId}
            >
              {saving ? "Saving..." : "Add Selected Students"}
            </Button>
            <Button
              variant="danger"
              onClick={() => void updateEnrollments("remove")}
              disabled={
                loading || saving || !selectedToRemove.length || !adminId
              }
            >
              Remove Selected Students
            </Button>
          </div>
          {enrollmentStatus && (
            <p className="login-error" role="status">
              {enrollmentStatus}
            </p>
          )}
        </div>
      </Card>
      <Card className="table-card">
        <DataTable
          actions={false}
          headers={["Student ID", "Student Name", "Grade Level", "Section"]}
          rows={enrolledStudents.map((student) => [
            student.id,
            student.name,
            student.gradeLevel,
            student.section,
          ])}
          paginate
        />
        {!loading && !enrolledStudents.length && (
          <p className="empty-state">
            No students are enrolled in this subject section yet.
          </p>
        )}
      </Card>
    </>
  )
}

function ReportsPage({ role }: { role: Role }) {
  const reports = [
    ["Student Grades Report", "Individual academic performance", "users"],
    ["Class Grades Report", "Class-wide grade summaries", "book"],
    ["Subject Performance Report", "Results by learning area", "layers"],
    [
      "Assignment Submission Report",
      "Submission and completion status",
      "check",
    ],
    ["Assessment Results Report", "Quiz and exam performance", "quiz"],
    ["School-Year Enrollment Report", "Current enrollment records", "report"],
  ]
  const [selectedReport, setSelectedReport] = useState("Student Grades Report")
  const [filterOpen, setFilterOpen] = useState(false)
  const [gradeLevel, setGradeLevel] = useState("All Grades")
  const [semester, setSemester] = useState("All Semesters")
  const [subject, setSubject] = useState("All Subjects")
  const [student, setStudent] = useState("All Students")
  const [teacher, setTeacher] = useState("All Teachers")
  const [section, setSection] = useState("All Sections")
  const settings = useGradingSettings()
  const { records: reportAssignments, error: assignmentError } =
    useApiRecords("assignments")
  const { records: reportSubmissions, error: submissionError } =
    useApiRecords("submissions")
  const [reportStudents, setReportStudents] = useState<string[][]>([])
  const [reportTeachers, setReportTeachers] = useState<string[][]>([])
  const [reportClasses, setReportClasses] = useState<ClassRecord[]>([])
  const [reportScores, setReportScores] = useState<Record<string, unknown>[]>(
    [],
  )
  const [reportEnrollments, setReportEnrollments] =
    useState<Record<string, unknown>[]>([])
  const [reportError, setReportError] = useState("")
  useEffect(() => {
    let active = true
    const loadReportData = async () => {
      try {
        const requests: Promise<Response>[] = [
          apiFetch("/api/subject-sections"),
          apiFetch("/api/enrollments"),
          apiFetch("/api/records/scores"),
        ]
        if (role === "admin") {
          requests.push(apiFetch("/api/students"), apiFetch("/api/teachers"))
        }
        const responses = await Promise.all(requests)
        const payloads = await Promise.all(
          responses.map(async (response) => {
            const payload = await response.json().catch(() => null)
            if (!response.ok || !Array.isArray(payload)) {
              throw new Error(payload?.message || "Unable to load report data.")
            }
            return payload
          }),
        )
        const [
          sections,
          enrollments,
          scores,
          studentsPayload,
          teachersPayload,
        ] = payloads
        if (!active) return
        const reportClasses = sections.map((item) => ({
          subject: String(item.subjectName || ""),
          code: String(item.id),
          teacher: String(item.teacher || ""),
          room: "",
          schedule: "",
          color: "emerald",
          gradeLevel: String(item.gradeLevel || ""),
          strand: String(item.strand || ""),
          schoolYear: String(item.schoolYear || ""),
          semester: String(item.semester || ""),
          classSectionName: String(item.classSectionName || ""),
        }))
        setReportClasses(reportClasses)
        setReportScores(scores)
        setReportEnrollments(enrollments)
        if (role === "admin") {
          setReportStudents(
            studentsPayload.map((item) => [
              String(item.id),
              String(item.name),
              String(item.gradeLevel || ""),
              String(item.section || ""),
            ]),
          )
          setReportTeachers(
            teachersPayload.map((item) => [
              String(item.id),
              String(item.name),
              String(item.subject || ""),
              String(item.email || ""),
            ]),
          )
        } else {
          const uniqueStudents = new Map<string, string[]>()
          for (const enrollment of enrollments) {
            uniqueStudents.set(String(enrollment.studentId), [
              String(enrollment.studentId),
              String(enrollment.studentName || ""),
              "",
              String(enrollment.classSectionName || ""),
            ])
          }
          setReportStudents([...uniqueStudents.values()])
          setReportTeachers(
            [...new Set(reportClasses.map((item) => item.teacher))].map(
              (name) => ["", name, "", ""],
            ),
          )
        }
        setReportError("")
      } catch (error) {
        if (active) {
          setReportError(
            error instanceof Error
              ? error.message
              : "Unable to load report data.",
          )
        }
      }
    }
    void loadReportData()
    return () => {
      active = false
    }
  }, [role])
  const authorizedClasses = reportClasses
  const filteredClasses = authorizedClasses.filter(
    (classItem) =>
      (subject === "All Subjects" || classItem.subject === subject) &&
      (teacher === "All Teachers" || classItem.teacher === teacher) &&
      (semester === "All Semesters" || classItem.semester === semester),
  )
  const schoolYears = Array.from(
    new Set(
      reportClasses.map((classItem) => classItem.schoolYear).filter(Boolean),
    ),
  )
  const schoolYear = schoolYears.join(", ") || "No school year records"

  const gradeRows = filteredClasses
    .flatMap((classItem) =>
      reportScores.flatMap((raw) => {
        if (
          raw.scopeId !== classItem.code ||
          typeof raw.studentId !== "string" ||
          typeof raw.name !== "string"
        )
          return []
        const fields = ["quiz1", "quiz2", "activity", "performance", "exam"]
        if (!fields.every((field) => Number.isFinite(Number(raw[field])))) {
          return []
        }
        const score: RecordedScore = {
          studentId: raw.studentId,
          name: raw.name,
          quiz1: Number(raw.quiz1),
          quiz2: Number(raw.quiz2),
          activity: Number(raw.activity),
          performance: Number(raw.performance),
          exam: Number(raw.exam),
        }
        const breakdown = calculateGradeBreakdown(score, settings)
        const studentRecord = reportStudents.find(
          (record) => record[0] === score.studentId,
        )
        return [
          {
            studentId: score.studentId,
            studentName: score.name,
            gradeLevel: studentRecord?.[2] || classItem.gradeLevel,
            section: studentRecord?.[3] || "",
            subject: classItem.subject,
            code: classItem.code,
            teacher: classItem.teacher,
            written: breakdown.written,
            performance: breakdown.performance,
            exam: breakdown.exams,
            final: breakdown.final,
          },
        ]
      }),
    )
    .filter(
      (record) =>
        (gradeLevel === "All Grades" || record.gradeLevel === gradeLevel) &&
        (section === "All Sections" || record.section === section) &&
        (student === "All Students" || record.studentName === student),
    )

  const groupedClasses = filteredClasses
    .map((classItem) => {
      const grades = gradeRows
        .filter((record) => record.code === classItem.code)
        .map((record) => record.final)
      const valid = grades.filter(Number.isFinite)
      return {
        classItem,
        grades: valid,
        average: valid.reduce((sum, grade) => sum + grade, 0) / valid.length,
      }
    })
    .filter((group) => group.grades.length)

  let headers: string[] = []
  let rows: (string | number)[][] = []
  if (selectedReport === "Student Grades Report") {
    headers = [
      "Student ID",
      "Student Name",
      "Grade",
      "Section",
      "Subject",
      "Written Work",
      "Performance Task",
      "Quarterly Assessment",
      "Final Grade",
      "Academic Status",
    ]
    rows = gradeRows.map((record) => [
      record.studentId,
      record.studentName,
      record.gradeLevel,
      record.section,
      record.subject,
      record.written.toFixed(2),
      record.performance.toFixed(2),
      record.exam.toFixed(2),
      record.final.toFixed(2),
      record.final >= settings.passingGrade ? "Passed" : "Failed",
    ])
  } else if (selectedReport === "Class Grades Report") {
    headers = [
      "Class",
      "Grade",
      "Section",
      "Subject",
      "Teacher",
      "Enrolled",
      "Average",
      "Highest",
      "Lowest",
      "Passing",
      "Failing",
    ]
    rows = groupedClasses.map(({ classItem, grades, average }) => [
      classItem.classSectionName || classItem.code,
      classItem.gradeLevel || "—",
      classItem.classSectionName || "—",
      classItem.subject,
      classItem.teacher,
      reportEnrollments.filter(
        (enrollment) => enrollment.subjectSectionId === classItem.code,
      ).length,
      average.toFixed(2),
      Math.max(...grades).toFixed(2),
      Math.min(...grades).toFixed(2),
      grades.filter((grade) => grade >= settings.passingGrade).length,
      grades.filter((grade) => grade < settings.passingGrade).length,
    ])
  } else if (selectedReport === "Subject Performance Report") {
    headers = [
      "Subject",
      "Teacher",
      "Students",
      "Average",
      "Highest",
      "Lowest",
      "Passing %",
      "Failing %",
    ]
    rows = groupedClasses.map(({ classItem, grades, average }) => {
      const passing = grades.filter(
        (grade) => grade >= settings.passingGrade,
      ).length
      return [
        classItem.subject,
        classItem.teacher,
        reportEnrollments.filter(
          (enrollment) => enrollment.subjectSectionId === classItem.code,
        ).length,
        average.toFixed(2),
        Math.max(...grades).toFixed(2),
        Math.min(...grades).toFixed(2),
        `${((passing / grades.length) * 100).toFixed(1)}%`,
        `${(((grades.length - passing) / grades.length) * 100).toFixed(1)}%`,
      ]
    })
  } else if (selectedReport === "Assignment Submission Report") {
    headers = [
      "Assignment",
      "Subject",
      "Class",
      "Assigned",
      "Submitted",
      "Pending",
      "Late",
      "Missing",
      "Graded",
      "Returned",
    ]
    rows = reportAssignments
      .filter((assignment) =>
        filteredClasses.some(
          (classItem) => classItem.code === assignment.scopeId,
        ),
      )
      .map((assignment) => {
        const classItem = reportClasses.find(
          (item) => item.code === assignment.scopeId,
        )
        if (!classItem) return []
        const relatedSubmissions = reportSubmissions.filter(
          (submission) => submission.assignmentId === assignment.id,
        )
        const assigned = reportEnrollments.filter(
          (enrollment) => enrollment.subjectSectionId === assignment.scopeId,
        ).length
        const submitted = relatedSubmissions.length
        const graded = relatedSubmissions.filter(
          (submission) => submission.status === "Graded",
        ).length
        const returned = relatedSubmissions.filter(
          (submission) => submission.status === "Returned",
        ).length
        const dueDate = new Date(String(assignment.dueDate || ""))
        const isPastDue =
          !Number.isNaN(dueDate.getTime()) && dueDate < new Date()
        const late = relatedSubmissions.filter((submission) => {
          const submittedAt = new Date(String(submission.submittedAt || ""))
          return (
            isPastDue &&
            !Number.isNaN(submittedAt.getTime()) &&
            submittedAt > dueDate
          )
        }).length
        return [
          String(assignment.title || ""),
          classItem.subject,
          classItem.classSectionName || classItem.code,
          assigned,
          submitted,
          Math.max(0, assigned - submitted),
          late,
          isPastDue ? Math.max(0, assigned - submitted) : 0,
          graded,
          returned,
        ]
      })
      .filter((row) => row.length > 0)
  } else if (selectedReport === "Assessment Results Report") {
    headers = [
      "Assessment",
      "Type",
      "Subject",
      "Class",
      "Participants",
      "Passed",
      "Failed",
      "Absent",
      "Pending Evaluation",
      "Average Score",
      "Passing %",
    ]
    rows = []
  } else {
    headers = [
      "School Year",
      "Grade Level",
      "Section",
      "Total Enrolled",
      "Enrollment Changes",
    ]
    const enrollmentGroups = new Map<string, string[][]>()
    reportStudents.forEach((studentRecord) => {
      const key = `${studentRecord[2]}|${studentRecord[3]}`
      enrollmentGroups.set(key, [
        ...(enrollmentGroups.get(key) || []),
        studentRecord,
      ])
    })
    rows = Array.from(enrollmentGroups.entries())
      .filter(([key]) => {
        const [recordGrade, recordSection] = key.split("|")
        return (
          (gradeLevel === "All Grades" || recordGrade === gradeLevel) &&
          (section === "All Sections" || recordSection === section)
        )
      })
      .map(([key, records]) => {
        const [recordGrade, recordSection] = key.split("|")
        return [
          schoolYear,
          recordGrade,
          recordSection,
          records.length,
          "No archived comparison available",
        ]
      })
  }

  const appliedFilters = [
    `School year: ${schoolYear}`,
    ...(selectedReport !== "School-Year Enrollment Report"
      ? [`Semester: ${semester}`]
      : []),
    `Grade level: ${gradeLevel}`,
    `Section: ${section}`,
    ...(subject !== "All Subjects" ? [`Subject: ${subject}`] : []),
    ...(teacher !== "All Teachers" ? [`Teacher: ${teacher}`] : []),
    ...(student !== "All Students" ? [`Student: ${student}`] : []),
  ]
  const totalEnrollment = reportStudents.length
  const schoolAverage = gradeRows.length
    ? gradeRows.reduce((sum, record) => sum + record.final, 0) /
      gradeRows.length
    : null
  const exportReport = () => {
    const exportRows: (string | number)[][] = [
      ["Report", selectedReport],
      ["School", "St. Nicholas Senior High School"],
      ["School Year", schoolYear],
      ["Applied Filters", appliedFilters.join("; ")],
      [
        "Date Generated",
        new Intl.DateTimeFormat("en-PH", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: schoolTimeZone,
        }).format(new Date()),
      ],
      [],
      headers,
      ...rows,
      [],
      ["Total records", rows.length],
    ]
    downloadCsv(
      `${selectedReport.toLowerCase().replace(/ /g, "-")}.csv`,
      exportRows,
    )
  }

  return (
    <>
      <PageHeading
        title={role === "admin" ? "School Reports" : "Class Reports"}
        description={
          role === "admin"
            ? "Review verified school-wide academic and enrollment records."
            : "Review records for your assigned classes."
        }
        action={
          <div className="button-group">
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            <Button icon="download" onClick={exportReport}>
              Export CSV
            </Button>
          </div>
        }
      />
      {(reportError || assignmentError || submissionError) && (
        <p className="form-error" role="alert">
          {[reportError, assignmentError, submissionError]
            .filter(Boolean)
            .join(" ")}
        </p>
      )}
      {role === "admin" && (
        <div className="report-admin-summary">
          <StatCard
            icon="users"
            label="Total Enrollment"
            value={String(totalEnrollment)}
            detail={`${reportStudents.length} total student records`}
          />
          <StatCard
            icon="book"
            label="Managed Classes"
            value={String(reportClasses.length)}
            detail={`${reportTeachers.length} teacher records`}
            tone="blue"
          />
          <StatCard
            icon="chart"
            label="Filtered School Average"
            value={schoolAverage === null ? "—" : schoolAverage.toFixed(2)}
            detail={`${gradeRows.length} evaluated subject records`}
            tone="violet"
          />
        </div>
      )}
      <div className="report-cards">
        {reports.map((r) => (
          <button
            className={`card report-card ${
              selectedReport === r[0] ? "selected" : ""
            }`}
            key={r[0]}
            onClick={() => setSelectedReport(r[0])}
            aria-pressed={selectedReport === r[0]}
          >
            <span>
              <Icon name={r[2] as IconName} />
            </span>
            <div>
              <h2>{r[0]}</h2>
              <p>{r[1]}</p>
            </div>
            <Icon name="arrow" />
          </button>
        ))}
      </div>
      <Card className="report-preview">
        <div className="card-head">
          <div>
            <h2>{selectedReport}</h2>
            <p>
              {gradeLevel}
              {selectedReport !== "School-Year Enrollment Report"
                ? ` · ${semester}`
                : ""}{" "}
              · S.Y. {schoolYear}
            </p>
          </div>
          <div className="button-group">
            <button
              className={`filter-button ${filterOpen ? "active" : ""}`}
              onClick={() => setFilterOpen(!filterOpen)}
            >
              <Icon name="filter" size={16} /> Filter
            </button>
          </div>
        </div>
        {filterOpen && (
          <div className="report-filter-panel">
            <label>
              <span>School year</span>
              <select value={schoolYear} disabled>
                <option>{schoolYear}</option>
              </select>
            </label>
            <label>
              <span>Grade level</span>
              <select
                value={gradeLevel}
                onChange={(event) => setGradeLevel(event.target.value)}
              >
                <option>All Grades</option>
                {Array.from(
                  new Set(
                    reportStudents.map((record) => record[2]).filter(Boolean),
                  ),
                ).map((grade) => (
                  <option key={grade}>{grade}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Section</span>
              <select
                value={section}
                onChange={(event) => setSection(event.target.value)}
              >
                <option>All Sections</option>
                {Array.from(
                  new Set(
                    reportStudents.map((studentRecord) => studentRecord[3]),
                  ),
                ).map((sectionName) => (
                  <option key={sectionName}>{sectionName}</option>
                ))}
              </select>
            </label>
            {selectedReport !== "School-Year Enrollment Report" && (
              <label>
                <span>Subject</span>
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                >
                  <option>All Subjects</option>
                  {Array.from(
                    new Set(
                      authorizedClasses.map((classItem) => classItem.subject),
                    ),
                  ).map((subjectName) => (
                    <option key={subjectName}>{subjectName}</option>
                  ))}
                </select>
              </label>
            )}
            {role === "admin" &&
              selectedReport !== "School-Year Enrollment Report" && (
                <label>
                  <span>Teacher</span>
                  <select
                    value={teacher}
                    onChange={(event) => setTeacher(event.target.value)}
                  >
                    <option>All Teachers</option>
                    {reportTeachers.map((teacherRecord) => (
                      <option key={teacherRecord[0]}>{teacherRecord[1]}</option>
                    ))}
                  </select>
                </label>
              )}
            {selectedReport === "Student Grades Report" && (
              <label>
                <span>Student</span>
                <select
                  value={student}
                  onChange={(event) => setStudent(event.target.value)}
                >
                  <option>All Students</option>
                  {reportStudents.map((studentRecord) => (
                    <option key={studentRecord[0]}>{studentRecord[1]}</option>
                  ))}
                </select>
              </label>
            )}
            {selectedReport !== "School-Year Enrollment Report" && (
              <label>
                <span>Semester</span>
                <select
                  value={semester}
                  onChange={(event) => setSemester(event.target.value)}
                >
                  <option>All Semesters</option>
                  {Array.from(
                    new Set(
                      reportClasses
                        .map((classItem) => classItem.semester)
                        .filter(Boolean),
                    ),
                  ).map((term) => (
                    <option key={term}>{term}</option>
                  ))}
                </select>
              </label>
            )}
            <Button variant="secondary" onClick={() => setFilterOpen(false)}>
              Apply Filters
            </Button>
          </div>
        )}
        <div className="report-meta">
          <span>Passing threshold: {settings.passingGrade}%</span>
          <span>
            {rows.length} record{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        {rows.length ? (
          <DataTable headers={headers} rows={rows} actions={false} />
        ) : (
          <div className="table-empty">
            No valid records match the selected filters. Missing grades are not
            counted as zero.
          </div>
        )}
      </Card>
    </>
  )
}

function ActivityLogsPage() {
  const [logs, setLogs] = useState<string[][]>([])
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  useEffect(() => {
    let active = true
    const loadLogs = async () => {
      try {
        const [logsResponse, usersResponse] = await Promise.all([
          apiFetch("/api/activity-logs"),
          apiFetch("/api/users"),
        ])
        const [logPayload, userPayload] = await Promise.all([
          logsResponse.json(),
          usersResponse.json(),
        ])
        if (
          !logsResponse.ok ||
          !usersResponse.ok ||
          !Array.isArray(logPayload) ||
          !Array.isArray(userPayload)
        ) {
          throw new Error("Unable to load activity logs.")
        }
        const names = new Map(
          userPayload.map((user) => [String(user.id), String(user.name)]),
        )
        const rows = logPayload.map((log) => {
          const createdAt = new Date(log.created_at)
          return [
            names.get(String(log.userId)) || String(log.userId || "System"),
            String(log.action || log.message || ""),
            Number.isNaN(createdAt.getTime())
              ? ""
              : createdAt.toLocaleDateString("en-PH"),
            Number.isNaN(createdAt.getTime())
              ? ""
              : createdAt.toLocaleTimeString("en-PH", {
                  hour: "numeric",
                  minute: "2-digit",
                }),
            String(log.module || "System"),
            String(log.status || "Success"),
          ]
        })
        if (active) {
          setLogs(rows)
          setError("")
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load activity logs.",
          )
        }
      }
    }
    void loadLogs()
    return () => {
      active = false
    }
  }, [])
  const visibleLogs = logs.filter((log) =>
    log.some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  )
  const today = new Date().toLocaleDateString("en-PH")
  const actionsToday = logs.filter((log) => log[2] === today).length
  const loggedUsers = new Set(logs.map((log) => log[0])).size
  const systemEvents = logs.filter((log) => log[4] === "records").length
  const exportLogs = () => {
    downloadCsv("snshs-activity-logs.csv", [
      ["User", "Action", "Date", "Time", "Module", "Status"],
      ...visibleLogs,
    ])
  }
  return (
    <>
      <PageHeading
        title="Activity Logs"
        description="Review important account, academic, and system actions."
        action={
          <Button variant="secondary" icon="download" onClick={exportLogs}>
            Export Logs
          </Button>
        }
      />
      <div className="log-summary">
        <StatCard
          icon="activity"
          label="Actions Today"
          value={String(actionsToday)}
          detail="Recorded today"
        />
        <StatCard
          icon="users"
          label="Users in Logs"
          value={String(loggedUsers)}
          detail="Users in the log"
          tone="blue"
        />
        <StatCard
          icon="settings"
          label="System Events"
          value={String(systemEvents)}
          detail="Database-backed actions"
          tone="violet"
        />
      </div>
      <SearchFilter
        placeholder="Search user, action, or module..."
        value={search}
        onChange={setSearch}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Card className="table-card">
        <DataTable
          actions={false}
          headers={["User", "Action", "Date", "Time", "Module", "Status"]}
          rows={visibleLogs.map((log) => [
            <b>{log[0]}</b>,
            log[1],
            log[2],
            log[3],
            <Badge>{log[4]}</Badge>,
            <Badge tone={log[5] === "Blocked" ? "late" : "published"}>
              {log[5]}
            </Badge>,
          ])}
          paginate
        />
        {!visibleLogs.length && (
          <div className="table-empty">No activity logs match “{search}”.</div>
        )}
      </Card>
    </>
  )
}

function SettingsPage() {
  const [saved, setSaved] = useState("")
  const [settingsError, setSettingsError] = useState("")
  const [weights, setWeights] = useState({
    written: defaultGradingSettings.written,
    performance: defaultGradingSettings.performance,
    exams: defaultGradingSettings.exams,
  })
  const [passingGrade, setPassingGrade] = useState(
    defaultGradingSettings.passingGrade,
  )
  const [schoolInfo, setSchoolInfo] = useState({
    schoolName: "St. Nicholas Senior High School",
    schoolYear: "",
    semester: "",
    semesterDateRange: "",
  })
  const totalWeight = weights.written + weights.performance + weights.exams
  useEffect(() => {
    let active = true
    void apiFetch("/api/records/settings")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(payload?.message || "Unable to load system settings.")
        }
        return payload
      })
      .then((records) => {
        if (!active) return
        const settings = records.find((record) => record.id === "lms-settings")
        if (!settings) return
        if (settings.weights) setWeights(settings.weights)
        if (Number.isFinite(Number(settings.passingGrade))) {
          setPassingGrade(Number(settings.passingGrade))
        }
        setSchoolInfo((current) => ({ ...current, ...settings.schoolInfo }))
      })
      .catch((error: unknown) => {
        if (active) {
          setSettingsError(
            error instanceof Error
              ? error.message
              : "Unable to load system settings.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [])
  const saveSetting = async (section: string) => {
    setSettingsError("")
    setSaved("")
    try {
      await saveApiRecord(
        "settings",
        {
          section,
          weights,
          passingGrade,
          schoolInfo,
          savedAt: new Date().toISOString(),
        },
        "",
        "lms-settings",
      )
      setSaved(`${section} saved successfully`)
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to save system settings.",
      )
    }
  }

  return (
    <>
      <PageHeading
        title="System Settings"
        description="Configure school information and academic settings."
      />
      <div className="settings-grid">
        <Card>
          <div className="card-head">
            <div>
              <h2>School Information</h2>
              <p>Primary school details used throughout the LMS.</p>
            </div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>School Name</span>
              <input
                value={schoolInfo.schoolName}
                onChange={(event) =>
                  setSchoolInfo({
                    ...schoolInfo,
                    schoolName: event.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              <span>School Year</span>
              <input
                value={schoolInfo.schoolYear}
                onChange={(event) =>
                  setSchoolInfo({
                    ...schoolInfo,
                    schoolYear: event.target.value,
                  })
                }
              />
            </label>
            <label className="field">
              <span>Current Semester</span>
              <select
                value={schoolInfo.semester}
                onChange={(event) =>
                  setSchoolInfo({ ...schoolInfo, semester: event.target.value })
                }
              >
                <option value="">Select a semester</option>
                <option>Semester 1</option>
                <option>Semester 2</option>
              </select>
            </label>
            <label className="field full">
              <span>Semester Date Range</span>
              <input
                value={schoolInfo.semesterDateRange}
                onChange={(event) =>
                  setSchoolInfo({
                    ...schoolInfo,
                    semesterDateRange: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <Button onClick={() => void saveSetting("School information")}>
            Save Changes
          </Button>
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h2>Grading Weights</h2>
              <p>Weights must total exactly 100%.</p>
            </div>
          </div>
          <div className="weight-list">
            <label>
              <span>Written Works</span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.written}
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      written: Number(event.target.value),
                    })
                  }
                />
                <b>%</b>
              </div>
            </label>
            <label>
              <span>Performance Tasks</span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.performance}
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      performance: Number(event.target.value),
                    })
                  }
                />
                <b>%</b>
              </div>
            </label>
            <label>
              <span>Exams</span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights.exams}
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      exams: Number(event.target.value),
                    })
                  }
                />
                <b>%</b>
              </div>
            </label>
            <label>
              <span>Passing Grade</span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passingGrade}
                  onChange={(event) =>
                    setPassingGrade(
                      Math.min(100, Math.max(0, Number(event.target.value))),
                    )
                  }
                />
                <b>%</b>
              </div>
            </label>
          </div>
          <div className="weight-total">
            <Icon name="check" />
            <span>
              {totalWeight === 100
                ? "VALID CONFIGURATION"
                : "WEIGHTS MUST TOTAL 100%"}
            </span>
            <strong>TOTAL = {totalWeight}%</strong>
          </div>
          <Button
            disabled={totalWeight !== 100}
            onClick={() => void saveSetting("Grading system")}
          >
            Update Grading System
          </Button>
        </Card>
      </div>
      {settingsError && (
        <p className="form-error" role="alert">
          {settingsError}
        </p>
      )}
      {saved && (
        <div className="settings-saved" role="status">
          <Icon name="check" size={17} />
          {saved}
        </div>
      )}
    </>
  )
}

function Pagination({
  total = 48,
  pageSize = 5,
  page: controlledPage,
  onPageChange,
}: {
  total?: number
  pageSize?: number
  page?: number
  onPageChange?: (page: number) => void
}) {
  const [internalPage, setInternalPage] = useState(1)
  const page = controlledPage ?? internalPage
  const setPage = (nextPage: number) => {
    onPageChange?.(nextPage)
    if (controlledPage === undefined) setInternalPage(nextPage)
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span>
        Showing {total ? (page - 1) * pageSize + 1 : 0} to{" "}
        {Math.min(page * pageSize, total)} of {total} results
      </span>
      <div>
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (number) => (
            <button
              key={number}
              className={page === number ? "active" : ""}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ),
        )}
        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

function GenericPage({
  role,
  page,
  openModal,
  navigate,
  unreadAnnouncements,
  setUnreadAnnouncements,
  unreadNotifications,
  setUnreadNotifications,
  userId,
  profilePhoto,
  setProfilePhoto,
  selectedClassCode,
  openClass,
}: {
  role: Role
  page: string
  openModal: (s: string) => void
  navigate: (s: string) => void
  unreadAnnouncements: number
  setUnreadAnnouncements: (count: number) => void
  unreadNotifications: number
  setUnreadNotifications: (count: number) => void
  userId: string
  profilePhoto: string | null
  setProfilePhoto: (photo: string) => void
  selectedClassCode: string
  openClass: (code: string) => void
}) {
  if (page === "classes" || page === "subject-sections") {
    if (role === "admin") {
      return (
        <ClassSectionsWorkspacePage
          activePage={page}
          navigate={navigate}
          openClass={openClass}
        />
      )
    }
    return (
      <ClassesPage
        role={role}
        userId={userId}
        navigate={navigate}
        openClass={openClass}
      />
    )
  }
  if (page === "materials")
    return <MaterialsPage role={role} openModal={openModal} />
  if (page === "assignments")
    return <AssignmentsPage role={role} openModal={openModal} userId={userId} />
  if (page === "assessments")
    return <AssessmentsPage role={role} openModal={openModal} userId={userId} />
  if (page === "quizzes" || page === "exams")
    return (
      <AssessmentsPage
        role={role}
        openModal={openModal}
        userId={userId}
        section={page}
      />
    )
  if (page === "class-details")
    return (
      <ClassDetails
        role={role}
        navigate={navigate}
        classCode={selectedClassCode}
      />
    )
  if (page === "grades")
    return <GradesPage role={role} selectedClassCode={selectedClassCode} />
  if (page === "announcements")
    return (
      <AnnouncementsPage
        role={role}
        openModal={openModal}
        unreadCount={unreadAnnouncements}
        onUnreadCountChange={setUnreadAnnouncements}
      />
    )
  if (page === "calendar")
    return <CalendarPage role={role} openModal={openModal} />
  if (page === "notifications")
    return (
      <NotificationsPage
        onUnreadCountChange={setUnreadNotifications}
        userId={userId}
      />
    )
  if (page === "profile")
    return (
      <ProfilePage
        role={role}
        userId={userId}
        photo={profilePhoto}
        onPhotoChange={setProfilePhoto}
      />
    )
  if (page === "reports") return <ReportsPage role={role} />
  if (page === "activity-logs") return <ActivityLogsPage />
  if (page === "settings") return <SettingsPage />
  if (page === "subjects")
    return (
      <ManagementPage
        kind="subjects"
        openModal={openModal}
        navigate={navigate}
      />
    )
  if (page === "students" || page === "teachers")
    return (
      <ManagementPage kind={page} openModal={openModal} navigate={navigate} />
    )
  return (
    <ClassesPage
      role={role}
      userId={userId}
      navigate={navigate}
      openClass={openClass}
    />
  )
}

function Shell({ role, logout }: { role: Role; logout: () => void }) {
  const [page, setPage] = useState("dashboard"),
    [drawer, setDrawer] = useState(true),
    [notifications, setNotifications] = useState(false),
    [searchQuery, setSearchQuery] = useState(""),
    [searchFocused, setSearchFocused] = useState(false),
    [modal, setModal] = useState(""),
    [toast, setToast] = useState(""),
    [unreadAnnouncements, setUnreadAnnouncements] = useState(0),
    [unreadNotifications, setUnreadNotifications] = useState(0),
    [selectedClassCode, setSelectedClassCode] = useState(""),
    [profilePhoto, setProfilePhotoState] = useState<string | null>(null),
    [currentUserId, setCurrentUserId] = useState("")
  const [subjectSectionOptions, setSubjectSectionOptions] = useState<Array<{
    id: string
    label: string
  }>>([])
  const [notificationPreview, setNotificationPreview] = useState<Array<{
    id: string
    title: string
    detail: string
    read: boolean
  }>>([])
  const [profileDetails, setProfileDetails] = useState({
    gradeLevel: "",
    section: "",
    subject: "",
  })
  const [roleName, setRoleName] = useState(
    role === "student"
      ? "Student"
      : role === "teacher"
        ? "Teacher"
        : "Administrator",
  )
  const roleLabel =
    role === "student"
      ? [profileDetails.gradeLevel, profileDetails.section]
          .filter(Boolean)
          .join(" · ") || "Student"
      : role === "teacher"
        ? profileDetails.subject
          ? `Teacher · ${profileDetails.subject}`
          : "Teacher"
        : "Administrator"
  useEffect(() => {
    const updateProfileName = (event: Event) => {
      const profileEvent = event as CustomEvent<{ id?: string; name?: string }>
      if (profileEvent.detail?.name) setRoleName(profileEvent.detail.name)
      if (profileEvent.detail?.id) {
        setCurrentUserId(profileEvent.detail.id)
        try {
          const session = JSON.parse(
            localStorage.getItem("snhs-demo-session") || "null",
          )
          if (session) {
            session.schoolId = profileEvent.detail.id
            localStorage.setItem("snhs-demo-session", JSON.stringify(session))
          }
        } catch (error) {
          console.error("Unable to update the saved account ID:", error)
        }
      }
    }
    window.addEventListener("snhs-profile-updated", updateProfileName)
    return () =>
      window.removeEventListener("snhs-profile-updated", updateProfileName)
  }, [])
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>(
          '[aria-label="Search navigation"]',
        )
        input?.focus()
        setSearchFocused(true)
      }
    }
    window.addEventListener("keydown", openSearch)
    return () => window.removeEventListener("keydown", openSearch)
  }, [])
  const detailLabels: Record<string, string> = {
    "class-details": "Class Details",
    "material-viewer": "Material Viewer",
    "assignment-details": "Assignment Details",
    "lesson-page": "Lesson",
    "quiz-instructions": "Quiz Instructions",
    "quiz-player": "Assessment",
    "quiz-result": "Quiz Result",
    "subject-sections": "Subject Sections",
    notifications: "Notifications",
  }
  const pageLabel =
    nav[role].find((n) => n.id === page)?.label ||
    detailLabels[page] ||
    "Dashboard"
  const searchDestinations = [
    ...nav[role],
    ...(role === "admin"
      ? [
          {
            id: "subject-sections",
            label: "Subject Sections",
            icon: "book" as IconName,
          },
        ]
      : []),
    { id: "profile", label: "My Profile", icon: "user" as IconName },
    {
      id: "notifications",
      label: "Notifications",
      icon: "bell" as IconName,
    },
  ]
  const searchResults = searchDestinations.filter((destination) =>
    destination.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  )
  const navigateTo = (destination: string) => {
    setPage(destination)
    setSearchQuery("")
    setSearchFocused(false)
    setNotifications(false)
  }
  const openModal = (title: string) => setModal(title)
  const openClass = (code: string) => {
    setSelectedClassCode(code)
    setPage("class-details")
  }
  const notify = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(""), 2600)
  }
  useEffect(() => {
    let active = true
    let session: { schoolId?: string } | null = null
    try {
      session = JSON.parse(localStorage.getItem("snhs-demo-session") || "null")
    } catch {
      setCurrentUserId("")
    }
    const userId = session?.schoolId || ""
    setCurrentUserId(userId)
    const loadPersonalData = async () => {
      try {
        const accountResponse = await apiFetch("/api/me")
        const account = await accountResponse.json()
        if (!accountResponse.ok || typeof account.name !== "string") {
          throw new Error(account?.message || "Unable to load account details.")
        }
        if (!active) return
        setCurrentUserId(String(account.id || userId))
        setRoleName(account.name)
        setProfileDetails({
          gradeLevel: String(account.gradeLevel || ""),
          section: String(account.section || ""),
          subject: String(account.subject || ""),
        })
      } catch (error) {
        if (active) {
          notify(
            error instanceof Error
              ? error.message
              : "Unable to load account details.",
          )
        }
      }
      try {
        const photoResponse = await apiFetch(
          `/api/records/profile-photos?ownerId=${encodeURIComponent(userId)}`,
        )
        const photos = await photoResponse.json()
        if (!photoResponse.ok || !Array.isArray(photos)) {
          throw new Error("Unable to load profile photo.")
        }
        if (!active) return
        const photoRecord = photos.find(
          (record) => record.ownerId === userId || record.id === userId,
        )
        setProfilePhotoState(photoRecord?.photo || null)
      } catch (error) {
        if (active) {
          notify(
            error instanceof Error
              ? error.message
              : "Unable to load profile photo.",
          )
        }
      }
    }
    void loadPersonalData()
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    let active = true
    void apiFetch("/api/subject-sections")
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(
            payload?.message || "Unable to load subject sections.",
          )
        }
        return payload
      })
      .then((records) => {
        if (!active) return
        setSubjectSectionOptions(
          records.map((record) => ({
            id: String(record.id),
            label: `${record.subjectName} · ${record.classSectionName}`,
          })),
        )
      })
      .catch((error: unknown) => {
        if (active) {
          notify(
            error instanceof Error
              ? error.message
              : "Unable to load subject sections.",
          )
        }
      })
    return () => {
      active = false
    }
  }, [])
  useEffect(() => {
    if (!currentUserId) return
    let active = true
    const loadNotifications = async () => {
      try {
        const response = await apiFetch(
          `/api/records/notifications?ownerId=${encodeURIComponent(currentUserId)}`,
        )
        const records = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(records)) {
          throw new Error(records?.message || "Unable to load notifications.")
        }
        if (!active) return
        const visibleRecords = records.map(
          (record: Record<string, unknown>) => ({
            id: String(record.id),
            title: String(record.title || "Notification"),
            detail: String(record.detail || ""),
            read: record.read === true,
          }),
        )
        setNotificationPreview(visibleRecords)
        setUnreadNotifications(
          visibleRecords.filter((record) => !record.read).length,
        )
      } catch (error) {
        if (active) {
          notify(
            error instanceof Error
              ? error.message
              : "Unable to load notifications.",
          )
        }
      }
    }
    const refresh = () => void loadNotifications()
    void loadNotifications()
    window.addEventListener("snhs-notifications-updated", refresh)
    return () => {
      active = false
      window.removeEventListener("snhs-notifications-updated", refresh)
    }
  }, [currentUserId])
  const setProfilePhoto = async (photo: string) => {
    if (!currentUserId) {
      notify("Your user identity is unavailable. Sign in again.")
      return
    }
    try {
      await saveApiRecord(
        "profile-photos",
        { photo },
        "",
        currentUserId,
        currentUserId,
      )
      window.dispatchEvent(new Event("snhs-announcements-updated"))
      setProfilePhotoState(photo)
      notify("Profile photo updated")
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Unable to update profile photo.",
      )
    }
  }
  const modalForm = (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const resource =
          modal === "Create Announcement"
            ? "announcements"
            : modal === "Add Learning Material"
              ? "materials"
              : modal === "Create Assignment"
                ? "assignments"
                : modal === "Create Quiz" || modal === "Create Exam"
                  ? "assessments"
                  : modal === "Create Calendar Event"
                    ? "calendar-events"
                    : ""
        if (!resource) {
          notify("This record type is not supported.")
          return
        }
        const title = String(form.get("title") || "").trim()
        const scopeId = String(form.get("scopeId") || "")
        const section = subjectSectionOptions.find(
          (item) => item.id === scopeId,
        )
        const status = String(form.get("status") || "Published")
        const description = String(form.get("description") || "").trim()
        const payload: Record<string, unknown> = {
          title,
          description,
          subject: section?.label || "",
          status,
        }
        if (resource === "announcements") {
          payload.author = roleName
          payload.audience = section?.label || "School-wide"
          payload.body = String(form.get("description") || "").trim()
          payload.date = new Date().toISOString()
          payload.status = "Published"
        } else if (resource === "assignments") {
          payload.dueDate = String(form.get("dueDate") || "")
          payload.dueTime = String(form.get("dueTime") || "")
          payload.points = String(form.get("points") || "")
        } else if (resource === "assessments") {
          payload.type = modal === "Create Quiz" ? "quiz" : "exam"
          payload.questions = String(form.get("questions") || "")
          payload.duration = String(form.get("duration") || "")
          payload.attempts = String(form.get("attempts") || "")
          payload.passingScore = String(form.get("passingScore") || "")
          payload.availableDate = String(form.get("availableDate") || "")
        } else if (resource === "calendar-events") {
          payload.type = String(form.get("type") || "event")
          payload.date = String(form.get("date") || "")
        }
        if (
          !title ||
          (!scopeId && !["announcements", "calendar-events"].includes(resource))
        ) {
          notify("Provide a title and select a class section.")
          return
        }
        try {
          await saveApiRecord(
            resource,
            payload,
            scopeId,
            undefined,
            currentUserId,
          )
        } catch (error) {
          notify(
            error instanceof Error
              ? error.message
              : `Unable to create ${resource}.`,
          )
          return
        }
        setModal("")
        notify(`${modal.replace("Add ", "")} saved successfully.`)
      }}
    >
      <div className="modal-form">
        <label className="field">
          <span>Title / Name</span>
          <input name="title" required />
        </label>
        <label className="field">
          <span>Class Section</span>
          <select
            name="scopeId"
            required={
              !(
                role === "admin" &&
                ["Create Announcement", "Create Calendar Event"].includes(modal)
              )
            }
          >
            {role === "admin" &&
              ["Create Announcement", "Create Calendar Event"].includes(
                modal,
              ) && <option value="">School-wide</option>}
            {role === "teacher" && (
              <option value="">Select a class section</option>
            )}
            {subjectSectionOptions.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field full">
          <span>Description</span>
          <textarea name="description" rows={4} />
        </label>
        {modal === "Create Assignment" && (
          <>
            <label className="field">
              <span>Due Date</span>
              <input name="dueDate" type="date" />
            </label>
            <label className="field">
              <span>Due Time</span>
              <input name="dueTime" type="time" />
            </label>
            <label className="field">
              <span>Points</span>
              <input name="points" type="number" min="1" />
            </label>
          </>
        )}
        {(modal === "Create Quiz" || modal === "Create Exam") && (
          <>
            <label className="field">
              <span>Questions</span>
              <input name="questions" type="number" min="1" required />
            </label>
            <label className="field">
              <span>Duration in minutes</span>
              <input name="duration" type="number" min="1" required />
            </label>
            <label className="field">
              <span>Attempts</span>
              <input name="attempts" type="number" min="1" required />
            </label>
            <label className="field">
              <span>Passing score</span>
              <input name="passingScore" type="number" min="1" max="100" />
            </label>
            <label className="field">
              <span>Available date</span>
              <input name="availableDate" type="datetime-local" />
            </label>
          </>
        )}
        {modal === "Create Calendar Event" && (
          <>
            <label className="field">
              <span>Event Type</span>
              <select name="type">
                <option value="event">School Event</option>
                <option value="class">Class</option>
                <option value="assignment">Assignment</option>
                <option value="quiz">Quiz</option>
              </select>
            </label>
            <label className="field">
              <span>Date and time</span>
              <input name="date" type="datetime-local" required />
            </label>
            <label className="field">
              <span>Visibility</span>
              <select name="status">
                <option>Published</option>
                <option>Draft</option>
              </select>
            </label>
          </>
        )}
        {[
          "Add Learning Material",
          "Create Assignment",
          "Create Quiz",
          "Create Exam",
        ].includes(modal) && (
          <label className="field">
            <span>Visibility</span>
            <select name="status">
              <option>Draft</option>
              <option>Published</option>
            </select>
          </label>
        )}
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={() => setModal("")}>
          Cancel
        </Button>
        <Button type="submit">Save Record</Button>
      </div>
    </form>
  )

  return (
    <div className="app-shell">
      {drawer && (
        <div className="drawer-scrim" onClick={() => setDrawer(false)} />
      )}
      <aside className={drawer ? "sidebar open" : "sidebar"}>
        <div className="side-brand">
          <img src={logo} alt="SNSHS official logo" />
          <div>
            <strong>SNSHS LMS</strong>
            <span>LEARNING PORTAL</span>
          </div>
          <button onClick={() => setDrawer(false)} aria-label="Close menu">
            <Icon name="close" />
          </button>
        </div>
        <button
          className="side-user"
          onClick={() => {
            setPage("profile")
            setDrawer(false)
          }}
          aria-label={`Open ${roleName} profile`}
        >
          <ProfileAvatar role={role} className="avatar" src={profilePhoto} />
          <div>
            <strong>{roleName}</strong>
            <span>{roleLabel}</span>
          </div>
          <Icon name="arrow" size={15} />
        </button>
        <nav aria-label="Main navigation">
          <span className="nav-label">MAIN MENU</span>
          {nav[role].map((item) =>
            role === "admin" && item.id === "classes" ? (
              <div className="sidebar-nav-group" key="class-group">
                <span className="nav-label">CLASSES</span>
                {[
                  {
                    id: "classes",
                    label: "Class Sections",
                    icon: "book" as IconName,
                  },
                  {
                    id: "subject-sections",
                    label: "Subject Sections",
                    icon: "layers" as IconName,
                  },
                ].map((subjectItem) => (
                  <button
                    key={subjectItem.id}
                    className={
                      page === subjectItem.id ||
                      (subjectItem.id === "classes" && page === "class-details")
                        ? "active"
                        : ""
                    }
                    aria-current={page === subjectItem.id ? "page" : undefined}
                    onClick={() => {
                      setPage(subjectItem.id)
                      setDrawer(false)
                    }}
                  >
                    <Icon name={subjectItem.icon} />
                    <span>{subjectItem.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                key={item.id}
                className={page === item.id ? "active" : ""}
                aria-current={page === item.id ? "page" : undefined}
                onClick={() => {
                  setPage(item.id)
                  setDrawer(false)
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.id === "announcements" && unreadAnnouncements > 0 && (
                  <i>{unreadAnnouncements}</i>
                )}
              </button>
            ),
          )}
        </nav>
        <div className="side-bottom">
          <button onClick={() => openModal("Confirm Logout")}>
            <Icon name="logout" />
            <span>Logout</span>
          </button>
          <div>
            <span>SNSHS LMS</span>
            <small>Version 2.4.0</small>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button
              className="mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>
            <div>
              <span>
                {role === "admin"
                  ? "Administration"
                  : role === "teacher"
                    ? "Teacher workspace"
                    : "Student workspace"}{" "}
                / {pageLabel}
              </span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <label className="top-search">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search navigation"
                  placeholder="Search modules..."
                  value={searchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() =>
                    window.setTimeout(() => setSearchFocused(false), 120)
                  }
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setSearchFocused(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      navigateTo(searchResults[0].id)
                    }
                    if (event.key === "Escape") setSearchFocused(false)
                  }}
                />
                <kbd>⌘ K</kbd>
              </label>
              {searchFocused && searchQuery.trim() && (
                <div className="search-results">
                  <span>Navigation</span>
                  {searchResults.length ? (
                    searchResults.map((destination) => (
                      <button
                        key={destination.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => navigateTo(destination.id)}
                      >
                        <Icon name={destination.icon} size={16} />
                        <b>{destination.label}</b>
                        <small>Open</small>
                      </button>
                    ))
                  ) : (
                    <p>No modules match “{searchQuery}”.</p>
                  )}
                </div>
              )}
            </div>
            <div className="popover-wrap">
              <button
                className="top-icon"
                onClick={() => {
                  setNotifications(!notifications)
                }}
                aria-label="Notifications"
              >
                <Icon name="bell" />
                {unreadNotifications > 0 && <i>{unreadNotifications}</i>}
              </button>
              {notifications && (
                <div className="notification-popover">
                  <div>
                    <h3>Notifications</h3>
                    <button
                      onClick={() => {
                        setPage("notifications")
                        setNotifications(false)
                      }}
                    >
                      View all
                    </button>
                  </div>
                  {notificationPreview.slice(0, 3).map((item) => (
                    <button
                      className="notification-item"
                      key={item.id}
                      onClick={() => {
                        setPage("notifications")
                        setNotifications(false)
                      }}
                    >
                      {!item.read && <i />}
                      <span>
                        <b>{item.title}</b>
                        <small>
                          {item.detail || "Open notifications for details."}
                        </small>
                      </span>
                    </button>
                  ))}
                  {!notificationPreview.length && (
                    <p className="notification-empty">
                      No notifications to display.
                    </p>
                  )}
                  <button
                    className="notification-view-all"
                    onClick={() => {
                      setPage("notifications")
                      setNotifications(false)
                    }}
                  >
                    View all notifications
                    <Icon name="arrow" size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          {page === "dashboard" ? (
            <Dashboard role={role} userId={currentUserId} navigate={setPage} />
          ) : (
            <GenericPage
              role={role}
              page={page}
              openModal={openModal}
              navigate={setPage}
              unreadAnnouncements={unreadAnnouncements}
              setUnreadAnnouncements={setUnreadAnnouncements}
              unreadNotifications={unreadNotifications}
              setUnreadNotifications={setUnreadNotifications}
              userId={currentUserId}
              profilePhoto={profilePhoto}
              setProfilePhoto={setProfilePhoto}
              selectedClassCode={selectedClassCode}
              openClass={openClass}
            />
          )}
          <footer>
            St. Nicholas Senior High School · Better Learning, Brighter Future
          </footer>
        </main>
      </div>
      {modal && (
        <Modal title={modal} close={() => setModal("")}>
          {modal === "Confirm Logout" ? (
            <div>
              <p className="confirm-copy">
                Are you sure you want to log out of your SNSHS LMS account?
              </p>
              <div className="modal-actions">
                <Button variant="ghost" onClick={() => setModal("")}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={logout}>
                  Logout
                </Button>
              </div>
            </div>
          ) : (
            modalForm
          )}
        </Modal>
      )}
      {toast && (
        <div className="toast">
          <span>
            <Icon name="check" size={18} />
          </span>
          <div>
            <b>Success</b>
            <p>{toast}</p>
          </div>
          <button onClick={() => setToast("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [role, setRole] = useState<Role | null>(null)
  const logout = async () => {
    const token = localStorage.getItem("snhs-session-token")
    if (token) {
      try {
        const response = await fetch("/api/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) {
          console.error("Unable to invalidate the server session.")
        }
      } catch (error) {
        console.error("Unable to invalidate the server session:", error)
      }
    }
    localStorage.removeItem("snhs-session-token")
    localStorage.removeItem("snhs-demo-session")
    setRole(null)
  }
  useEffect(() => {
    document.title = role
      ? `SNSHS LMS · ${role[0].toUpperCase() + role.slice(1)} Portal`
      : "SNSHS LMS · Login"
  }, [role])
  return role ? (
    <Shell role={role} logout={logout} />
  ) : (
    <Login onLogin={setRole} />
  )
}
