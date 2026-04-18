export interface WebCalendarEvent {
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  notes?: string;
}

function stripDashes(date: string): string {
  return date.replace(/-/g, '');
}

function formatDateTime(date: string, time: string): string {
  return `${stripDashes(date)}T${time.replace(':', '')}00`;
}

function addOneHour(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const endH = h + 1 < 24 ? h + 1 : h;
  return formatDateTime(date, `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
}

function nextDayYMD(date: string): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function buildDateRange(event: WebCalendarEvent): { start: string; end: string; allDay: boolean } {
  if (event.startTime) {
    return {
      start: formatDateTime(event.date, event.startTime),
      end: event.endTime
        ? formatDateTime(event.date, event.endTime)
        : addOneHour(event.date, event.startTime),
      allDay: false,
    };
  }
  return {
    start: stripDashes(event.date),
    end: nextDayYMD(event.date),
    allDay: true,
  };
}

export function openGoogleCalendar(event: WebCalendarEvent): void {
  if (typeof window === 'undefined') return;
  const { start, end } = buildDateRange(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    ...(event.notes ? { details: event.notes } : {}),
  });
  window.open(
    `https://calendar.google.com/calendar/render?${params.toString()}`,
    '_blank',
    'noopener,noreferrer',
  );
}

function buildIcs(event: WebCalendarEvent): string {
  const { start, end, allDay } = buildDateRange(event);
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}Z`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nestiq//EN',
    'BEGIN:VEVENT',
    `DTSTAMP:${stamp}`,
    allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    ...(event.notes ? [`DESCRIPTION:${event.notes}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function downloadIcs(event: WebCalendarEvent): void {
  if (typeof document === 'undefined') return;
  const content = buildIcs(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
