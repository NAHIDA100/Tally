import type { Cents } from '@/src/logic/money';
import type { DayKey, MonthKey } from '@/src/logic/date';

export type TransactionType = 'expense' | 'income' | 'transfer';
export type CategoryType = 'expense' | 'income';
export type AccountType = 'cash' | 'bank' | 'credit' | 'ewallet';

export interface Transaction {
  id: string;
  type: TransactionType;
  /** 整数分，恒为正；方向由 type 决定 */
  amount: Cents;
  /** 转账时为 null */
  categoryId: string | null;
  accountId: string;
  /** 仅转账时有值 */
  toAccountId: string | null;
  /** UTC ISO 字符串 */
  occurredAt: string;
  /** 本地日期，冗余列，供按天分组走索引 */
  occurredDate: DayKey;
  /** 本地月份，冗余列，供按月统计走索引 */
  occurredMonth: MonthKey;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: Cents;
  icon: string;
  color: string;
  isArchived: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  sortOrder: number;
  isPreset: boolean;
}

export interface Budget {
  id: string;
  yearMonth: MonthKey;
  /** null = 月度总预算 */
  categoryId: string | null;
  amount: Cents;
}

/** 新建/编辑流水时表单产出的数据，id 与时间戳由 repository 补齐 */
export interface TransactionDraft {
  id?: string;
  type: TransactionType;
  amount: Cents;
  categoryId: string | null;
  accountId: string;
  toAccountId: string | null;
  occurredAt: Date;
  note: string;
  tags: string[];
}

export interface TransactionFilter {
  month?: MonthKey;
  /** 闭区间的本地日期，优先于 month */
  from?: DayKey;
  to?: DayKey;
  categoryId?: string;
  accountId?: string;
  /** 匹配备注与标签 */
  keyword?: string;
  types?: TransactionType[];
}

/** 带关联名字的流水，列表与详情页展示用 */
export interface TransactionWithRefs extends Transaction {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  accountName: string | null;
  accountIcon: string | null;
  accountColor: string | null;
  toAccountName: string | null;
}
