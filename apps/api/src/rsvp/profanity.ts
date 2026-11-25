/**
 * So'kinish va haqoratli so'zlar filtri (o'zbek lotin/kirill, rus, ingliz).
 *
 * Maqsad: rad etish emas, balki **shubhali tilakni ushlab qolish**. Topilsa, tilak juftlik
 * tasdiqlamaguncha devorga chiqmaydi (tekshiruv sozlamada o'chiq bo'lsa ham). Shuning uchun
 * ro'yxat biroz "qattiq": noto'g'ri topilgan holat atigi qo'lda tasdiqlashni talab qiladi.
 *
 * Aylanib o'tish usullariga qarshi normallashtirish:
 *  - katta/kichik harf, kirill -> lotin transliteratsiya (о/o, а/a, х/x ...);
 *  - "leet" almashtirishlar: 0->o, 3->e, 4->a, 1/!->i, @->a, $->s;
 *  - harflar orasidagi belgilar: "s.i.k", "х у й", "b-l-y-a";
 *  - takrorlangan harflar: "jalaaaab" -> "jalab".
 */

/** Kirill -> lotin (rus va o'zbek kirill). Natija faqat qidiruv uchun, ko'rsatilmaydi. */
const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

const LEET: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '1': 'i', '!': 'i', '@': 'a', $: 's' };

/**
 * Ildizlar normallashtirilgan (lotin, apostrofsiz) ko'rinishda. Har biri so'z boshida
 * qidiriladi: qo'shimchalar ("jalablar", "сукин") ham ushlanadi, lekin so'z o'rtasidagi
 * tasodifiy moslik ("kosik", "ромашка") ushlanmaydi.
 */
const ROOTS: readonly string[] = [
  // --- o'zbek ---
  'jalab', 'qanjiq', 'kanjik', 'dalbayob', 'dolboyob', 'dalbaeb', 'itvachcha', 'itdan tarqagan',
  'haromi', 'xaromi', 'haromzoda', 'xaromzoda', 'padarlanat', 'padarla', 'onangni',
  'qotoq', 'kotok', 'qotog', 'sikay', 'sikam', 'sikib', 'sikdi', 'sikish', 'siktir', 'sikt',
  'yeban', 'iflos', 'maraz', 'gandon', 'ahmoq', 'axmoq', 'tentak',
  'eshshak', 'chuchqa', 'chochqa', 'tupoy', 'buzuq', 'fohisha', 'foxisha',
  // --- rus (kirill transliteratsiyadan keyin) ---
  'xuy', 'xui', 'xue', 'xuya', 'xuyo', 'poxuy', 'naxuy', 'pizd', 'pezd', 'eba', 'ebl', 'ebu',
  'ebi', 'yeba', 'yebl', 'yebu', 'zaeb', 'zaye', 'vyeb', 'otyeb', 'uyeb', 'ueb', 'blya', 'blyad',
  'bled', 'suka', 'suki', 'suchk', 'mudak', 'mudil', 'mudo', 'gandon', 'pidor', 'pidar', 'pider',
  'shlyux', 'shalav', 'debil', 'dolboeb', 'dolbaeb', 'ublyud', 'gavno', 'govno', 'zalup', 'manda',
  'chmo', 'urod', 'tvar',
  // --- ingliz ---
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'dick', 'asshole', 'bastard', 'whore', 'slut', 'motherf',
];

/** Ildizga mos keladigan, lekin oddiy so'zlar (so'z boshidan). */
const SAFE_PREFIXES: readonly string[] = [
  'ebay', 'suklan', 'sukut', 'skayp', 'mandarin', 'mandat', 'mudofaa', 'mudom', 'mudir', 'mudxish',
  'debilnost', 'iflosla', 'buzuqlik', 'tentakl', 'molodes', 'molodets', 'molodec', 'dicken',
  'shitoy', 'xuyzhe', 'uroda', 'urodl', 'tvarog', 'chmok', 'sukiyaki', 'ahmoqona',
];

function normalize(input: string): string {
  let s = input.toLowerCase();
  s = Array.from(s, (ch) => CYR[ch] ?? LEET[ch] ?? ch).join('');
  // O'zbekcha apostroflar va diakritika: qo'toq / qoʻtoq / qo`toq -> qotoq
  s = s.normalize('NFKD').replace(/[̀-ͯ'`ʻʼ‘’]/g, '');
  // Harf emas belgilar bo'shliqqa (so'z chegarasi saqlanadi)
  s = s.replace(/[^a-z\s]/g, ' ');
  // Takror harflar: "jalaaab" -> "jalab"
  s = s.replace(/([a-z])\1{2,}/g, '$1');
  return ` ${s.replace(/\s+/g, ' ').trim()} `;
}

/** "s i k i b" kabi harflab yozilgan so'zlarni birlashtiradi (bitta harfli bo'laklar ketma-ketligi). */
function joinSpelled(normalized: string): string {
  return normalized.replace(/(?:\b[a-z]\b ?){3,}/g, (m) => `${m.replace(/ /g, '')} `);
}

/** Ketma-ket takror harflarni bittaga: "mudofaa" -> "mudofa". */
function squeeze(s: string): string {
  return s.replace(/([a-z])\1+/g, '$1');
}

function hasRoot(text: string): boolean {
  for (const root of ROOTS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(` ${root}`, from);
      if (i === -1) break;
      // Matn bo'shliq bilan tugaydi (normalize), shuning uchun end doim topiladi.
      const end = text.indexOf(' ', i + 1);
      const word = text.slice(i + 1, end);
      if (!SAFE_PREFIXES.some((safe) => word.startsWith(safe) || word.startsWith(squeeze(safe)))) return true;
      from = i + 1;
    }
  }
  return false;
}

/** Matnda so'kinish yoki haqorat ehtimoli bormi. */
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  if (hasRoot(normalized)) return true;
  // Takror harflarni bittaga qisqartirib ham tekshiramiz: "suuuka" (2 marta takror ham)
  const squeezed = squeeze(normalized);
  if (squeezed !== normalized && hasRoot(squeezed)) return true;
  const spelled = joinSpelled(normalized);
  return spelled !== normalized && hasRoot(spelled);
}
