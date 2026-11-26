import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { InvitationDetail, MediaKindParam, MediaView } from '@taklifnoma/shared';
import { errorKey, toApiError } from '../../core/api/api-error';
import { OwnerApi } from '../../core/api/owner-api.service';
import { PanelConfirm } from './ui/confirm.service';
import { IconComponent } from './ui/icon.component';
import { PanelToasts } from './ui/toast.service';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';
const AUDIO_ACCEPT = 'audio/mpeg,audio/mp4,audio/aac,audio/ogg,.mp3,.m4a';

/** Sudrab tashlangan fayl turi mos kelmasa serverga yubormaymiz (server baribir tekshiradi). */
function matches(file: File, kind: MediaKindParam): boolean {
  if (kind === 'music') return file.type.startsWith('audio/') || /\.(mp3|m4a)$/i.test(file.name);
  return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Muqova, galereya, musiqa va OG rasm. Rasmlar serverda webp variantlarga aylantiriladi.
 * Fayllarni tanlash yoki sudrab tashlash mumkin; galereya tartibi sudrab o'zgartiriladi.
 */
@Component({
  selector: 'tk-media-manager',
  imports: [TranslocoPipe, IconComponent, CdkDropList, CdkDrag, CdkDragPlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-manager.component.html',
  styleUrl: './media-manager.component.scss',
})
export class MediaManagerComponent {
  readonly invitation = input.required<InvitationDetail>();
  /** Media o'zgardi: ota sahifa detail'ni qayta yuklaydi. */
  readonly changed = output<void>();

  private readonly api = inject(OwnerApi);
  private readonly confirm = inject(PanelConfirm);
  private readonly toasts = inject(PanelToasts);
  protected readonly imageAccept = IMAGE_ACCEPT;
  protected readonly audioAccept = AUDIO_ACCEPT;

  /** Yuklanayotgan bo'lim: 'cover' | 'gallery' | 'music' | 'og-image'. */
  protected readonly busy = signal<MediaKindParam | null>(null);
  protected readonly progress = signal<{ done: number; total: number } | null>(null);
  /** Ustiga fayl sudralayotgan zona. */
  protected readonly dragOver = signal<MediaKindParam | null>(null);
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
  protected readonly progressPercent = computed(() => {
    const p = this.progress();
    return p ? Math.round((p.done / p.total) * 100) : 0;
  });

  private byKind(kind: MediaView['kind']): MediaView[] {
    return this.invitation().media.filter((m) => m.kind === kind);
  }

  // --- Fayl tanlash / sudrab tashlash ---

  protected onPick(kind: MediaKindParam, input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.upload(kind, files);
  }

  protected onDragOver(kind: MediaKindParam, e: DragEvent): void {
    if (!e.dataTransfer?.types.includes('Files') || this.busy()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.dragOver.set(kind);
  }

  protected onDragLeave(kind: MediaKindParam, e: DragEvent): void {
    // Ichki elementlar ustidan o'tganda ham dragleave keladi: zonadan chiqqandagina o'chiramiz.
    const zone = e.currentTarget as HTMLElement;
    if (e.relatedTarget instanceof Node && zone.contains(e.relatedTarget)) return;
    if (this.dragOver() === kind) this.dragOver.set(null);
  }

  protected onDrop(kind: MediaKindParam, e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(null);
    if (this.busy()) return;
    void this.upload(kind, Array.from(e.dataTransfer?.files ?? []));
  }

  private async upload(kind: MediaKindParam, all: File[]): Promise<void> {
    const files = all.filter((f) => matches(f, kind));
    if (files.length < all.length) this.toasts.error('errors.UNSUPPORTED_FILE_TYPE');
    if (!files.length) return;
    const list = kind === 'gallery' ? files.slice(0, this.galleryLeft()) : files.slice(0, 1);
    if (!list.length) {
      this.toasts.error('errors.GALLERY_LIMIT_REACHED');
      return;
    }

    this.busy.set(kind);
    this.progress.set({ done: 0, total: list.length });
    let uploaded = 0;
    try {
      // Ketma-ket: server rasmni qayta ishlaydi (sharp), parallel yuklash uni bo'g'ib qo'yadi.
      for (const file of list) {
        await this.api.uploadMedia(this.invitation().id, kind, file);
        uploaded++;
        this.progress.update((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      if (kind === 'gallery' && files.length > list.length) this.toasts.error('errors.GALLERY_LIMIT_REACHED');
    } catch (err) {
      this.toasts.error(errorKey(toApiError(err).code));
    } finally {
      if (uploaded) this.toasts.success('panel.media.uploaded', { count: uploaded });
      this.busy.set(null);
      this.progress.set(null);
      this.galleryOverride.set(null);
      this.changed.emit();
    }
  }

  // --- O'chirish va tartib ---

  protected async remove(media: MediaView): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'panel.media.deleteTitle',
      message: 'panel.media.deleteText',
      confirm: 'panel.media.delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteMedia(this.invitation().id, media.id);
      this.galleryOverride.set(null);
      this.toasts.success('panel.media.deleted');
      this.changed.emit();
    } catch (err) {
      this.toasts.error(errorKey(toApiError(err).code));
    }
  }

  protected async drop(e: CdkDragDrop<MediaView[]>): Promise<void> {
    if (e.previousIndex === e.currentIndex) return;
    const list = [...this.gallery()];
    moveItemInArray(list, e.previousIndex, e.currentIndex);
    await this.saveOrder(list);
  }

  /** Klaviatura uchun (sudrash ishlatolmaydiganlar): chap/o'ng tugmalari. */
  protected async move(index: number, delta: number): Promise<void> {
    const target = index + delta;
    const list = [...this.gallery()];
    if (target < 0 || target >= list.length) return;
    moveItemInArray(list, index, target);
    await this.saveOrder(list);
  }

  private async saveOrder(list: MediaView[]): Promise<void> {
    this.galleryOverride.set(list);
    try {
      await this.api.reorderGallery(this.invitation().id, list.map((m) => m.id));
      this.changed.emit();
    } catch (err) {
      this.galleryOverride.set(null);
      this.toasts.error(errorKey(toApiError(err).code));
    }
  }
}
