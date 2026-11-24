import { detectAudio } from './file-type';

const pad = (head: number[] | string) =>
  Buffer.concat([
    typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head),
    Buffer.alloc(16),
  ]);

describe('detectAudio', () => {
  it('MP3 (ID3 va frame sync) ni aniqlaydi', () => {
    expect(detectAudio(pad('ID3'))?.mime).toBe('audio/mpeg');
    expect(detectAudio(pad([0xff, 0xfb, 0x90, 0x00]))?.mime).toBe('audio/mpeg');
  });

  it('M4A va OGG ni aniqlaydi', () => {
    expect(detectAudio(pad('\0\0\0\x20ftypM4A '))?.ext).toBe('m4a');
    expect(detectAudio(pad('OggS'))?.ext).toBe('ogg');
  });

  it('boshqa fayllarni rad etadi', () => {
    expect(detectAudio(pad('<html><script>'))).toBeNull();
    expect(detectAudio(pad([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectAudio(Buffer.alloc(4))).toBeNull();
  });
});
