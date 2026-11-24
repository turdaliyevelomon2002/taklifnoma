import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Bo'limlar orasidagi bezak chizig'i (rang: currentColor). */
@Component({
  selector: 'tk-ornament',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 240 24" width="200" height="20" fill="none" stroke="currentColor" stroke-width="1">
      <path d="M0 12h92M148 12h92" />
      <path d="M120 3c4 4 4 14 0 18c-4-4-4-14 0-18z" fill="currentColor" fill-opacity=".15" />
      <path d="M104 12c5-6 11-6 16 0c5 6 11 6 16 0" />
      <path d="M104 12c5 6 11 6 16 0c5-6 11-6 16 0" />
      <circle cx="96" cy="12" r="2" fill="currentColor" />
      <circle cx="144" cy="12" r="2" fill="currentColor" />
    </svg>
  `,
  styles: `
    :host { display: flex; justify-content: center; color: var(--tk-accent); margin-block: 1.5rem; }
  `,
})
export class OrnamentComponent {}
