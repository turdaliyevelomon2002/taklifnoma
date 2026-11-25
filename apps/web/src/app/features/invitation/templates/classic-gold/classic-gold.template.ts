import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalizePipe } from '../../../../core/i18n/localize.pipe';
import { CountdownComponent } from '../../sections/countdown.component';
import { EventCardComponent } from '../../sections/event-card.component';
import { GalleryComponent } from '../../sections/gallery.component';
import { LangSwitchComponent } from '../../sections/lang-switch.component';
import { MusicToggleComponent } from '../../sections/music-toggle.component';
import { OrnamentComponent } from '../../sections/ornament.component';
import { ScrollExtrasComponent } from '../../sections/scroll-extras.component';
import { RsvpFormComponent } from '../../sections/rsvp-form/rsvp-form.component';
import { VenueMapComponent } from '../../sections/venue-map.component';
import { WishesComponent } from '../../sections/wishes.component';
import { EventDatePipe } from '../../../../shared/date/event-date.pipe';
import { InvitationTemplateBase } from '../template-base';

/**
 * "Klassik oltin": fil suyagi foni, oltin bezaklar, kalligrafik ismlar, arka shaklidagi rasm.
 * Kirish ekrani: muhrli konvert ochilishi.
 */
@Component({
  selector: 'tk-classic-gold',
  imports: [
    TranslocoPipe,
    LocalizePipe,
    EventDatePipe,
    CountdownComponent,
    EventCardComponent,
    GalleryComponent,
    LangSwitchComponent,
    MusicToggleComponent,
    OrnamentComponent,
    RsvpFormComponent,
    ScrollExtrasComponent,
    VenueMapComponent,
    WishesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classic-gold.template.html',
  styleUrl: './classic-gold.template.scss',
})
export class ClassicGoldTemplate extends InvitationTemplateBase {
  /** Fonda sekin suzib yuruvchi oltin uchqunlar. */
  protected readonly sparkles = Array.from({ length: 14 }, (_, i) => ({
    '--x': `${(i * 37) % 100}%`,
    '--size': `${4 + (i % 4) * 2}px`,
    '--d': `${10 + ((i * 7) % 9)}s`,
    '--delay': `${-i * 1.3}s`,
  }));
}
