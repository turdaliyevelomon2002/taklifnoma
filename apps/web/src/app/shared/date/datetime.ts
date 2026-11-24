export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
  /** 0 = yakshanba */
  weekday: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Sana va vaqtni to'y bo'ladigan joyning vaqt mintaqasida (masalan, Asia/Tashkent)
 * qismlarga ajratadi. Mehmon qaysi mamlakatdan ochishidan qat'i nazar vaqt bir xil ko'rinadi.
 */
export function zonedParts(iso: string, timeZone: string): ZonedParts {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  return {
    year,
    month,
    day,
    hour: get('hour'),
    minute: get('minute'),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}
