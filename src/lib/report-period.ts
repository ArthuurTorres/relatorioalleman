/** Calendar-month boundaries in the business timezone, independent of the host timezone. */
export function currentMonthRange(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return {
    from: `${day.slice(0, 7)}-01T00:00:00.000-03:00`,
    to: `${day}T23:59:59.999-03:00`,
  };
}