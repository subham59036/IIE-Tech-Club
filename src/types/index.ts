// ─── Shared TypeScript types for TechOS ─────────────────────────────────────
// Edit these interfaces if you add new DB columns or API fields.

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface SessionUser {
  id: number;             // DB primary key
  role: "admin" | "student";
  name: string;
  userId: string;         // A001 / S001 etc.
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export interface Admin {
  id: number;
  name: string;
  admin_id: string;       // e.g. A001
  has_password: boolean;  // false = first login pending
  created_at: number;     // unix ms
}

// ─── Student ─────────────────────────────────────────────────────────────────
export interface Student {
  id: number;
  name: string;
  student_id: string;     // e.g. S001
  has_password: boolean;
  created_at: number;
}

// ─── Attendance ──────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id: number;
  student_db_id: number;
  student_name: string;
  student_id: string;
  date: string;           // YYYY-MM-DD
  status: "present" | "absent";
  marked_by_name: string;
  created_at: number;
}

// Used by attendance tab to show monthly stats per student
export interface AttendanceSummary {
  student_db_id: number;
  student_name: string;
  student_id: string;
  present_days: number;
  absent_days: number;
  total_club_days: number; // days when at least 1 record exists
  percentage: number;
}

// ─── Announcements ───────────────────────────────────────────────────────────
export interface Announcement {
  id: number;
  title: string;
  description: string;
  announced_date: string; // YYYY-MM-DD (user-specified)
  posted_by_name: string;
  created_at: number;
}

// ─── Events ──────────────────────────────────────────────────────────────────
export type EventStatus = "live" | "paused";

export interface ClubEvent {
  id: number;
  title: string;
  description: string;
  event_date: string;       // YYYY-MM-DD
  last_reg_date: string;    // YYYY-MM-DD
  status: EventStatus;
  form_token: string;       // unique token for public URL
  posted_by_name: string;
  created_at: number;
  registration_count: number;
  is_expired: boolean;      // computed: today > last_reg_date
}

export interface EventRegistration {
  id: number;
  event_id: number;
  student_name: string;
  semester: number;
  department: string;
  roll: string;
  created_at: number;
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface AdminNotification {
  id: number;
  message: string;
  created_at: number;
}

export interface StudentNotification {
  id: number;
  student_db_id: number;
  message: string;
  created_at: number;
}

// ─── API response wrapper ────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  forceLogout?: boolean;   // set true when admin has been removed mid-session
}
