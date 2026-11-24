/**
 * Zod'siz telefon yordamchilari: frontend bundle'iga yengil kiradi
 * (`@taklifnoma/shared/phone`).
 */

/**
 * O'zbekiston telefon raqamini +998XXXXXXXXX formatiga keltiradi.
 * Qabul qilinadi: "90 123 45 67", "901234567", "998901234567", "+998 (90) 123-45-67".
 * Noto'g'ri bo'lsa null qaytaradi.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let national: string;
  if (digits.length === 9) {
    national = digits;
  } else if (digits.length === 12 && digits.startsWith('998')) {
    national = digits.slice(3);
  } else {
    return null;
  }
  // Operator kodi 2 raqam; 0 bilan boshlanmaydi.
  if (national.startsWith('0')) return null;
  return `+998${national}`;
}

/** +998901234567 -> "+998 90 123 45 67" */
export function formatUzPhone(normalized: string): string {
  const m = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(normalized);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : normalized;
}
