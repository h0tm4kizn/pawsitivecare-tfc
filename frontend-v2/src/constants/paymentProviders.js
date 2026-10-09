export const EWALLET_OPTIONS = [
  { value: '', label: 'Select e-wallet' },
  { value: 'GCash', label: 'GCash' },
  { value: 'Maya', label: 'Maya' },
  { value: 'ShopeePay', label: 'ShopeePay' },
  { value: 'GrabPay', label: 'GrabPay' },
  { value: 'Other', label: 'Other (Please Specify)' },
];

export const BANK_OPTIONS = [
  { value: '', label: 'Select bank' },
  { value: 'BDO', label: 'BDO' },
  { value: 'BPI', label: 'BPI' },
  { value: 'Metrobank', label: 'Metrobank' },
  { value: 'Landbank', label: 'LandBank' },
  { value: 'PNB', label: 'PNB' },
  { value: 'Security Bank', label: 'Security Bank' },
  { value: 'UnionBank', label: 'UnionBank' },
  { value: 'RCBC', label: 'RCBC' },
  { value: 'Chinabank', label: 'China Bank' },
  { value: 'EastWest Bank', label: 'EastWest Bank' },
  { value: 'PSBank', label: 'Philippine Savings Bank (PSBank)' },
  { value: 'AUB', label: 'Asia United Bank (AUB)' },
  { value: 'Bank of Commerce', label: 'Bank of Commerce' },
  { value: 'Maybank Philippines', label: 'Maybank Philippines' },
  { value: 'GoTyme Bank', label: 'GoTyme Bank' },
  { value: 'MariBank', label: 'MariBank' },
  { value: 'CIMB Bank Philippines', label: 'CIMB Bank Philippines' },
  { value: 'UNO Digital Bank', label: 'UNO Digital Bank' },
  { value: 'OwnBank', label: 'OwnBank' },
  { value: 'SeaBank', label: 'SeaBank' },
  { value: 'Other', label: 'Other (Please Specify)' },
];

// Accounts the clinic accepts for customer online reservation payments.
export const CLINIC_EWALLET_OPTIONS = [
  { value: '', label: 'Select e-wallet' },
  { value: 'GCash', label: 'GCash' },
  { value: 'Maya', label: 'Maya' },
];

export const CLINIC_BANK_OPTIONS = [
  { value: '', label: 'Select bank' },
  { value: 'BPI', label: 'BPI' },
];

export const CLINIC_RECEIVING_ACCOUNTS = [
  { value: 'GCash', label: 'GCash', type: 'e_wallet' },
  { value: 'BPI', label: 'BPI', type: 'bank_transfer' },
  { value: 'Maya', label: 'Maya', type: 'e_wallet' },
];
