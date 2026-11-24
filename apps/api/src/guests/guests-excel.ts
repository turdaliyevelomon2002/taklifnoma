import { formatUzPhone, type GuestView, type Locale, type RsvpStats } from '@taklifnoma/shared';
import ExcelJS from 'exceljs';
import { t } from '../i18n/translator';

export interface GuestsExcelInput {
  locale: Locale;
  timezone: string;
  coupleNames: string;
  guests: GuestView[];
  stats: RsvpStats;
  now?: Date;
}

/**
 * Excel'da "formula injection"ning oldini olish: mehmon yozgan matn =, +, -, @ bilan
 * boshlansa, Excel uni formula sifatida ishga tushirishi mumkin. Boshiga ' qo'shiladi.
 */
export function safeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function formatDate(isoDate: string | Date, timezone: string): string {
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8C6A1F' } };
const YES_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF1E7B34' }, bold: true };
const NO_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FFB3261E' } };

export async function buildGuestsWorkbook(input: GuestsExcelInput): Promise<Buffer> {
  const { locale: l, timezone, guests, stats } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Taklifnoma';
  wb.created = input.now ?? new Date();

  // --- 1-varaq: mehmonlar ---
  const sheet = wb.addWorksheet(t(l, 'export.sheet'), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: t(l, 'export.col.no'), key: 'no', width: 6 },
    { header: t(l, 'export.col.name'), key: 'name', width: 28 },
    { header: t(l, 'export.col.phone'), key: 'phone', width: 20 },
    { header: t(l, 'export.col.answer'), key: 'answer', width: 14 },
    { header: t(l, 'export.col.guests'), key: 'guests', width: 14 },
    { header: t(l, 'export.col.wish'), key: 'wish', width: 60 },
    { header: t(l, 'export.col.lang'), key: 'lang', width: 7 },
    { header: t(l, 'export.col.date'), key: 'date', width: 18 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle' };
  header.height = 22;

  guests.forEach((g, i) => {
    const row = sheet.addRow({
      no: i + 1,
      name: safeCell(g.name),
      phone: g.phone ? formatUzPhone(g.phone) : '',
      answer: t(l, g.attending ? 'export.yes' : 'export.no'),
      guests: g.attending ? g.guestCount : 0,
      wish: g.wish ? safeCell(g.wish) : '',
      lang: g.locale.toUpperCase(),
      date: formatDate(g.createdAt, timezone),
    });
    row.getCell('answer').font = g.attending ? YES_FONT : NO_FONT;
    row.getCell('wish').alignment = { wrapText: true, vertical: 'top' };
    row.alignment = { vertical: 'top' };
  });

  if (guests.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: guests.length + 1, column: 8 } };
    const total = sheet.addRow({ name: t(l, 'export.total'), guests: stats.attendingGuests });
    total.font = { bold: true };
    total.border = { top: { style: 'thin' } };
  }

  // --- 2-varaq: statistika ---
  const summary = wb.addWorksheet(t(l, 'export.summarySheet'));
  summary.columns = [{ width: 28 }, { width: 18 }];
  const title = summary.addRow([t(l, 'export.summary.title', { names: input.coupleNames })]);
  title.font = { bold: true, size: 14 };
  summary.addRow([]);
  const rows: [string, number | string][] = [
    [t(l, 'export.summary.replies'), stats.replies],
    [t(l, 'export.summary.attendingReplies'), stats.attendingReplies],
    [t(l, 'export.summary.attendingGuests'), stats.attendingGuests],
    [t(l, 'export.summary.declined'), stats.notAttendingReplies],
    [t(l, 'export.summary.exportedAt'), formatDate(input.now ?? new Date(), timezone)],
  ];
  for (const r of rows) summary.addRow(r).getCell(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
