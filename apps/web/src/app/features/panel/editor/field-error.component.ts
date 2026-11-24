import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FormErrors } from './form-errors';

@Component({
  selector: 'tk-field-error',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as key) {
      <p class="field-error" role="alert">{{ key | transloco }}</p>
    }
  `,
  styles: `
    .field-error { margin: 0.25rem 0 0; font-size: 0.8rem; color: #b3261e; }
  `,
})
export class FieldErrorComponent {
  readonly path = input.required<string>();
  /** true: faqat shu path'ning o'zi (ichki maydonlar o'z joyida ko'rsatiladi). */
  readonly exact = input(false);
  private readonly errors = inject(FormErrors);
  protected readonly message = computed(() =>
    this.exact() ? (this.errors.map().get(this.path()) ?? null) : this.errors.find(this.path()),
  );
}
