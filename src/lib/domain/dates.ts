/**
 * Fechas como texto ISO "YYYY-MM-DD" (sin horas ni zonas): un menú es de un
 * día concreto, no de un instante. Todo el cálculo se hace en UTC para evitar
 * sorpresas con el cambio de hora.
 */

export type IsoDate = string;

const parse = (iso: IsoDate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const format = (d: Date): IsoDate => d.toISOString().slice(0, 10);

export function isIsoDate(s: string | null | undefined): s is IsoDate {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && format(parse(s)) === s;
}

/** Fecha de hoy en la zona horaria de la casa (por defecto Madrid). */
export function todayIso(timeZone = process.env.APP_TIMEZONE || "Europe/Madrid", now = new Date()): IsoDate {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** Lunes de la semana de esa fecha. */
export function mondayOf(iso: IsoDate): IsoDate {
  const day = parse(iso).getUTCDay(); // 0 = domingo
  return addDays(iso, -((day + 6) % 7));
}

export function weekDays(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Días entre dos fechas (b - a). */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

export function isWeekend(iso: IsoDate): boolean {
  const day = parse(iso).getUTCDay();
  return day === 0 || day === 6;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", ...opts });

/** "Lunes 10" */
export function dayLabel(iso: IsoDate): string {
  const weekday = fmt({ weekday: "long" }).format(parse(iso));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${parse(iso).getUTCDate()}`;
}

/** "10 – 16 nov" o "28 oct – 3 nov" */
export function weekRangeLabel(weekStart: IsoDate): string {
  const start = parse(weekStart);
  const end = parse(addDays(weekStart, 6));
  const month = fmt({ month: "short" });
  const m1 = month.format(start).replace(".", "");
  const m2 = month.format(end).replace(".", "");
  return m1 === m2
    ? `${start.getUTCDate()} – ${end.getUTCDate()} ${m2}`
    : `${start.getUTCDate()} ${m1} – ${end.getUTCDate()} ${m2}`;
}
