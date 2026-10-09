import { apiFetch } from '../api/apiClient';

const MOBILE_ACCOUNT_PROVIDERS = new Set(['gcash', 'maya', 'grabpay']);

export const normalizePaymentAccountType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'e_wallet' || type === 'e-wallet') return 'ewallet';
  if (type === 'bank_transfer' || type === 'bank-transfer') return 'bank';
  return type;
};

export const normalizePaymentAccount = (account = {}) => ({
  id: String(account.id ?? account.account_id ?? ''),
  type: normalizePaymentAccountType(account.type ?? account.account_type),
  label: String(account.label ?? account.provider ?? account.provider_name ?? '').trim(),
  account_name: String(account.account_name ?? account.accountName ?? '').trim(),
  account_number: String(account.account_number ?? account.accountNumber ?? '').trim(),
  qr_code: account.qr_code ?? account.qrCode ?? account.qr_url ?? '',
});

export const normalizePaymentAccounts = (accounts) => (
  Array.isArray(accounts)
    ? accounts.map(normalizePaymentAccount).filter((account) => account.id && account.label)
    : []
);

export const fetchPaymentAccounts = async () => {
  const response = await apiFetch('/api/clinic/payment-accounts');
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Unable to load payment accounts.');
  return normalizePaymentAccounts(payload?.data);
};

export const paymentAccountsForChannel = (accounts, channel) => {
  const expectedType = channel === 'e_wallet' ? 'ewallet' : channel === 'bank_transfer' ? 'bank' : '';
  return normalizePaymentAccounts(accounts).filter((account) => account.type === expectedType);
};

export const usesMobileAccountNumber = (provider) => (
  MOBILE_ACCOUNT_PROVIDERS.has(String(provider || '').trim().toLowerCase())
);

export const sanitizePaymentAccountNumber = (provider, value) => (
  usesMobileAccountNumber(provider)
    ? String(value || '').replace(/\D/g, '').slice(0, 11)
    : String(value || '')
);

export const validatePaymentAccount = (account = {}) => {
  if (!String(account.label || '').trim()) return 'Please select or enter a provider name.';

  const number = String(account.account_number || '').trim();
  if (number && usesMobileAccountNumber(account.label) && !/^09\d{9}$/.test(number)) {
    return `${account.label} account number must contain exactly 11 digits and start with 09.`;
  }

  return '';
};
