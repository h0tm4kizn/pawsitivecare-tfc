const CHANNEL_LABELS = {
  cash: 'Cash',
  e_wallet: 'E-Wallet',
  bank_transfer: 'Bank Transfer',
};

export const getNewBookingPaymentInfo = (raw = {}) => {
  const referenceNumber = String(
    raw.reference_number ||
    raw.payment_reference_id ||
    raw.payment_reference ||
    raw.payment?.reference_number ||
    raw.payment?.reference ||
    '',
  ).trim();
  const hasProof = Boolean(
    raw.reservation_deposit_proof_available ||
    raw.reservation_deposit_proof_url ||
    raw.deposit_proof_url ||
    raw.payment?.proof_url,
  );
  const channel = String(raw.reservation_channel || raw.payment?.method || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const channelLabel = CHANNEL_LABELS[channel] || '';
  const payerProvider = String(raw.reservation_payer_provider || raw.payment?.payer_provider || '').trim();
  const paymentFrom = payerProvider
    ? `${channelLabel ? `${channelLabel} · ` : ''}${payerProvider}`
    : channelLabel || 'Not provided';
  const account = raw.reservation_payment_account || raw.payment?.account || {};
  const paymentTo = [account.label, account.account_name, account.account_number]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' · ') || 'Not provided';

  return {
    paymentFrom,
    paymentTo,
    referenceNumber,
    hasProof,
    showNoPaymentProof: !referenceNumber && !hasProof,
  };
};
