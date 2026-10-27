// Phrase reminders go out between 8:00 and 22:00 in the user's time zone.
// The window is split into equal slots and each slot gets one reminder at a
// random moment, so the reminders of a day never bunch up.
export const REMINDERS_PER_DAY = 3;

const WINDOW_START_MIN = 8 * 60;
const WINDOW_END_MIN = 22 * 60;
const SLOT_MIN = (WINDOW_END_MIN - WINDOW_START_MIN) / REMINDERS_PER_DAY;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * A random moment in the first slot that starts after `after`.
 * Pass the previous reminder's time to move on to the next slot, or the
 * current time for a fresh schedule (the slot in progress is skipped).
 */
export function nextReminderAt(
  after: Date,
  timeZone: string,
  random: () => number = Math.random,
): Date {
  const { year, month, day } = localParts(after, timeZone);

  // Today's slots, then tomorrow's — tomorrow's first slot always qualifies
  for (let d = 0; ; d++) {
    for (let slot = 0; slot < REMINDERS_PER_DAY; slot++) {
      const startMin = WINDOW_START_MIN + slot * SLOT_MIN;
      const start = zonedTime(year, month, day + d, startMin, timeZone);
      if (start <= after.getTime()) continue;

      const end = zonedTime(
        year,
        month,
        day + d,
        startMin + SLOT_MIN,
        timeZone,
      );
      return new Date(start + Math.floor(random() * (end - start)));
    }
  }
}

// UTC timestamp of a wall-clock time in `timeZone` (`day` may overflow the month)
function zonedTime(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string,
): number {
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  // Guess with the offset at `wall`, then correct once in case DST differs
  const guess = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(guess, timeZone);
}

// How far `timeZone` is ahead of UTC at timestamp `t`, in ms
function offsetAt(t: number, timeZone: string): number {
  const p = localParts(new Date(t), timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(t / 1000) * 1000;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}
