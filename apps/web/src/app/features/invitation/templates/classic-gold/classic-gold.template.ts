import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalizePipe } from '../../../../core/i18n/localize.pipe';
import { CountdownComponent } from '../../sections/countdown.component';
import { EventCardComponent } from '../../sections/event-card.component';
import { GalleryComponent } from '../../sections/gallery.component';
import { LangSwitchComponent } from '../../sections/lang-switch.component';
import { MusicToggleComponent } from '../../sections/music-toggle.component';
import { OrnamentComponent } from '../../sections/ornament.component';
import { RsvpFormComponent } from '../../sections/rsvp-form/rsvp-form.component';
import { VenueMapComponent } from '../../sections/venue-map.component';
import { WishesComponent } from '../../sections/wishes.component';
import { EventDatePipe } from '../../../../shared/date/event-date.pipe';
import { InvitationTemplateBase } from '../template-base';

/** "Klassik oltin": fil suyagi foni, oltin bezaklar, kalligrafik ismlar, arka shaklidagi rasm. */
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
    VenueMapComponent,
    WishesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classic-gold.template.html',
  styleUrl: './classic-gold.template.scss',
})
export class ClassicGoldTemplate extends InvitationTemplateBase {}
