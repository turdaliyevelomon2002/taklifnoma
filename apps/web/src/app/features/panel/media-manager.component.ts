import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { InvitationDetail, MediaKindParam, MediaView } from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,.mp3,.m4a';

/** Muqova, galereya va musiqa. Rasmlar serverda webp variantlarga aylantiriladi. */
@Component({
  selector: 'tk-media-manager',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-manager.component.html',
  styleUrl: './media-manager.component.scss',
})
export class MediaManagerComponent {
  readonly invitation = input.required<InvitationDetail>();
  /** Media o'zgardi: ota sahifa detail'ni qayta yuklaydi. */
  readonly changed = output<void>();

  private readonly api = inject(OwnerApi);
  protected readonly imageAccept = IMAGE_ACCEPT;
  protected readonly audioAccept = AUDIO_ACCEPT;

  /** Yuklanayotgan bo'lim: 'cover' | 'gallery' | 'music' | 'og-image'. */
  protected readonly busy = signal<MediaKindParam | null>(null);
  protected readonly progress = signal<{ done: number; total: number } | null>(null);
  protected readonly error = signal<string | null>(null);
  /** Lokal holat: tartib o'zgartirilganda darhol ko'rinadi. */
  private readonly galleryOverride = signal<MediaView[] | null>(null);

  protected readonly cover = computed(() => this.byKind('COVER')[0] ?? null);
  protected readonly ogImage = computed(() => this.byKind('OG_IMAGE')[0] ?? null);
  protected readonly music = computed(() => this.byKind('MUSIC')[0] ?? null);
  protected readonly gallery = computed(
    () => this.galleryOverride() ?? this.byKind('GALLERY').sort((a, b) => a.sortOrder - b.sortOrder),
  );
  protected readonly features = computed(() => this.invitation().features);
  protected readonly galleryLeft = computed(() => Math.max(0, this.features().galleryLimit - this.gallery().length));

  private byKind(kind: MediaView['kind']): MediaView[] {
    return this.invitation().media.filter((m) => m.kind === kind);
  }

  protected async upload(kind: MediaKindParam, input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    const list = kind === 'gallery' ? files.slice(0, this.galleryLeft()) : files.slice(0, 1);

    this.error.set(null);
    this.busy.set(kind);
    this.progress.set({ done: 0, total: list.length });
    try {
      // Ketma-ket: server rasmni qayta ishlaydi (sharp), parallel yuklash uni bo'g'ib qo'yadi.
      for (const file of list) {
        await this.api.uploadMedia(this.invitation().id, kind, file);
        this.progress.update((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (kind === 'gallery' && files.length > list.length) this.error.set('errors.GALLERY_LIMIT_REACHED');
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    } finally {
      this.busy.set(null);
      this.progress.set(null);
      this.galleryOverride.set(null);
      this.changed.emit();
    }
  }

  protected async remove(media: MediaView): Promise<void> {
    this.error.set(null);
    try {
      await this.api.deleteMedia(this.invitation().id, media.id);
      this.galleryOverride.set(null);
      this.changed.emit();
    } catch (err) {
      this.error.set(errorKey(toApiError(err).code));
    }
  }

  protected async move(index: number, delta: number): Promise<void> {
    const list = [...this.gallery()];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    this.galleryOverride.set(list);
    try {
      await this.api.reorderGallery(this.invitation().id, list.map((m) => m.id));
      this.changed.emit();
    } catch (err) {
      this.galleryOverride.set(null);
      this.error.set(errorKey(toApiError(err).code));
    }
  }
}
