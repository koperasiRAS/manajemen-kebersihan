// ============================================================
// Application Constants
// ============================================================

export const APP_NAME = 'Clean Office Discipline System';

// Report limits
export const MAX_DAILY_REPORTS = 3;
export const MIN_DAILY_REPORTS = 1;

// Discipline thresholds
export const VIOLATION_THRESHOLD = 3; // consecutive missed days

// File upload constraints
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.webp';

// Image compression settings
export const COMPRESSION_MAX_SIZE_MB = 1; // compress to max 1MB
export const COMPRESSION_MAX_WIDTH = 1600; // max width in pixels
export const COMPRESSION_QUALITY = 0.8; // 80% quality

// Storage
export const STORAGE_BUCKET = 'cleaning-photos';
export const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

// Timezone
export const APP_TIMEZONE = 'Asia/Jakarta';

// Session
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Data retention
export const PHOTO_RETENTION_MONTHS = 6;
export const AUDIT_LOG_RETENTION_MONTHS = 12;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  HISTORY: '/history',
  OWNER: '/owner',
  OWNER_REPORTS: '/owner/reports',
  OWNER_DISCIPLINE: '/owner/discipline',
  OWNER_EMPLOYEES: '/owner/employees',
  OWNER_LOCATIONS: '/owner/locations',
  OWNER_SCHEDULES: '/owner/schedules',
  OWNER_AUDIT: '/owner/audit',
} as const;

// Day names
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Rating
export const MAX_RATING = 5;
