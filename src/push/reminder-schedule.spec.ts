import { isValidTimeZone, nextReminderAt } from './reminder-schedule';

const at = (iso: string) => new Date(iso);
const first = () => 0;
const last = () => 0.999999;

describe('nextReminderAt', () => {
  // Europe/Kyiv is UTC+2 after the DST switch on 2026-10-25.
  // Slots (local): 08:00–10:20, 10:20–12:40, 12:40–15:00, 15:00–17:20,
  // 17:20–19:40, 19:40–22:00

  it('skips the slot in progress for a fresh schedule', () => {
    // 09:00 local → the 10:20–12:40 slot
    const after = at('2026-10-27T07:00:00Z');
    expect(nextReminderAt(after, 'Europe/Kyiv', first)).toEqual(
      at('2026-10-27T08:20:00Z'),
    );
    expect(nextReminderAt(after, 'Europe/Kyiv', last).getTime()).toBeLessThan(
      at('2026-10-27T10:40:00Z').getTime(),
    );
  });

  it('moves to the next slot even from the very start of a slot', () => {
    // 12:40 local exactly → the 15:00–17:20 slot
    expect(
      nextReminderAt(at('2026-10-27T10:40:00Z'), 'Europe/Kyiv', first),
    ).toEqual(at('2026-10-27T13:00:00Z'));
  });

  it('rolls over to tomorrow morning after the last slot', () => {
    // 20:00 local (last slot) and 23:30 local (after the window)
    for (const after of ['2026-10-27T18:00:00Z', '2026-10-27T21:30:00Z']) {
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
    // 2026-10-27T23:30Z is 08:30 on Oct 28 in Tokyo (UTC+9) → 10:20 local
    expect(
      nextReminderAt(at('2026-10-27T23:30:00Z'), 'Asia/Tokyo', first),
    ).toEqual(at('2026-10-28T01:20:00Z'));
  });

  it('handles a DST switch overnight', () => {
    // New York moves to UTC-4 at 02:00 on 2026-03-08; 23:00 EST the day
    // before → 08:00 EDT
    expect(
      nextReminderAt(at('2026-03-08T04:00:00Z'), 'America/New_York', first),
    ).toEqual(at('2026-03-08T12:00:00Z'));
  });

  it('gives six reminders a day, one per slot', () => {
    const times: Date[] = [];
    let next = at('2026-10-27T05:00:00Z'); // 07:00 local
    for (let i = 0; i < 6; i++) {
      next = nextReminderAt(next, 'Europe/Kyiv');
      times.push(next);
    }
    const localMinutes = times.map(
      (t) => (t.getUTCHours() + 2) * 60 + t.getUTCMinutes(),
    );
    localMinutes.forEach((minutes, slot) => {
      expect(minutes).toBeGreaterThanOrEqual(8 * 60 + slot * 140);
      expect(minutes).toBeLessThan(8 * 60 + (slot + 1) * 140);
    });
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
