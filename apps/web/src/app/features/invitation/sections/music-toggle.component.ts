import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { MusicPlayer } from '../music-player.service';

/** Ekran burchagidagi musiqa tugmasi: chalayotganda plastinka aylanadi va to'lqin chiqadi. */
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
      <span class="music__ring" aria-hidden="true"></span>
      <span class="music__disc" aria-hidden="true">
        <span class="music__label"></span>
      </span>
      <span class="music__state" aria-hidden="true">
        @if (player.playing()) {
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        } @else {
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
        }
      </span>
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
      width: 3.5rem;
      height: 3.5rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .music > * { grid-area: 1 / 1; }
    .music__disc {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background:
        repeating-radial-gradient(circle, #1b1b1b 0 1px, #262626 1px 3px),
        #1f1f1f;
      box-shadow:
        0 10px 25px -8px rgb(0 0 0 / 0.55),
        inset 0 0 0 2px color-mix(in srgb, var(--tk-accent) 70%, transparent);
      animation: spin 4s linear infinite;
      animation-play-state: paused;
    }
    .music__label {
      width: 38%;
      height: 38%;
      border-radius: 50%;
      background:
        radial-gradient(circle, #1f1f1f 0 14%, transparent 15%),
        conic-gradient(from 0deg, var(--tk-accent), var(--tk-primary), var(--tk-accent));
    }
    .music__state {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--tk-surface) 92%, transparent);
      color: var(--tk-primary);
      box-shadow: 0 2px 6px rgb(0 0 0 / 0.3);
      opacity: 0;
      transform: scale(0.6);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .music:not(.music--playing) .music__state,
    .music:hover .music__state,
    .music:focus-visible .music__state { opacity: 1; transform: scale(1); }
    .music--playing .music__disc { animation-play-state: running; }
    .music__ring {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid var(--tk-accent);
      opacity: 0;
    }
    .music--playing .music__ring { animation: ripple 2.2s ease-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes ripple {
      from { opacity: 0.6; transform: scale(1); }
      to { opacity: 0; transform: scale(1.7); }
    }
    @media (prefers-reduced-motion: reduce) {
      .music__disc, .music--playing .music__ring { animation: none; }
    }
  `,
})
export class MusicToggleComponent {
  readonly src = input.required<string>();
  protected readonly player = inject(MusicPlayer);
}
