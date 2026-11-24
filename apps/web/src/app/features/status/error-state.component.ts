import { ChangeDetectionStrategy, Component, DOCUMENT, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tk-error-state',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="status">
      <h1 class="status__title">{{ 'error.title' | transloco }}</h1>
      <p class="status__text">{{ 'error.text' | transloco }}</p>
      <button type="button" class="tk-btn" (click)="reload()">{{ 'error.retry' | transloco }}</button>
    </main>
  `,
  styleUrl: './status.scss',
})
export class ErrorStateComponent {
  private readonly document = inject(DOCUMENT);

  protected reload(): void {
    this.document.location.reload();
  }
}
