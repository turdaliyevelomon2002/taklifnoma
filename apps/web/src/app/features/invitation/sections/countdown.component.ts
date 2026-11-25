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
import { TickDirective } from './tick.directive';
import { LangService } from '../../../core/i18n/lang.service';

const DAY = 86_400_000;

interface Unit {
  key: 'days' | 'hours' | 'minutes' | 'seconds';
  value: number;
}

/** To'ygacha qolgan vaqt. Server vaqti bilan render qilinadi, brauzerda har soniyada yangilanadi. */
@Component({
  selector: 'tk-countdown',
  imports: [TranslocoPipe, TickDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('upcoming') {
        <div class="countdown" role="timer" aria-live="off">
          @for (unit of units(); track unit.key; let last = $last) {
            <div class="cell">
              <span class="cell__value">
                <span class="cell__digit" [tkTick]="unit.value">{{ pad(unit.value) }}</span>
              </span>
              <span class="cell__label">{{
                i18n.pluralKey('invitation.countdown.' + unit.key, unit.value) | transloco
              }}</span>
            </div>
            @if (!last) {
              <span class="sep" aria-hidden="true">:</span>
            }
          }
        </div>
      }
      @case ('today') {
        <p class="message"><span aria-hidden="true">✦</span> {{ 'invitation.countdown.today' | transloco }} <span aria-hidden="true">✦</span></p>
      }
      @case ('passed') {
        <p class="message">{{ 'invitation.countdown.passed' | transloco }}</p>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .countdown {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      gap: clamp(0.25rem, 1.5vw, 0.6rem);
    }
    .cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      flex: 0 1 4.6rem;
      min-width: 0;
    }
    .cell__value {
      position: relative;
      display: grid;
      place-items: center;
      width: 100%;
      aspect-ratio: 1 / 1.08;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--tk-accent) 45%, transparent);
      border-radius: calc(var(--tk-radius) * 1.1);
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--tk-surface) 96%, #fff) 0 50%, var(--tk-surface) 50% 100%);
      box-shadow:
        0 1px 0 color-mix(in srgb, #fff 60%, transparent) inset,
        0 10px 24px -12px color-mix(in srgb, var(--tk-primary) 45%, transparent);
    }
    /* "Flip" kartaning o'rta chizig'i */
    .cell__value::after {
      content: '';
      position: absolute;
      inset: 50% 0 auto;
      height: 1px;
      background: color-mix(in srgb, var(--tk-accent) 25%, transparent);
    }
    .cell__digit {
      grid-area: 1 / 1;
      font-family: var(--tk-font-heading);
      font-size: clamp(1.55rem, 7.5vw, 2.3rem);
      font-weight: 600;
      line-height: 1;
      color: var(--tk-primary);
      font-variant-numeric: tabular-nums;
    }
    .cell__label {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--tk-muted);
    }
    .sep {
      align-self: center;
      margin-top: -1.6rem;
      font-family: var(--tk-font-heading);
      font-size: 1.5rem;
      color: var(--tk-accent);
      opacity: 0.7;
      animation: blink 1s steps(2, jump-none) infinite;
    }
    @keyframes blink { 50% { opacity: 0.2; } }
    .message {
      margin: 0;
      font-family: var(--tk-font-heading);
      font-size: 1.4rem;
      color: var(--tk-primary);
      text-align: center;
    }
    @media (prefers-reduced-motion: reduce) {
      .sep { animation: none; }
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

  protected pad(v: number): string {
    return v < 10 ? `0${v}` : String(v);
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.now.set(Date.now());
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      destroyRef.onDestroy(() => clearInterval(id));
    });
  }
}
