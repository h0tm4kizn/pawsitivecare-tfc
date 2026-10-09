import test from 'node:test';
import assert from 'node:assert/strict';
import { getNewBookingPaymentInfo } from '../src/pages/admin/appointment/newBookingPaymentInfo.js';

const base = {
  reservation_channel: 'e_wallet',
  reservation_payer_provider: 'GCash',
  reservation_payment_account: {
    label: 'Maya',
    account_name: 'The Fur Club',
    account_number: '09170000000',
  },
};

test('reference number only is treated as submitted payment information', () => {
  const info = getNewBookingPaymentInfo({ ...base, reference_number: 'REF123' });
  assert.equal(info.paymentFrom, 'E-Wallet · GCash');
  assert.equal(info.paymentTo, 'Maya · The Fur Club · 09170000000');
  assert.equal(info.referenceNumber, 'REF123');
  assert.equal(info.hasProof, false);
  assert.equal(info.showNoPaymentProof, false);
});

test('proof only is displayed without requiring a reference number', () => {
  const info = getNewBookingPaymentInfo({ ...base, reservation_deposit_proof_available: true });
  assert.equal(info.referenceNumber, '');
  assert.equal(info.hasProof, true);
  assert.equal(info.showNoPaymentProof, false);
});

test('reference and proof are both displayed when present', () => {
  const info = getNewBookingPaymentInfo({
    ...base,
    reference_number: 'REF456',
    reservation_deposit_proof_available: true,
  });
  assert.equal(info.referenceNumber, 'REF456');
  assert.equal(info.hasProof, true);
  assert.equal(info.showNoPaymentProof, false);
});

test('no proof message appears only when reference and proof are both absent', () => {
  const info = getNewBookingPaymentInfo(base);
  assert.equal(info.referenceNumber, '');
  assert.equal(info.hasProof, false);
  assert.equal(info.showNoPaymentProof, true);
});

test('payment details remain isolated between bookings', () => {
  const first = getNewBookingPaymentInfo({ ...base, reference_number: 'FIRST' });
  const second = getNewBookingPaymentInfo({ ...base, reference_number: 'SECOND' });
  assert.equal(first.referenceNumber, 'FIRST');
  assert.equal(second.referenceNumber, 'SECOND');
});
