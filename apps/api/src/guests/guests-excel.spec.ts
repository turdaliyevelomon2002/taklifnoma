import type { GuestView } from '@taklifnoma/shared';
import ExcelJS from 'exceljs';
import { buildGuestsWorkbook, safeCell } from './guests-excel';

const guest = (over: Partial<GuestView>): GuestView => ({
  id: 'id',
  name: 'Aziz',
  phone: '+998901234567',
  attending: true,
  guestCount: 3,
  wishes: [],
  telegram: null,
  locale: 'uz',
  createdAt: '2027-05-01T07:30:00.000Z',
  updatedAt: '2027-05-01T07:30:00.000Z',
  ...over,
});

describe('guests excel', () => {
  it('formula injection: = + - @ bilan boshlangan matn zararsizlantiriladi', () => {
    expect(safeCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(safeCell('+998')).toBe(`'+998`);
    expect(safeCell('@cmd')).toBe(`'@cmd`);
    expect(safeCell('Aziz')).toBe('Aziz');
  });

  it("varaqlar, ustunlar, Toshkent vaqti va jami to'g'ri", async () => {
    const buffer = await buildGuestsWorkbook({
      locale: 'uz',
      timezone: 'Asia/Tashkent',
      coupleNames: 'Ali & Madina',
      guests: [
        guest({
          name: '=1+1',
          wishes: [
            { id: 'w1', text: 'Baxtli bo\'linglar', status: 'APPROVED', flagged: false, createdAt: '2027-05-01T07:30:00.000Z' },
            { id: 'w2', text: 'Yana bir tilak', status: 'PENDING', flagged: false, createdAt: '2027-05-01T08:00:00.000Z' },
          ],
        }),
        guest({ id: '2', name: 'Malika', phone: null, attending: false, guestCount: 0, locale: 'ru' }),
      ],
      stats: { replies: 2, attendingReplies: 1, attendingGuests: 3, notAttendingReplies: 1, pendingWishes: 0 },
      now: new Date('2027-05-02T10:00:00Z'),
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Mehmonlar', 'Statistika']);

    const sheet = wb.getWorksheet('Mehmonlar')!;
    expect(sheet.getRow(1).getCell(2).value).toBe('Ism');
    const r2 = sheet.getRow(2);
    expect(r2.getCell(2).value).toBe(`'=1+1`); // formula emas, matn
    expect(r2.getCell(3).value).toBe('+998 90 123 45 67');
    expect(r2.getCell(4).value).toBe('Keladi');
    expect(r2.getCell(6).value).toBe("1) Baxtli bo'linglar\n\n2) Yana bir tilak");
    expect(r2.getCell(8).value).toBe('01.05.2027 12:30'); // UTC+5
    expect(sheet.getRow(3).getCell(4).value).toBe('Kelmaydi');
    expect(sheet.getRow(3).getCell(5).value).toBe(0);
    expect(sheet.getRow(4).getCell(5).value).toBe(3); // jami qatori

    const summary = wb.getWorksheet('Statistika')!;
    expect(summary.getRow(1).getCell(1).value).toBe('Ali & Madina — mehmonlar');
  });

  it('ruscha sarlavhalar', async () => {
    const buffer = await buildGuestsWorkbook({
      locale: 'ru',
      timezone: 'Asia/Tashkent',
      coupleNames: 'Али & Мадина',
      guests: [guest({})],
      stats: { replies: 1, attendingReplies: 1, attendingGuests: 3, notAttendingReplies: 0, pendingWishes: 0 },
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets[0].name).toBe('Гости');
    expect(wb.worksheets[0].getRow(2).getCell(4).value).toBe('Придёт');
  });
});
