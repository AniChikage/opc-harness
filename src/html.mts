export const escapeHTML = (value: unknown) => String(value ?? '').replace(
  /[&<>"']/g,
  x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x as '&' | '<' | '>' | '"' | "'"],
);
