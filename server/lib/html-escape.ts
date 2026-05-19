/**
 * HTML escape utilities for safely interpolating user-supplied content into
 * outbound HTML email bodies. The support pipeline accepts arbitrary input
 * (ticket subject/description, external requester names, etc.) — anything that
 * lands in an HTML template MUST be escaped before interpolation.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ENTITY_MAP[ch] || ch);
}

/** Escape HTML AND convert newlines to <br>, for multi-line user content. */
export function escapeHtmlMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}
