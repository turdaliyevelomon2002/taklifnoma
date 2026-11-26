import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '../ui/icon.component';

export interface DeleteDialogData {
  slug: string;
  names: string;
  replies: number;
}

/**
 * Taklifnomani butunlay o'chirish: qaytarib bo'lmaydi, shuning uchun slug'ni qo'lda yozish talab qilinadi.
 * Natija: true (tasdiqlandi). O'chirishning o'zini chaqiruvchi bajaradi.
 */
@Component({
  selector: 'tk-delete-dialog',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form (submit)="$event.preventDefault(); confirm()">
      <div class="dialog__head">
        <span class="del__icon"><tk-icon name="trash" /></span>
        <h2>{{ 'panel.delete.title' | transloco: { names: data.names } }}</h2>
        <p>{{ 'panel.delete.text' | transloco }}</p>
      </div>
      <div class="dialog__body">
        <ul class="del__list">
          <li>{{ 'panel.delete.itemPage' | transloco }}</li>
          <li>{{ 'panel.delete.itemGuests' | transloco: { count: data.replies } }}</li>
          <li>{{ 'panel.delete.itemMedia' | transloco }}</li>
        </ul>
        <label class="field">
          <span class="label">{{ 'panel.delete.typeSlug' | transloco: { slug: data.slug } }}</span>
          <input class="input" [value]="typed()" (input)="typed.set($any($event.target).value)" [placeholder]="data.slug"
            autocomplete="off" spellcheck="false" cdkFocusInitial />
        </label>
      </div>
      <div class="dialog__foot">
        <button type="button" class="btn" (click)="ref.close(false)">{{ 'admin.guests.cancel' | transloco }}</button>
        <button type="submit" class="btn btn--danger-solid" [disabled]="typed().trim() !== data.slug">
          <tk-icon name="trash" /> {{ 'panel.delete.confirm' | transloco }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .del__icon {
      display: grid; place-items: center; width: 2.5rem; height: 2.5rem; margin-bottom: 0.25rem; border-radius: 50%;
      background: color-mix(in oklch, var(--destructive) 14%, transparent); color: var(--destructive); --icon-size: 1.15rem;
    }
    .del__list {
      margin: 0 0 1rem; padding: 0.75rem 1rem 0.75rem 2rem; border-radius: calc(var(--radius) * 0.7);
      background: color-mix(in oklch, var(--destructive) 7%, transparent); color: var(--foreground); font-size: 0.82rem;
      line-height: 1.6;
    }
  `,
})
export class DeleteDialogComponent {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<DeleteDialogData>(DIALOG_DATA);
  protected readonly typed = signal('');

  protected confirm(): void {
    if (this.typed().trim() === this.data.slug) this.ref.close(true);
  }
}
