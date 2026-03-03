// ============================================================
// Type definitions for Clean Office Discipline System
// ============================================================

export type UserRole = 'owner' | 'employee';
export type ReportStatus = 'valid' | 'rejected';
export type DisciplineStatus = 'submitted' | 'missed';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CleaningReport {
  id: string;
  user_id: string;
  photo_url: string;
  notes: string | null;
  submitted_at: string;
  submission_date: string;
  status: ReportStatus;
  rejection_note: string | null;
  latitude: number | null;
  longitude: number | null;
  location_id: string | null;
  rating: number | null;
  rating_note: string | null;
  created_at: string;
  // Joined fields
  user?: User;
  location?: Location;
}

export interface DisciplineLog {
  id: string;
  user_id: string;
  date: string;
  status: DisciplineStatus;
  consecutive_missed: number;
  created_at: string;
  // Joined fields
  user?: User;
}

export interface Location {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CleaningSchedule {
  id: string;
  user_id: string;
  location_id: string | null;
  day_of_week: number | null; // 0=Sunday, 6=Saturday
  scheduled_date: string | null; // YYYY-MM-DD
  is_active: boolean;
  created_at: string;
  // Joined
  user?: User;
  location?: Location;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  // Joined
  user?: User;
}

export interface DailySubmissionCount {
  count: number;
  max: number;
  remaining: number;
}

export interface EmployeeDisciplineSummary {
  user_id: string;
  user_name: string;
  latest_consecutive_missed: number;
  is_violation: boolean;
  last_submission_date: string | null;
  total_missed: number;
}

export interface ReportFilters {
  date?: string;
  employeeId?: string;
  status?: ReportStatus;
  locationId?: string;
}

export interface NotificationPayload {
  type: 'violation_warning' | 'violation_alert' | 'daily_reminder' | 'end_of_day_warning' | 'weekly_digest';
  employeeName: string;
  employeePhone?: string | null;
  ownerPhone?: string | null;
  consecutiveMissed: number;
  message: string;
}

export interface WeeklySummary {
  week_start: string;
  week_end: string;
  total_reports: number;
  total_employees: number;
  total_submitted: number;
  total_missed: number;
  violation_count: number;
  employees: {
    user_id: string;
    user_name: string;
    reports_count: number;
    missed_count: number;
    average_rating: number | null;
  }[];
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
