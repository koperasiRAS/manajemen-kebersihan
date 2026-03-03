// ============================================================
// Utility Functions
// ============================================================

import { APP_TIMEZONE } from './constants';

/**
 * Get current date/time in WIB (Asia/Jakarta) timezone
 */
export function getWIBDate(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE }));
}

/**
 * Format date to locale string (Indonesian)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Format datetime to locale string (Indonesian)
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Format time only
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Get today's date as YYYY-MM-DD string in WIB timezone
 */
export function getTodayDate(): string {
  const wib = getWIBDate();
  const year = wib.getFullYear();
  const month = String(wib.getMonth() + 1).padStart(2, '0');
  const day = String(wib.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get yesterday's date as YYYY-MM-DD string in WIB timezone
 */
export function getYesterdayDate(): string {
  const wib = getWIBDate();
  wib.setDate(wib.getDate() - 1);
  const year = wib.getFullYear();
  const month = String(wib.getMonth() + 1).padStart(2, '0');
  const day = String(wib.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current day of week (0=Sunday, 6=Saturday) in WIB
 */
export function getTodayDayOfWeek(): number {
  return getWIBDate().getDay();
}

/**
 * Get start and end dates for the current week (Monday to Sunday)
 */
export function getCurrentWeekRange(): { start: string; end: string } {
  const wib = getWIBDate();
  const dayOfWeek = wib.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = start
  const start = new Date(wib);
  start.setDate(wib.getDate() - diff);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
  };
}

/**
 * Sanitize text input
 */
export function sanitizeInput(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}

/**
 * Validate file is an accepted image type and within size limit
 */
export function validateImageFile(
  file: File,
  maxSize: number,
  acceptedTypes: string[]
): { valid: boolean; error?: string } {
  if (!acceptedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not supported. Accepted: ${acceptedTypes.join(', ')}`,
    };
  }

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `File size exceeds ${maxMB}MB limit.`,
    };
  }

  return { valid: true };
}

/**
 * Generate a unique file name for storage
 */
export function generateFileName(userId: string, originalName: string): string {
  const ext = originalName.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  return `${userId}/${timestamp}.${ext}`;
}

/**
 * Classnames helper - merge Tailwind classes
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Convert array of objects to CSV
 */
export function objectsToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        const str = value === null || value === undefined ? '' : String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Get geolocation from browser
 */
export function getGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null); // Geolocation denied or failed
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  });
}
