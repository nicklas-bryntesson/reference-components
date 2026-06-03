// Shared locale resolution for the field components (DateField, DateTimeField,
// TimeField). Keeps all three on one pattern: read the requested locale from the
// element, then resolve it to a translation key by exact match → base language
// (e.g. "sv-SE" → "sv") → fallback.

/** Read the requested locale: data-locale → <html lang> → fallback. */
export function readLocale(el: HTMLElement, fallback = 'en'): string {
  return el.dataset.locale || document.documentElement.lang || fallback
}

/**
 * Resolve `requested` to a key that exists in `available`:
 * exact match → base-language match → fallback.
 *
 * @example resolveLocale('sv-SE', { en, sv })  // → 'sv'
 * @example resolveLocale('fr',    { en, sv })  // → 'en'
 */
export function resolveLocale(
  requested: string,
  available: Record<string, unknown>,
  fallback = 'en',
): string {
  if (available[requested]) return requested
  const base = requested.split('-')[0]
  if (base !== requested && available[base]) return base
  return fallback
}
