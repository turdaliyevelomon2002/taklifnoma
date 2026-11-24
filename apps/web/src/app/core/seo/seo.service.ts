import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  url: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  locale: string;
  siteName: string;
}

const OG_LOCALES: Record<string, string> = { uz: 'uz_UZ', ru: 'ru_RU' };

/**
 * Title, description, Open Graph va Twitter meta teglari. SSR'da HTML ichiga yoziladi:
 * Telegram JS bajarmaydi, preview aynan shu teglardan olinadi.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(data: SeoData): void {
    this.title.setTitle(data.title);
    this.setName('description', data.description);

    this.setProperty('og:type', 'website');
    this.setProperty('og:site_name', data.siteName);
    this.setProperty('og:title', data.title);
    this.setProperty('og:description', data.description);
    this.setProperty('og:url', data.url);
    this.setProperty('og:locale', OG_LOCALES[data.locale] ?? data.locale);

    this.setName('twitter:card', data.image ? 'summary_large_image' : 'summary');
    this.setName('twitter:title', data.title);
    this.setName('twitter:description', data.description);

    if (data.image) {
      this.setProperty('og:image', data.image);
      this.setProperty('og:image:width', String(data.imageWidth ?? 1200));
      this.setProperty('og:image:height', String(data.imageHeight ?? 630));
      this.setName('twitter:image', data.image);
    } else {
      for (const p of ['og:image', 'og:image:width', 'og:image:height']) {
        this.meta.removeTag(`property="${p}"`);
      }
      this.meta.removeTag('name="twitter:image"');
    }

    this.setLink('canonical', data.url);
  }

  setRobots(value: string): void {
    this.setName('robots', value);
  }

  /** Shablonga xos shriftlar/stillarni <head> ga qo'shadi (takrorlanmaydi). */
  ensureStylesheet(href: string): void {
    const head = this.document.head;
    if (head.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
    const link = this.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    head.appendChild(link);
  }

  ensurePreconnect(origin: string, crossOrigin = false): void {
    const head = this.document.head;
    if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = this.document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    if (crossOrigin) link.crossOrigin = 'anonymous';
    head.appendChild(link);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private setLink(rel: string, href: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = this.document.createElement('link');
      link.rel = rel;
      this.document.head.appendChild(link);
    }
    link.href = href;
  }
}
