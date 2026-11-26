import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CreateInvitationResult } from '@taklifnoma/shared';
import { LangService } from '../../core/i18n/lang.service';
import { CredentialsCardComponent } from './credentials-card.component';
import { InvitationEditorComponent } from './editor/invitation-editor.component';
import type { HasUnsavedChanges } from './editor/unsaved-changes.guard';

@Component({
  selector: 'tk-panel-new',
  imports: [RouterLink, TranslocoPipe, InvitationEditorComponent, CredentialsCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      @if (result(); as r) {
        <div class="page__head">
          <h1 class="page__title">✓ {{ 'panel.new.created' | transloco }}</h1>
        </div>
        <p class="muted">{{ 'panel.new.nextSteps' | transloco }}</p>
        <tk-credentials-card [credentials]="r.access" [messageText]="shareText(r)" />
        <div class="actions">
          <a class="btn btn--primary" [routerLink]="['/panel/i', r.invitation.id]" [queryParams]="{ tab: 'media' }">
            {{ 'panel.new.toMedia' | transloco }}
          </a>
          <a class="btn" [routerLink]="['/panel/i', r.invitation.id]">{{ 'panel.new.toDetail' | transloco }}</a>
        </div>
      } @else {
        <div class="page__head">
          <h1 class="page__title">{{ 'panel.new.title' | transloco }}</h1>
        </div>
        <tk-invitation-editor (created)="onCreated($event)" />
      }
    </div>
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
  `,
})
export class PanelNewPage implements HasUnsavedChanges {
  private readonly editor = viewChild(InvitationEditorComponent);

  hasUnsavedChanges(): boolean {
    return !this.result() && (this.editor()?.dirty() ?? false);
  }

  private readonly i18n = inject(LangService);
  protected readonly result = signal<CreateInvitationResult | null>(null);

  protected onCreated(result: CreateInvitationResult): void {
    this.result.set(result);
    window.scrollTo({ top: 0 });
  }

  protected shareText(r: CreateInvitationResult): string {
    return this.i18n.translate('panel.access.shareMessage', {
      names: r.invitation.coupleNames,
      url: r.invitation.publicUrl,
      adminUrl: r.access.adminUrl,
      pin: r.access.pin,
    });
  }
}
