import { signInitData, telegramDisplayName, verifyInitData } from './init-data';

const TOKEN = '123456:TEST-token-for-unit-tests-only-xxxxxxxx';
const NOW = 1_800_000_000_000;
const user = { id: 777001, first_name: 'Jasur', last_name: 'Karimov', username: 'jasur_k' };

function make(overrides: Record<string, string> = {}, token = TOKEN): string {
  return signInitData(
    {
      auth_date: String(NOW / 1000 - 60),
      query_id: 'AAE',
      user: JSON.stringify(user),
      start_param: 'ali-madina',
      ...overrides,
    },
    token,
  );
}

describe('verifyInitData', () => {
  it("to'g'ri imzoni qabul qiladi", () => {
    const res = verifyInitData(make(), TOKEN, 3600, NOW);
    expect(res?.user.id).toBe(777001);
    expect(res?.startParam).toBe('ali-madina');
    expect(telegramDisplayName(res!.user)).toBe('Jasur Karimov');
  });

  it('boshqa bot tokeni bilan imzolangan initData rad etiladi', () => {
    expect(verifyInitData(make({}, '999:other-token-xxxxxxxxxxxxxxxxxxxxxxxxxx'), TOKEN, 3600, NOW)).toBeNull();
  });

  it("o'zgartirilgan foydalanuvchi rad etiladi", () => {
    const raw = make().replace(encodeURIComponent('777001'), encodeURIComponent('777002'));
    expect(verifyInitData(raw, TOKEN, 3600, NOW)).toBeNull();
  });

  it('eskirgan initData rad etiladi', () => {
    expect(verifyInitData(make({ auth_date: String(NOW / 1000 - 7200) }), TOKEN, 3600, NOW)).toBeNull();
  });

  it("hash yo'q yoki buzilgan", () => {
    expect(verifyInitData('user=%7B%7D&auth_date=1', TOKEN, 3600, NOW)).toBeNull();
    expect(verifyInitData('', TOKEN, 3600, NOW)).toBeNull();
    expect(verifyInitData(make() + 'x', TOKEN, 3600, NOW)).toBeNull();
  });

  it("user maydoni noto'g'ri bo'lsa rad etiladi", () => {
    expect(verifyInitData(make({ user: '{"first_name":"X"}' }), TOKEN, 3600, NOW)).toBeNull();
  });
});
