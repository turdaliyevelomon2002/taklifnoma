import { containsProfanity } from './profanity';

describe('containsProfanity', () => {
  it.each([
    'Sen jalab ekansan',
    'qanjiq',
    "qo'toq",
    'QOʻTOQ',
    'dalbayob',
    'хуй',
    'Пиздец какой-то',
    'бля, ну и свадьба',
    'сука',
    'ты мудак',
    'fuck you',
    'j.a.l.a.b',
    's i k i b',
    'jalaaaaab',
    'х у й',
    'п1здец',
    'suuuka',
  ])('ushlaydi: %s', (text) => {
    expect(containsProfanity(text)).toBe(true);
  });

  it.each([
    "Ali va Madina, sizlarga cheksiz baxt, mustahkam oila va farzandlar quvonchini tilayman!",
    "Aka, to'yingiz muborak bo'lsin! Bir umr bir-biringizni asrab-avaylang.",
    'Поздравляю! Любви, тепла и взаимопонимания на долгие годы!',
    'Пусть ваш дом всегда будет полной чашей! Счастья вам!',
    "Ikki yosh qalbga baxt, totuvlik va barakali hayot tilaymiz.",
    'Mudofaa vazirligi xodimlari nomidan tabriklaymiz',
    'Желаю молодцам счастья, а мандарины — на десерт',
    'Скоро сукцессия, шучу :) Будьте счастливы!',
    'Congratulations! Wishing you a lifetime of love.',
    'Dilnoza Rahimova',
    "Fuqarolarimiz nomidan tabrik!",
    '',
  ])("tegmaydi: %s", (text) => {
    expect(containsProfanity(text)).toBe(false);
  });

  it('null va undefined', () => {
    expect(containsProfanity(null)).toBe(false);
    expect(containsProfanity(undefined)).toBe(false);
  });
});
