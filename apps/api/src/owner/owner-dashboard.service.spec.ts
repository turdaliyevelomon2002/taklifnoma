import { startOfBusinessMonth } from './owner-dashboard.service';

describe('startOfBusinessMonth (Toshkent, UTC+5)', () => {
  it('oy o\'rtasida: oyning 1-kuni 00:00 Toshkent = oldingi kun 19:00 UTC', () => {
    expect(startOfBusinessMonth(new Date('2027-06-15T10:00:00Z')).toISOString()).toBe('2027-05-31T19:00:00.000Z');
  });

  it('UTC bo\'yicha hali eski oy, Toshkentda esa yangi oy boshlangan', () => {
    // 2027-06-30 20:00 UTC = 2027-07-01 01:00 Toshkent
    expect(startOfBusinessMonth(new Date('2027-06-30T20:00:00Z')).toISOString()).toBe('2027-06-30T19:00:00.000Z');
  });

  it('yil almashishi', () => {
    expect(startOfBusinessMonth(new Date('2027-01-01T03:00:00Z')).toISOString()).toBe('2026-12-31T19:00:00.000Z');
  });
});
