import { computed, Injectable, signal } from '@angular/core';

/**
 * Formaning xatolari: path ("config.events.0.startsAt") -> i18n kaliti.
 * Ham mijoz tomonidagi Zod tekshiruvi, ham server qaytargan VALIDATION_ERROR shu yerga yoziladi.
 */
@Injectable()
export class FormErrors {
  readonly map = signal<ReadonlyMap<string, string>>(new Map());
  readonly count = computed(() => this.map().size);

  set(map: ReadonlyMap<string, string>): void {
    this.map.set(map);
  }

  clear(): void {
    this.map.set(new Map());
  }

  /** Aniq path yoki uning ichidagi birinchi xato (masalan, "...location" -> "...location.lat"). */
  find(path: string): string | null {
    const map = this.map();
    if (map.has(path)) return map.get(path)!;
    for (const [key, value] of map) if (key.startsWith(`${path}.`)) return value;
    return null;
  }
}
