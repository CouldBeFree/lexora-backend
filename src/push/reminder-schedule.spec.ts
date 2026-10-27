import { isValidTimeZone, nextReminderAt } from './reminder-schedule';

const at = (iso: string) => new Date(iso);
const first = () => 0;
const last = () => 0.999999;

describe('nextReminderAt', () => {
  // Europe/Kyiv is UTC+2 after the DST switch on 2026-10-25.
  // Slots (local): 08:00–12:40, 12:40–17:20, 17:20–22:00

  it('skips the slot in progress for a fresh schedule', () => {
    // 09:00 local → the 12:40–17:20 slot
    const after = at('2026-10-27T07:00:00Z');
    expect(nextReminderAt(after, 'Europe/Kyiv', first)).toEqual(
      at('2026-10-27T10:40:00Z'),
    );
    expect(nextReminderAt(after, 'Europe/Kyiv', last).getTime()).toBeLessThan(
      at('2026-10-27T15:20:00Z').getTime(),
    );
  });

  it('moves to the next slot even from the very start of a slot', () => {
    // 12:40 local exactly → the 17:20–22:00 slot
    expect(
      nextReminderAt(at('2026-10-27T10:40:00Z'), 'Europe/Kyiv', first),
    ).toEqual(at('2026-10-27T15:20:00Z'));
  });

  it('rolls over to tomorrow morning after the last slot', () => {
    // 18:00 local (last slot) and 23:30 local (after the window)
    for (const after of ['2026-10-27T16:00:00Z', '2026-10-27T21:30:00Z']) {
      expect(nextReminderAt(at(after), 'Europe/Kyiv', first)).toEqual(
        at('2026-10-28T06:00:00Z'),
      );
    }
  });

  it('starts the day at 08:00 when scheduled overnight', () => {
    // 03:00 local → 08:00 local the same day
    expect(
      nextReminderAt(at('2026-10-27T01:00:00Z'), 'Europe/Kyiv', first),
    ).toEqual(at('2026-10-27T06:00:00Z'));
  });

  it('uses the local date, not the UTC date', () => {
    // 2026-10-27T23:30Z is 08:30 on Oct 28 in Tokyo (UTC+9) → 12:40 local
    expect(
      nextReminderAt(at('2026-10-27T23:30:00Z'), 'Asia/Tokyo', first),
    ).toEqual(at('2026-10-28T03:40:00Z'));
  });

  it('handles a DST switch overnight', () => {
    // New York moves to UTC-4 at 02:00 on 2026-03-08; 23:00 EST the day
    // before → 08:00 EDT
    expect(
      nextReminderAt(at('2026-03-08T04:00:00Z'), 'America/New_York', first),
    ).toEqual(at('2026-03-08T12:00:00Z'));
  });

  it('gives three reminders a day, one per slot', () => {
    const times: Date[] = [];
    let next = at('2026-10-27T05:00:00Z'); // 07:00 local
    for (let i = 0; i < 3; i++) {
      next = nextReminderAt(next, 'Europe/Kyiv');
      times.push(next);
    }
    const localMinutes = times.map(
      (t) => (t.getUTCHours() + 2) * 60 + t.getUTCMinutes(),
    );
    expect(localMinutes[0]).toBeGreaterThanOrEqual(8 * 60);
    expect(localMinutes[0]).toBeLessThan(12 * 60 + 40);
    expect(localMinutes[1]).toBeGreaterThanOrEqual(12 * 60 + 40);
    expect(localMinutes[1]).toBeLessThan(17 * 60 + 20);
    expect(localMinutes[2]).toBeGreaterThanOrEqual(17 * 60 + 20);
    expect(localMinutes[2]).toBeLessThan(22 * 60);
    expect(times.every((t) => t.getUTCDate() === 27)).toBe(true);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects anything else', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true);
    expect(isValidTimeZone('Europe/Kiev')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
