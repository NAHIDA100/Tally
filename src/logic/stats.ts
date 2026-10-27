import { daysInMonth, monthKeyOfDayKey, type DayKey, type MonthKey } from './date';
import type { Cents } from './money';

/**
 * 账单聚合的输入形状。用结构化类型而不是直接 import Transaction，
 * 这样这个文件对 UI 层与数据库层零依赖，vitest 的 node 环境可以直接跑。
 */
export interface MoneyItem {
  occurredDate: DayKey;
  type: 'expense' | 'income' | 'transfer';
  amount: Cents;
}

export interface DayGroup<T extends MoneyItem> {
  day: DayKey;
  income: Cents;
  expense: Cents;
  net: Cents;
  items: T[];
}

/**
 * 按本地日期分组，日序倒排（新的一天在前）。
 *
 * 转账既不算收入也不算支出，只改变账户余额——所以它进 items 但不进任何合计。
 * 组内顺序沿用传入顺序：repository 的 listTransactions 已按 occurred_at DESC 排好，
 * 这里不再二次排序，避免把「同一天的顺序」这件事变成两处逻辑。
 */
export function groupByDay<T extends MoneyItem>(items: readonly T[]): DayGroup<T>[] {
  const groups = new Map<DayKey, DayGroup<T>>();

  for (const item of items) {
    let group = groups.get(item.occurredDate);
    if (!group) {
      group = { day: item.occurredDate, income: 0, expense: 0, net: 0, items: [] };
      groups.set(item.occurredDate, group);
    }
    group.items.push(item);
    if (item.type === 'expense') group.expense += item.amount;
    else if (item.type === 'income') group.income += item.amount;
    group.net = group.income - group.expense;
  }

  return [...groups.values()].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

export interface Totals {
  income: Cents;
  expense: Cents;
  net: Cents;
  /** 转账笔数，用于在界面上说明「为什么余额变了但收支没变」 */
  transferCount: number;
}

export function summarize(items: readonly MoneyItem[]): Totals {
  let income = 0;
  let expense = 0;
  let transferCount = 0;
  for (const item of items) {
    if (item.type === 'income') income += item.amount;
    else if (item.type === 'expense') expense += item.amount;
    else transferCount += 1;
  }
  return { income, expense, net: income - expense, transferCount };
}

/** 键盘上「预计结余将减少 ¥X」这类提示用：支出减、收入加、转账不变 */
export function balanceDelta(
  type: MoneyItem['type'],
  amount: Cents,
): Cents {
  if (type === 'expense') return -amount;
  if (type === 'income') return amount;
  return 0;
}

export interface Shareable {
  total: Cents;
}

/**
 * 给每个分类补上占比（0–100，保留一位小数）。
 *
 * 用 total * 1000 / sum 再除 10 而不是先算比例再乘 100：
 * 前者只在最后一步引入一次浮点误差，后者会累积。占比只用于展示，
 * 不参与任何金额合计，所以一位小数的误差是可接受的，但求和仍然应当接近 100。
 */
export function withShares<T extends Shareable>(
  items: readonly T[],
): (T & { percent: number })[] {
  const sum = items.reduce((acc, item) => acc + item.total, 0);
  if (sum === 0) return items.map((item) => ({ ...item, percent: 0 }));
  return items.map((item) => ({
    ...item,
    percent: Math.round((item.total * 1000) / sum) / 10,
  }));
}

/**
 * 日均支出。当月用「已过天数」而不是整月天数，否则月初看统计会以为自己很省。
 * 结果按四舍五入到分，仅用于展示。
 */
export function averageDailyExpense(
  expense: Cents,
  month: MonthKey,
  today: DayKey,
): Cents {
  const days = month === monthKeyOfDayKey(today)
    ? Number(today.slice(8, 10))
    : daysInMonth(month);
  if (days <= 0) return 0;
  return Math.round(expense / days);
}
