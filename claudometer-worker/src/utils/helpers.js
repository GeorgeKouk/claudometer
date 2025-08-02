/**
 * General utility helper functions
 * Common utilities used across the application
 */

/**
 * Converts a date string to a human-readable "time ago" format
 * @param {string} dateString - ISO date string or date parseable by Date constructor
 * @returns {string} Human-readable time difference (e.g., "2h ago", "5d ago")
 */
export function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

/**
 * Truncates combined title and content text to a specified length
 * @param {string} title - Post or comment title
 * @param {string} content - Post or comment content/body
 * @returns {string} Truncated text with ellipsis if needed
 */
export function getTruncatedText(title, content) {
  const text = `${title || ''} ${content || ''}`.trim();
  return text.length > 500 ? text.substring(0, 500) + '...' : text;
}