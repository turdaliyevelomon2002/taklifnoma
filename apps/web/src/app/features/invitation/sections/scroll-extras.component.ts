import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Sahifa "bezaklari": tepadagi o'qish progressi va pastdagi suzuvchi "Javob berish" tugmasi.
 * Tugma bosh qismdan keyin chiqadi va RSVP bo'limi ko'ringanda yashirinadi. Faqat brauzerda ishlaydi.
 */
@Component({
  selector: 'tk-scroll-extras',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progress" aria-hidden="true" [style.transform]="'scaleX(' + progress() + ')'"></div>
    @if (rsvp()) {
      <a class="cta" href="#rsvp" [class.cta--visible]="ctaVisible()" [attr.tabindex]="ctaVisible() ? null : -1"
        [attr.aria-hidden]="!ctaVisible()" (click)="goToRsvp($event)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
        </svg>
        {{ 'invitation.cta.rsvp' | transloco }}
      </a>
    }
  `,
  styles: `
    .progress {
      position: fixed;
      inset: 0 0 auto;
      z-index: 95;
      height: 3px;
      background: linear-gradient(90deg, var(--tk-accent), var(--tk-primary));
      transform-origin: left;
      transform: scaleX(0);
      pointer-events: none;
    }
    .cta {
      position: fixed;
      left: 50%;
      bottom: max(1.1rem, env(safe-area-inset-bottom));
      z-index: 49;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.8rem 1.35rem;
      border-radius: 999px;
      background: var(--tk-primary);
      color: var(--tk-primary-contrast);
      font-family: var(--tk-font-body);
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-decoration: none;
      white-space: nowrap;
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--tk-primary) 18%, transparent),
        0 14px 30px -10px color-mix(in srgb, var(--tk-primary) 80%, #000);
      opacity: 0;
      pointer-events: none;
      transform: translate(-50%, 150%);
      transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15);
    }
    .cta--visible { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
    @media (prefers-reduced-motion: reduce) { .cta { transition: opacity 0.2s ease; } }
  `,
})
export class ScrollExtrasComponent {
  /** RSVP bo'limi bormi (paketda yoqilganmi). */
  readonly rsvp = input(false);

  protected readonly progress = signal(0);
  protected readonly ctaVisible = signal(false);

  private readonly document = inject(DOCUMENT);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const win = this.document.defaultView;
      if (!win) return;
      let rsvpInView = false;
      let frame = 0;

      const update = (): void => {
        frame = 0;
        const el = this.document.documentElement;
        const max = el.scrollHeight - win.innerHeight;
        const y = win.scrollY;
        this.progress.set(max > 0 ? Math.min(1, y / max) : 0);
        this.ctaVisible.set(y > win.innerHeight * 0.9 && !rsvpInView);
      };
      const onScroll = (): void => {
        if (!frame) frame = win.requestAnimationFrame(update);
      };
      win.addEventListener('scroll', onScroll, { passive: true });

      // RSVP bo'limi @defer bilan keyin paydo bo'ladi, lekin #rsvp section o'zi darhol bor.
      let observer: IntersectionObserver | undefined;
      const target = this.document.getElementById('rsvp');
      if (target && 'IntersectionObserver' in win) {
        observer = new IntersectionObserver(
          ([entry]) => {
            rsvpInView = !!entry?.isIntersecting;
            update();
          },
          { rootMargin: '0px 0px -30% 0px' },
        );
        observer.observe(target);
      }
      update();

      destroyRef.onDestroy(() => {
        win.removeEventListener('scroll', onScroll);
        if (frame) win.cancelAnimationFrame(frame);
        observer?.disconnect();
      });
    });
  }

  protected goToRsvp(event: Event): void {
    const target = this.document.getElementById('rsvp');
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
