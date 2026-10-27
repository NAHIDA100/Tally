import type { SQLiteDatabase } from 'expo-sqlite';

import { TOTAL_BUDGET_CATEGORY_ID } from '@/src/db/migrations';
import type { Cents } from '@/src/logic/money';
import type { MonthKey } from '@/src/logic/date';
import type { Budget } from '@/src/types';
import { newId } from '@/src/utils/id';

import type { BudgetRow } from './rows';

function map(row: BudgetRow): Budget {
  return {
    id: row.id,
    yearMonth: row.year_month,
    // 库里用 '' 而不是 NULL 表示总预算，见 migrations 里的注释
    categoryId: row.category_id === TOTAL_BUDGET_CATEGORY_ID ? null : row.category_id,
    amount: row.amount,
  };
}

export async function listBudgets(db: SQLiteDatabase, month: MonthKey): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    'SELECT * FROM budgets WHERE year_month = ? ORDER BY category_id',
    month,
  );
  return rows.map(map);
}

/** 同一 (yearMonth, categoryId) 只保留一条：存在即改额，不做重复插入 */
export async function upsertBudget(
  db: SQLiteDatabase,
  month: MonthKey,
  categoryId: string | null,
  amount: Cents,
): Promise<Budget> {
  if (amount <= 0) throw new Error('预算金额必须大于 0');
  const key = categoryId ?? TOTAL_BUDGET_CATEGORY_ID;
  const existing = await db.getFirstAsync<BudgetRow>(
    'SELECT * FROM budgets WHERE year_month = ? AND category_id = ?',
    month,
    key,
  );
  if (existing) {
    await db.runAsync('UPDATE budgets SET amount = ? WHERE id = ?', amount, existing.id);
    return map({ ...existing, amount });
  }
  const row: BudgetRow = { id: newId('bud'), year_month: month, category_id: key, amount };
  await db.runAsync(
    'INSERT INTO budgets (id, year_month, category_id, amount) VALUES (?, ?, ?, ?)',
    [row.id, row.year_month, row.category_id, row.amount],
  );
  return map(row);
}

export async function deleteBudget(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE id = ?', id);
}

/** 上个月复制预算用：记账 App 的常见诉求，避免每月重设一遍 */
export async function copyBudgetsFromPreviousMonth(
  db: SQLiteDatabase,
  from: MonthKey,
  to: MonthKey,
): Promise<number> {
  const rows = await db.getAllAsync<BudgetRow>('SELECT * FROM budgets WHERE year_month = ?', from);
  let copied = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const row of rows) {
      const clash = await txn.getFirstAsync<{ id: string }>(
        'SELECT id FROM budgets WHERE year_month = ? AND category_id = ?',
        to,
        row.category_id,
      );
      if (clash) {
        await txn.runAsync('UPDATE budgets SET amount = ? WHERE id = ?', row.amount, clash.id);
      } else {
        await txn.runAsync(
          'INSERT INTO budgets (id, year_month, category_id, amount) VALUES (?, ?, ?, ?)',
          [newId('bud'), to, row.category_id, row.amount],
        );
        copied += 1;
      }
    }
  });
  return copied;
}
