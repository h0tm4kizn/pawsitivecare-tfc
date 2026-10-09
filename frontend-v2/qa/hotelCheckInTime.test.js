import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hotelCheckInTimeError,
  hotelTimeInputFromValue,
  hotelTimeValueFromInput,
} from '../src/utils/hotelCheckInTime.js';

const hours = { open: '09:00', close: '18:00' };

test('converts 12-hour Hotel inputs to backend 24-hour time without losing minutes', () => {
  const validInputs = [
    [{ hour: '09', minute: '00', period: 'AM' }, '09:00'],
    [{ hour: '09', minute: '07', period: 'AM' }, '09:07'],
    [{ hour: '10', minute: '15', period: 'AM' }, '10:15'],
    [{ hour: '12', minute: '00', period: 'PM' }, '12:00'],
    [{ hour: '12', minute: '00', period: 'AM' }, '00:00'],
    [{ hour: '02', minute: '45', period: 'PM' }, '14:45'],
  ];

  validInputs.forEach(([input, expected]) => {
    assert.equal(hotelTimeValueFromInput(input), expected);
    assert.deepEqual(hotelTimeInputFromValue(expected), input);
  });
});

test('rejects malformed hours and minutes', () => {
  assert.equal(hotelTimeValueFromInput({ hour: '13', minute: '00', period: 'PM' }), null);
  assert.equal(hotelTimeValueFromInput({ hour: '09', minute: '60', period: 'AM' }), null);
  assert.match(hotelCheckInTimeError({ hour: '13', minute: '00', period: 'PM' }, hours), /hour from 01 to 12/);
  assert.match(hotelCheckInTimeError({ hour: '09', minute: '60', period: 'AM' }, hours), /minute from 00 to 59/);
});

test('allows any minute within the operating window and excludes opening/closing violations', () => {
  assert.equal(hotelCheckInTimeError('09:07', hours), '');
  assert.equal(hotelCheckInTimeError('17:59', hours), '');
  assert.match(hotelCheckInTimeError('08:59', hours), /configured operating hours/);
  assert.match(hotelCheckInTimeError('18:00', hours), /configured operating hours/);
  assert.match(hotelCheckInTimeError('09:07', null), /unavailable for this date/);
});

test('reports that overnight operating windows are unsupported', () => {
  assert.match(
    hotelCheckInTimeError('23:00', { open: '22:00', close: '02:00' }),
    /Overnight Hotel check-in hours are not configured/,
  );
});
