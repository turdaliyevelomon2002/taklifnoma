import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tk-panel-theme';
const ROOT_CLASS = 'tk-panel';

/**
 * Panel mavzusi. Tokenlar <html> darajasida (html.tk-panel / html.tk-panel.dark), chunki
 * CDK dialog va menyulari body oxiriga chiziladi va .panel ichida bo'lmaydi.
 * Panel qobig'i yo'q bo'lganda (mehmon sahifalari) klasslar olib tashlanadi.
 */
@Injectable()
export class PanelTheme {
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>(this.read());
  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly isDark = computed(() => (this.mode() === 'system' ? this.systemDark() : this.mode() === 'dark'));

  constructor() {
    const root = this.doc.documentElement;
    root.classList.add(ROOT_CLASS);

    const onChange = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
    this.media?.addEventListener('change', onChange);

    effect(() => root.classList.toggle('dark', this.isDark()));

    inject(DestroyRef).onDestroy(() => {
      this.media?.removeEventListener('change', onChange);
      root.classList.remove(ROOT_CLASS, 'dark');
    });
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* saqlanmasa ham bo'ladi */
    }
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      /* localStorage yo'q */
    }
    return 'system';
  }
}
