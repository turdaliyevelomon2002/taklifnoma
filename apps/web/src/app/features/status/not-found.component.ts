import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tk-not-found',
  imports: [TranslocoPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="status">
      <p class="status__code">404</p>
      <h1 class="status__title">{{ 'notFound.title' | transloco }}</h1>
      <p class="status__text">{{ 'notFound.text' | transloco }}</p>
      <a class="tk-btn" routerLink="/">{{ 'notFound.back' | transloco }}</a>
    </main>
  `,
  styleUrl: './status.scss',
})
export class NotFoundComponent {}
