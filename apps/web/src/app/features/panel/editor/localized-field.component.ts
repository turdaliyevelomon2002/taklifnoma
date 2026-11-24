import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { FieldErrorComponent } from './field-error.component';
import type { LocalizedGroup } from './invitation-form.model';

let nextId = 0;

/** Ikki tilli matn maydoni: o'zbekcha (asosiy) va ruscha (rus tili yoqilgan bo'lsa). */
@Component({
  selector: 'tk-localized-field',
  imports: [ReactiveFormsModule, TranslocoPipe, FieldErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="lf" [formGroup]="group()">
      <legend class="lf__label">
        {{ label() | transloco }}
        @if (optional()) {
          <span class="lf__optional">{{ 'panel.form.optional' | transloco }}</span>
        }
      </legend>
      <div class="lf__inputs" [class.lf__inputs--two]="showRu()">
        <label class="lf__lang">
          <span class="lf__tag">UZ</span>
          @if (multiline()) {
            <textarea class="input input--area" formControlName="uz" [attr.maxlength]="maxlength()" [attr.id]="id + '-uz'" rows="3"></textarea>
          } @else {
            <input class="input" formControlName="uz" [attr.maxlength]="maxlength()" [attr.id]="id + '-uz'" />
          }
        </label>
        @if (showRu()) {
          <label class="lf__lang">
            <span class="lf__tag">RU</span>
            @if (multiline()) {
              <textarea class="input input--area" formControlName="ru" [attr.maxlength]="maxlength()" rows="3"></textarea>
            } @else {
              <input class="input" formControlName="ru" [attr.maxlength]="maxlength()" />
            }
          </label>
        }
      </div>
      <tk-field-error [path]="path()" />
    </fieldset>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .lf { margin: 0; padding: 0; border: 0; min-width: 0; }
    .lf__label { padding: 0; margin-bottom: 0.3rem; font-size: 0.85rem; font-weight: 600; }
    .lf__optional { margin-left: 0.35rem; font-weight: 400; color: var(--tk-muted); font-size: 0.75rem; }
    .lf__inputs { display: grid; gap: 0.4rem; }
    @media (min-width: 720px) { .lf__inputs--two { grid-template-columns: 1fr 1fr; } }
    .lf__lang { position: relative; display: block; }
    .lf__tag {
      position: absolute; top: 0.55rem; right: 0.55rem;
      font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
      color: var(--tk-muted); pointer-events: none;
    }
  `,
})
export class LocalizedFieldComponent {
  readonly group = input.required<LocalizedGroup>();
  readonly label = input.required<string>();
  /** Xato xaritasidagi path (masalan, "config.couple.groom.firstName"). */
  readonly path = input.required<string>();
  readonly showRu = input(true);
  readonly multiline = input(false);
  readonly optional = input(false);
  readonly maxlength = input<number | null>(null);

  protected readonly id = `lf-${nextId++}`;
}
