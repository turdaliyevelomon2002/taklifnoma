import { ChangeDetectionStrategy, Component } from '@angular/core';
import { injectResponse } from '../../core/http/response-status';
import { NotFoundComponent } from './not-found.component';

/** Noma'lum yo'llar uchun: SSR'da haqiqiy 404 status qaytaradi. */
@Component({
  selector: 'tk-not-found-page',
  imports: [NotFoundComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tk-not-found />`,
})
export class NotFoundPage {
  constructor() {
    injectResponse()(404);
  }
}
