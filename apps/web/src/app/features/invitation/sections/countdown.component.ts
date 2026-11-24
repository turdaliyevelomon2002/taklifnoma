import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LangService } from '../../../core/i18n/lang.service';

const DAY = 86_400_000;

interface Unit {
  key: 'days' | 'hours' | 'minutes' | 'seconds';
  value: number;
}

/** To'ygacha qolgan vaqt. Server vaqti bilan render qilinadi, brauzerda har soniyada yangilanadi. */
@Component({
  selector: 'tk-countdown',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('upcoming') {
        <div class="countdown" role="timer" aria-live="off">
          @for (unit of units(); track unit.key) {
            <div class="countdown__cell">
              <span class="countdown__value">{{ unit.value }}</span>
              <span class="countdown__label">{{
                i18n.pluralKey('invitation.countdown.' + unit.key, unit.value) | transloco
              }}</span>
            </div>
          }
        </div>
      }
      @case ('today') {
        <p class="countdown__message">{{ 'invitation.countdown.today' | transloco }}</p>
      }
      @case ('passed') {
        <p class="countdown__message">{{ 'invitation.countdown.passed' | transloco }}</p>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .countdown {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.5rem;
      max-width: 22rem;
      margin-inline: auto;
    }
    .countdown__cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.75rem 0.25rem;
      border: 1px solid var(--tk-border);
      border-radius: var(--tk-radius);
      background: var(--tk-surface);
    }
    .countdown__value {
      font-family: var(--tk-font-heading);
      font-size: clamp(1.6rem, 7vw, 2.2rem);
      line-height: 1;
      color: var(--tk-primary);
      font-variant-numeric: tabular-nums;
    }
    .countdown__label {
      margin-top: 0.35rem;
      font-size: 0.75rem;
      letter-spacing: 0.04em;
      color: var(--tk-muted);
    }
    .countdown__message {
      font-family: var(--tk-font-heading);
      font-size: 1.35rem;
      color: var(--tk-primary);
      text-align: center;
    }
  `,
})
export class CountdownComponent {
  /** ISO sana (asosiy tadbir boshlanishi). */
  readonly target = input.required<string>();

  protected readonly i18n = inject(LangService);
  private readonly now = signal(Date.now());

  private readonly diff = computed(() => Date.parse(this.target()) - this.now());

  protected readonly state = computed<'upcoming' | 'today' | 'passed'>(() => {
    const d = this.diff();
    if (d > 0) return 'upcoming';
    return d > -DAY ? 'today' : 'passed';
  });

  protected readonly units = computed<Unit[]>(() => {
    const total = Math.max(0, Math.floor(this.diff() / 1000));
    return [
      { key: 'days', value: Math.floor(total / 86_400) },
      { key: 'hours', value: Math.floor((total % 86_400) / 3600) },
      { key: 'minutes', value: Math.floor((total % 3600) / 60) },
      { key: 'seconds', value: total % 60 },
    ];
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.now.set(Date.now());
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(id));
    });
  }
}
