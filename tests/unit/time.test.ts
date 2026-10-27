import { expect, it } from 'vitest';
import { formatTime, parseTimestamp } from '../../src/lib/time';

it('parses timestamps', () => {
  expect(parseTimestamp('00:00:01,000')).toBe(1);
  expect(parseTimestamp('1:02:03.5')).toBe(3723.5);
  expect(parseTimestamp('02:03.250')).toBe(123.25);
  expect(parseTimestamp('00:00:xx,000')).toBe(null);
  expect(parseTimestamp('')).toBe(null);
});

it('formats times', () => {
  expect(formatTime(0)).toBe('0:00');
  expect(formatTime(65.9)).toBe('1:05');
  expect(formatTime(3725)).toBe('1:02:05');
  expect(formatTime(-3)).toBe('0:00');
  expect(formatTime(NaN)).toBe('0:00');
});
