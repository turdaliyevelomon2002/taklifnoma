import { DEFAULT_LOCALE, type Locale } from '@taklifnoma/shared';
import ru from './ru.json';
import uz from './uz.json';

/**
 * Server tomonidagi matnlar (Telegram xabarlari). Matnlar kodda emas, i18n/*.json da.
 * Kalit topilmasa o'zbekchasi, u ham bo'lmasa kalitning o'zi qaytadi.
 */
const DICTIONARIES: Record<Locale, unknown> = { uz, ru };

type Params = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function t(locale: Locale, key: string, params: Params = {}): string {
  const template =
    lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key) ?? key;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) =>
    name in params ? String(params[name]) : '',
  );
}

/** Telegram HTML rejimi uchun xavfsiz matn. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
