import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon.component';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  /** i18n kaliti. */
  key: string;
  params?: Record<string, unknown>;
}

/** Qisqa bildirishnomalar ("Saqlandi", "Nusxalandi"). Matnlar faqat i18n kalitlari orqali. */
@Injectable({ providedIn: 'root' })
export class PanelToasts {
  private seq = 0;
  readonly items = signal<Toast[]>([]);

  success(key: string, params?: Record<string, unknown>): void {
    this.push('success', key, params);
  }

  error(key: string, params?: Record<string, unknown>): void {
    this.push('error', key, params);
  }

  info(key: string, params?: Record<string, unknown>): void {
    this.push('info', key, params);
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, key: string, params?: Record<string, unknown>): void {
    const id = ++this.seq;
    // Bir vaqtda ko'pi bilan 3 ta: eski xabarlar ekranni to'sib qo'ymasin.
    this.items.update((list) => [...list.slice(-2), { id, kind, key, params }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
  }
}

@Component({
  selector: 'tk-toast-outlet',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" aria-live="polite" role="status">
      @for (t of toasts.items(); track t.id) {
        <div class="toast toast--{{ t.kind }}">
          <tk-icon [name]="t.kind === 'success' ? 'circle-check' : t.kind === 'error' ? 'alert-triangle' : 'info'" class="toast__icon" />
          <span class="toast__text">{{ t.key | transloco: t.params }}</span>
          <button type="button" class="toast__close" (click)="toasts.dismiss(t.id)" [attr.aria-label]="'panel.shell.close' | transloco">
            <tk-icon name="x" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastOutletComponent {
  protected readonly toasts = inject(PanelToasts);
}
