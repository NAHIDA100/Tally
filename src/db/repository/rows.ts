import type { AccountType, CategoryType, TransactionType } from '@/src/types';

/**
 * 数据库行的原始形状（snake_case + 0/1 布尔），只在 repository 内部出现。
 * 出了 repository 一律由 mapper 转成 src/types.ts 里的 camelCase 领域对象。
 */

export interface TransactionRow {
  id: string;
  type: TransactionType;
  amount: number;
  category_id: string | null;
  account_id: string;
  to_account_id: string | null;
  occurred_at: string;
  occurred_date: string;
  occurred_month: string;
  note: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionRefRow extends TransactionRow {
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  account_name: string | null;
  account_icon: string | null;
  account_color: string | null;
  to_account_name: string | null;
}

export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  icon: string;
  color: string;
  is_archived: number;
  sort_order: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sort_order: number;
  is_preset: number;
}

export interface BudgetRow {
  id: string;
  year_month: string;
  category_id: string;
  amount: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

/** 聚合结果 */
export interface MonthSummaryRow {
  income: number | null;
  expense: number | null;
}

export interface SumByCategoryRow {
  category_id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}

export interface SumByMonthRow {
  occurred_month: string;
  income: number | null;
  expense: number | null;
}

/** listAccountBalances 的一次性聚合结果 */
export interface AccountBalanceRow extends AccountRow {
  received: number | null;
  spent: number | null;
  transferred_in: number | null;
  transferred_out: number | null;
  tx_count: number | null;
}

export interface TopCategoryRow extends CategoryRow {
  used_count: number;
}

/** SQLite 的 NULL 不能被当成 0 用，聚合列统一走这里 */
export function cents(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
