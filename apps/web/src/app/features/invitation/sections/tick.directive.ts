import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Qiymat o'zgarganda elementga qisqa "flip" animatsiyasi beradi (Web Animations API).
 * Birinchi render va prefers-reduced-motion holatida animatsiya qilinmaydi. Faqat brauzerda ishlaydi.
 *
 *   <span [tkTick]="seconds">{{ seconds }}</span>
 */
@Directive({ selector: '[tkTick]' })
export class TickDirective {
  readonly tkTick = input.required<unknown>();

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private previous: unknown = undefined;
  private initialized = false;

  constructor() {
    afterRenderEffect(() => {
      const value = this.tkTick();
      if (!this.initialized) {
        this.initialized = true;
        this.previous = value;
        return;
      }
      if (value === this.previous) return;
      this.previous = value;
      if (typeof this.el.animate !== 'function') return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.el.animate(
        [
          { opacity: 0, transform: 'translateY(-40%) rotateX(60deg)', filter: 'blur(2px)' },
          { opacity: 1, transform: 'none', filter: 'none' },
        ],
        { duration: 450, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    });
  }
}
