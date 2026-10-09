import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppointmentServiceCategory,
  getOrdinaryPaymentReference,
} from '../src/utils/appointmentServiceType.js';

test('uses the canonical service relationship category over service names', () => {
  assert.equal(getAppointmentServiceCategory({
    service: { category: 'grooming', name: 'Cozy Paw Suite' },
  }), 'grooming');
});

test('supports service category fields from normalized appointment responses', () => {
  assert.equal(getAppointmentServiceCategory({ service_category: 'hotel' }), 'hotel');
  assert.equal(getAppointmentServiceCategory({ serviceCategory: 'daycare' }), 'daycare');
});

test('does not infer a Hotel category from a service name or reservation data', () => {
  assert.equal(getAppointmentServiceCategory({
    service: { name: 'Cozy Paw Suite' },
    hotel_nights: 3,
  }), '');
});

test('preserves ordinary Grooming payment references without exposing Hotel reservation refs', () => {
  assert.equal(getOrdinaryPaymentReference({
    service: { category: 'grooming' },
    reference_number: 'TXN123',
  }), 'TXN123');
  assert.equal(getOrdinaryPaymentReference({
    service: { category: 'hotel' },
    reference_number: 'HOTELDEPOSIT123',
  }), null);
});
