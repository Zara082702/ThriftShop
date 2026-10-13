// Where customers send their payments.
// 1) Save your GCash QR picture as  assets/gcash-qr.jpg
// 2) CHANGE THE BANK DETAILS BELOW to your real account.

export const GCASH_QR = require('../../assets/gcash-qr.jpg');

export const BANK_DETAILS = {
  bankName: 'Your Bank Name',
  accountName: "Baker's Thrift Shop",
  accountNumber: '0000 0000 0000',
};

export const GCASH_INSTRUCTIONS =
  'Open GCash, tap Scan QR, scan this code and send the exact total. Then type the reference number below, or send it to us in the chat.';