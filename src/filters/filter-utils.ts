/**
 * Utility functions for filter operations
 */

/**
 * Generate a unique ID for filters and filter groups
 */
export function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse a smart date string into a timestamp
 * Supports:
 * - ISO dates: "2024-01-01", "2024-01-01T10:30:00"
 * - Relative: "today", "yesterday", "7 days ago", "-7d", "+3d"
 * - Natural: "this week", "this month", "last week"
 */
export function parseSmartDate(dateStr: string): number | null {
  if (!dateStr || dateStr.trim() === "") {
    return null;
  }

  const str = dateStr.trim().toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Presets
  if (str === "today") {
    return today.getTime();
  }
  if (str === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.getTime();
  }
  if (str === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getTime();
  }

  // This week (start of week - Monday)
  if (str === "this week") {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(today);
    monday.setDate(diff);
    return monday.getTime();
  }

  // This month (start of month)
  if (str === "this month") {
    return new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  }

  // Last week
  if (str === "last week") {
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return lastWeek.getTime();
  }

  // Last month
  if (str === "last month") {
    return new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
  }

  // Relative days: "7 days ago", "-7d", "+3d", "3d"
  const daysAgoMatch = str.match(/^(\d+)\s*days?\s*ago$/);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return date.getTime();
  }

  const relativeDaysMatch = str.match(/^([+-]?)(\d+)d$/);
  if (relativeDaysMatch) {
    const sign = relativeDaysMatch[1] === "+" ? 1 : -1;
    const days = parseInt(relativeDaysMatch[2], 10);
    const date = new Date(today);
    date.setDate(date.getDate() + sign * days);
    return date.getTime();
  }

  // Try parsing as ISO date
  const parsedDate = new Date(dateStr);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  return null;
}

/**
 * Format a timestamp as a readable date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

/**
 * Match a path against a wildcard pattern
 * Supports:
 * - * matches anything except /
 * - ** matches anything including /
 * - ? matches single character
 */
export function matchWildcard(path: string, pattern: string): boolean {
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<DOUBLESTAR>>>/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\./g, "\\.");

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Convert bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Parse a file size string (e.g., "1.5 MB") to bytes
 */
export function parseFileSize(sizeStr: string): number | null {
  if (!sizeStr || sizeStr.trim() === "") {
    return null;
  }

  const match = sizeStr.trim().match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!match) {
    return null;
  }

  const value = parseFloat(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Check if a value is a valid number
 */
export function isValidNumber(value: any): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && isFinite(num);
}

/**
 * Normalize a tag (remove # prefix, lowercase)
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().replace(/^#/, "");
}

/**
 * Compare dates for "on same day" check
 */
export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get age in days from a timestamp
 */
export function getAgeInDays(timestamp: number): number {
  const now = Date.now();
  const ageMs = now - timestamp;
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}
