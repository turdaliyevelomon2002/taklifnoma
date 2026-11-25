import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalizePipe } from '../../../../core/i18n/localize.pipe';
import { EventDatePipe } from '../../../../shared/date/event-date.pipe';
import { CountdownComponent } from '../../sections/countdown.component';
import { EventCardComponent } from '../../sections/event-card.component';
import { GalleryComponent } from '../../sections/gallery.component';
import { LangSwitchComponent } from '../../sections/lang-switch.component';
import { MusicToggleComponent } from '../../sections/music-toggle.component';
import { ScrollExtrasComponent } from '../../sections/scroll-extras.component';
import { RsvpFormComponent } from '../../sections/rsvp-form/rsvp-form.component';
import { VenueMapComponent } from '../../sections/venue-map.component';
import { WishesComponent } from '../../sections/wishes.component';
import { InvitationTemplateBase } from '../template-base';

/**
 * "Milliy naqsh": lojuvard (lapis) fon ustida sakkiz qirrali yulduzli girih naqshi,
 * oltin hoshiyalar, mehrob shaklidagi ravoq. Naqsh to'liq CSS/SVG: rasm yuklanmaydi.
 */
@Component({
  selector: 'tk-national-pattern',
  imports: [
    TranslocoPipe,
    LocalizePipe,
    EventDatePipe,
    CountdownComponent,
    EventCardComponent,
    GalleryComponent,
    LangSwitchComponent,
    MusicToggleComponent,
    RsvpFormComponent,
    ScrollExtrasComponent,
    VenueMapComponent,
    WishesComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './national-pattern.template.html',
  styleUrl: './national-pattern.template.scss',
})
export class NationalPatternTemplate extends InvitationTemplateBase {}
