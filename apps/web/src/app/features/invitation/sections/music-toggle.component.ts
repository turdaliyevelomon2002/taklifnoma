import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MusicPlayer } from '../music-player.service';

/** Ekran burchagidagi musiqa yoqish/o'chirish tugmasi. */
@Component({
  selector: 'tk-music-toggle',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="music"
      [class.music--playing]="player.playing()"
      [attr.aria-pressed]="player.playing()"
      [attr.aria-label]="(player.playing() ? 'invitation.music.pause' : 'invitation.music.play') | transloco"
      (click)="player.toggle(src())"
    >
      @if (player.playing()) {
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <rect x="4" y="10" width="3" height="10" rx="1" class="bar bar--1" />
          <rect x="10.5" y="4" width="3" height="16" rx="1" class="bar bar--2" />
          <rect x="17" y="7" width="3" height="13" rx="1" class="bar bar--3" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
        </svg>
      }
    </button>
  `,
  styles: `
    .music {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right));
      bottom: max(1rem, env(safe-area-inset-bottom));
      z-index: 50;
      display: grid;
      place-items: center;
      width: 3.25rem;
      height: 3.25rem;
      border: 1px solid var(--tk-border);
      border-radius: 50%;
      background: var(--tk-surface);
      color: var(--tk-primary);
      box-shadow: var(--tk-shadow);
      cursor: pointer;
    }
    .bar { transform-origin: bottom; animation: eq 0.9s ease-in-out infinite alternate; }
    .bar--2 { animation-delay: 0.2s; }
    .bar--3 { animation-delay: 0.4s; }
    @keyframes eq { from { transform: scaleY(0.35); } to { transform: scaleY(1); } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
  `,
})
export class MusicToggleComponent {
  readonly src = input.required<string>();
  protected readonly player = inject(MusicPlayer);
}
