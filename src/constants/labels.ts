import type { AccountType } from '@/src/types';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: '现金',
  bank: '银行卡',
  credit: '信用卡',
  ewallet: '电子钱包',
};

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  cash: 'cash',
  bank: 'bank',
  credit: 'credit-card',
  ewallet: 'cellphone',
};
