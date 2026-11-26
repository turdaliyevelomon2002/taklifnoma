import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon.component';

export interface ConfirmOptions {
  /** i18n kalitlari */
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  params?: Record<string, unknown>;
}

@Component({
  selector: 'tk-confirm-dialog',
  imports: [TranslocoPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog__head confirm">
      <span class="confirm__icon" [class.confirm__icon--danger]="data.danger"><tk-icon name="alert-triangle" /></span>
      <h2>{{ data.title | transloco: data.params }}</h2>
      @if (data.message) {
        <p>{{ data.message | transloco: data.params }}</p>
      }
    </div>
    <div class="dialog__foot">
      <button type="button" class="btn" (click)="ref.close(false)" cdkFocusInitial>
        {{ (data.cancel ?? 'admin.guests.cancel') | transloco }}
      </button>
      <button type="button" class="btn" [class.btn--danger-solid]="data.danger" [class.btn--primary]="!data.danger" (click)="ref.close(true)">
        {{ data.confirm | transloco }}
      </button>
    </div>
  `,
  styles: `
    .confirm { padding-bottom: 0.25rem; }
    .confirm__icon {
      display: grid; place-items: center; width: 2.5rem; height: 2.5rem; margin-bottom: 0.25rem; border-radius: 50%;
      background: color-mix(in oklch, var(--warning) 16%, transparent); color: var(--warning); --icon-size: 1.2rem;
    }
    .confirm__icon--danger { background: color-mix(in oklch, var(--destructive) 14%, transparent); color: var(--destructive); }
  `,
})
export class ConfirmDialogComponent {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<ConfirmOptions>(DIALOG_DATA);
}

/** Brauzerning confirm() o'rniga: panel uslubida, i18n bilan, klaviatura bilan boshqariladi. */
@Injectable({ providedIn: 'root' })
export class PanelConfirm {
  private readonly dialog = inject(Dialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<boolean, ConfirmOptions>(ConfirmDialogComponent, {
      data: options,
      panelClass: 'tk-dialog',
      backdropClass: 'tk-dialog-backdrop',
      role: 'alertdialog',
    });
    return (await firstValueFrom(ref.closed)) === true;
  }
}
