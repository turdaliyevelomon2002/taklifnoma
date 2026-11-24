import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Vaqtinchalik bosh sahifa. To'liq landing keyingi bosqichlarda. */
@Component({
  selector: 'tk-home-page',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="home">
      <h1>{{ 'home.title' | transloco }}</h1>
      <p>{{ 'home.subtitle' | transloco }}</p>
    </main>
  `,
  styles: `
    .home {
      display: grid;
      place-content: center;
      min-height: 100svh;
      padding: 2rem 1.25rem;
      text-align: center;
    }
    h1 { margin: 0 0 0.75rem; font-size: clamp(1.75rem, 6vw, 2.5rem); }
    p { margin: 0 auto; max-width: 30rem; color: var(--tk-muted); }
  `,
})
export class HomePage {}
