import DOMPurify from 'dompurify';

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Membersihkan input teks polos agar bebas dari tag HTML, event handler,
 * karakter kontrol, atau skema berbahaya sebelum disimpan/ditampilkan.
 */
export function sanitizeText(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  const cleanedControl = input.replace(CONTROL_CHARS_RE, '');
  // Strip semua tag HTML dengan DOMPurify (ALLOWED_TAGS: []) dan decode tidak disisipkan sebagai HTML
  const stripped = DOMPurify.sanitize(cleanedControl, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
  return stripped.trim().slice(0, maxLength);
}

/**
 * Menyisipkan HTML yang sudah disanitasi secara aman ke elemen DOM,
 * menggunakan native Sanitizer API jika tersedia dan DOMPurify sebagai fallback.
 */
export function safeSetHTML(el: HTMLElement, rawHtml: string): void {
  const elements = ['p', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'br'];
  const attributes = ['class'];

  const nativeEl = el as HTMLElement & {
    setHTML?: (html: string, opts?: { sanitizer?: unknown }) => void;
  };

  if (typeof nativeEl.setHTML === 'function') {
    nativeEl.setHTML(rawHtml, { sanitizer: { elements, attributes } });
    return;
  }

  el.innerHTML = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [...elements, '#text'],
    ALLOWED_ATTR: attributes,
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });
}
