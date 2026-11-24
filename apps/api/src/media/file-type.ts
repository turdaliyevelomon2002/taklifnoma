/**
 * Fayl turini mijoz yuborgan Content-Type'ga emas, baytlarning o'ziga qarab aniqlaydi.
 * Rasmlar sharp tomonidan alohida tekshiriladi (qayta kodlanadi).
 */
export interface AudioType {
  mime: string;
  ext: string;
}

export function detectAudio(buf: Buffer): AudioType | null {
  if (buf.length < 12) return null;
  // MP3: ID3 teg yoki MPEG frame sync (0xFFE)
  if (buf.subarray(0, 3).toString('latin1') === 'ID3') return { mime: 'audio/mpeg', ext: 'mp3' };
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0 && (buf[1]! & 0x06) !== 0) {
    return { mime: 'audio/mpeg', ext: 'mp3' };
  }
  // M4A / AAC (MP4 konteyner): ....ftyp
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['M4A ', 'M4B ', 'mp42', 'isom', 'dash'].includes(brand)) {
      return { mime: 'audio/mp4', ext: 'm4a' };
    }
  }
  // OGG (Vorbis/Opus)
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return { mime: 'audio/ogg', ext: 'ogg' };
  return null;
}
