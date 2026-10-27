import type { SQLiteDatabase } from 'expo-sqlite';

import type { TransactionSeed } from '@/src/logic/backup';
import { addMonths, dayKeyOf, monthKeyOf, toStoredIso } from '@/src/logic/date';
import type { MonthKey } from '@/src/logic/date';
import type {
  Transaction,
  TransactionDraft,
  TransactionFilter,
  TransactionType,
  TransactionWithRefs,
} from '@/src/types';
import { newId } from '@/src/utils/id';

import { cents, type TransactionRefRow } from './rows';

const SELECT_WITH_REFS = `
  SELECT t.*,
         c.name  AS category_name,
         c.icon  AS category_icon,
         c.color AS category_color,
         a.name  AS account_name,
         a.icon  AS account_icon,
         a.color AS account_color,
         ta.name AS to_account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts   a ON a.id = t.account_id
    LEFT JOIN accounts  ta ON ta.id = t.to_account_id`;

/** 转账没有分类、非转账必须有分类：这条规则在 UI 和 CHECK 约束之外再挡一次，
 *  为的是给出能读懂的中文错误，而不是 SQLite 的 CHECK constraint failed。 */
function validate(draft: TransactionDraft): void {
  if (draft.type === 'transfer') {
    if (!draft.toAccountId) throw new Error('转账必须选择转入账户');
    if (draft.toAccountId === draft.accountId) throw new Error('转出与转入账户不能相同');
  } else if (!draft.categoryId) {
    throw new Error('请选择分类');
  }
  if (draft.amount <= 0) throw new Error('金额必须大于 0');
}

function valuesFor(draft: TransactionDraft, id: string, nowIso: string) {
  const occurredAt = draft.occurredAt;
  return [
    id,
    draft.type,
    draft.amount,
    draft.type === 'transfer' ? null : draft.categoryId,
    draft.accountId,
    draft.type === 'transfer' ? draft.toAccountId : null,
    toStoredIso(occurredAt),
    dayKeyOf(occurredAt),
    monthKeyOf(occurredAt),
    draft.note,
    JSON.stringify(draft.tags),
    nowIso,
    nowIso,
  ];
}

function mapRow(row: TransactionRefRow): TransactionWithRefs {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    occurredAt: row.occurred_at,
    occurredDate: row.occurred_date,
    occurredMonth: row.occurred_month,
    note: row.note,
    tags: parseTags(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    accountName: row.account_name,
    accountIcon: row.account_icon,
    accountColor: row.account_color,
    toAccountName: row.to_account_name,
  };
}

/** 标签列是用户可写的 JSON，坏数据不该让整个列表崩掉 */
function parseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export async function createTransaction(
  db: SQLiteDatabase,
  draft: TransactionDraft,
): Promise<TransactionWithRefs> {
  validate(draft);
  const id = draft.id ?? newId('tx');
  const nowIso = toStoredIso(new Date());
  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount, category_id, account_id, to_account_id,
        occurred_at, occurred_date, occurred_month, note, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valuesFor(draft, id, nowIso),
  );
  const created = await getTransaction(db, id);
  if (!created) throw new Error('写入后未能读回该笔记录');
  return created;
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: string,
  draft: TransactionDraft,
): Promise<void> {
  validate(draft);
  const nowIso = toStoredIso(new Date());
  // valuesFor 的第 0 项是 id、最后两项是 created_at/updated_at；
  // UPDATE 只需要中间 10 个业务字段，再把 updated_at 与 WHERE 的 id 接回末尾。
  const values = valuesFor(draft, id, nowIso).slice(1, 11);
  const result = await db.runAsync(
    `UPDATE transactions
        SET type = ?, amount = ?, category_id = ?, account_id = ?, to_account_id = ?,
            occurred_at = ?, occurred_date = ?, occurred_month = ?, note = ?, tags = ?,
            updated_at = ?
      WHERE id = ?`,
    [...values, nowIso, id],
  );
  if (result.changes === 0) {
    throw new Error('要修改的记录不存在');
  }
}

export async function deleteTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

/** 撤销删除用：按原 id 原样插回 */
export async function restoreTransaction(db: SQLiteDatabase, tx: Transaction): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO transactions
       (id, type, amount, category_id, account_id, to_account_id,
        occurred_at, occurred_date, occurred_month, note, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tx.id,
      tx.type,
      tx.amount,
      tx.categoryId,
      tx.accountId,
      tx.toAccountId,
      tx.occurredAt,
      tx.occurredDate,
      tx.occurredMonth,
      tx.note,
      JSON.stringify(tx.tags),
      tx.createdAt,
      tx.updatedAt,
    ],
  );
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: string,
): Promise<TransactionWithRefs | null> {
  const row = await db.getFirstAsync<TransactionRefRow>(`${SELECT_WITH_REFS} WHERE t.id = ?`, id);
  return row ? mapRow(row) : null;
}

/**
 * 转义 LIKE 的通配符，否则用户搜「100%」会匹配到所有备注。
 */
function likePattern(keyword: string): string {
  const escaped = keyword.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${escaped}%`;
}

export async function listTransactions(
  db: SQLiteDatabase,
  filter: TransactionFilter,
): Promise<TransactionWithRefs[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filter.from && filter.to) {
    where.push('t.occurred_date BETWEEN ? AND ?');
    params.push(filter.from, filter.to);
  } else if (filter.month) {
    where.push('t.occurred_month = ?');
    params.push(filter.month);
  }
  if (filter.categoryId) {
    where.push('t.category_id = ?');
    params.push(filter.categoryId);
  }
  if (filter.accountId) {
    where.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.types?.length) {
    where.push(`t.type IN (${filter.types.map(() => '?').join(', ')})`);
    params.push(...filter.types);
  }
  if (filter.keyword) {
    // tags 是 JSON 文本，直接 LIKE 即可满足「按关键词搜标签」
    where.push("(t.note LIKE ? ESCAPE '\\' OR t.tags LIKE ? ESCAPE '\\')");
    const pattern = likePattern(filter.keyword);
    params.push(pattern, pattern);
  }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const rows = await db.getAllAsync<TransactionRefRow>(
    `${SELECT_WITH_REFS}${clause}
      ORDER BY t.occurred_at DESC, t.id DESC`,
    params,
  );
  return rows.map(mapRow);
}

export interface MonthSummary {
  income: number;
  expense: number;
  /** 收入 − 支出；转账不参与 */
  net: number;
  count: number;
}

export async function getMonthSummary(db: SQLiteDatabase, month: MonthKey): Promise<MonthSummary> {
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null; count: number }>(
    `SELECT SUM(CASE WHEN type = 'income' THEN amount END)  AS income,
            SUM(CASE WHEN type = 'expense' THEN amount END) AS expense,
            COUNT(*) AS count
       FROM transactions
      WHERE occurred_month = ?`,
    month,
  );
  const income = cents(row?.income);
  const expense = cents(row?.expense);
  return { income, expense, net: income - expense, count: row?.count ?? 0 };
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
}

export async function getCategoryTotals(
  db: SQLiteDatabase,
  month: MonthKey,
  type: TransactionType,
): Promise<CategoryTotal[]> {
  const rows = await db.getAllAsync<{
    category_id: string | null;
    name: string;
    icon: string;
    color: string;
    total: number;
    count: number;
  }>(
    `SELECT t.category_id, c.name, c.icon, c.color,
            SUM(t.amount) AS total, COUNT(*) AS count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE t.occurred_month = ? AND t.type = ?
      GROUP BY t.category_id
      ORDER BY total DESC`,
    month,
    type,
  );
  return rows
    .filter((r) => r.category_id !== null)
    .map((r) => ({
      categoryId: r.category_id as string,
      name: r.name,
      icon: r.icon,
      color: r.color,
      total: cents(r.total),
      count: r.count,
    }));
}

export interface MonthTotal {
  month: MonthKey;
  income: number;
  expense: number;
}

/** 近 N 个月趋势；没有流水的月份补 0，否则折线会缺横坐标 */
export async function getMonthTotals(
  db: SQLiteDatabase,
  months: MonthKey[],
): Promise<MonthTotal[]> {
  if (months.length === 0) return [];
  const placeholders = months.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{
    occurred_month: MonthKey;
    income: number | null;
    expense: number | null;
  }>(
    `SELECT occurred_month,
            SUM(CASE WHEN type = 'income' THEN amount END)  AS income,
            SUM(CASE WHEN type = 'expense' THEN amount END) AS expense
       FROM transactions
      WHERE occurred_month IN (${placeholders}) AND type != 'transfer'
      GROUP BY occurred_month`,
    months,
  );
  const byMonth = new Map(rows.map((r) => [r.occurred_month, r]));
  return months.map((month) => ({
    month,
    income: cents(byMonth.get(month)?.income),
    expense: cents(byMonth.get(month)?.expense),
  }));
}

/** 记一笔页的「常用分类」：近两个月内该类型下笔数最多的分类 */
export async function getFrequentCategories(
  db: SQLiteDatabase,
  type: TransactionType,
  currentMonth: MonthKey,
  limit = 8,
): Promise<CategoryTotal[]> {
  const since = addMonths(currentMonth, -1);
  const rows = await db.getAllAsync<{
    category_id: string;
    name: string;
    icon: string;
    color: string;
    total: number;
    count: number;
  }>(
    `SELECT t.category_id, c.name, c.icon, c.color,
            SUM(t.amount) AS total, COUNT(*) AS count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
      WHERE t.type = ? AND t.occurred_month IN (?, ?)
      GROUP BY t.category_id
      ORDER BY count DESC, MAX(t.occurred_at) DESC
      LIMIT ?`,
    type,
    since,
    currentMonth,
    limit,
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    total: cents(r.total),
    count: r.count,
  }));
}

/**
 * 导入用：整批在一个事务里写，重复 id 跳过而不是报错。
 * 「还原」场景下重复执行同一份文件应当是幂等的。
 */
export async function importSeeds(
  db: SQLiteDatabase,
  seeds: readonly TransactionSeed[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  const nowIso = toStoredIso(new Date());

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const seed of seeds) {
      const occurredAt = new Date(seed.occurredAt);
      const result = await txn.runAsync(
        `INSERT OR IGNORE INTO transactions
           (id, type, amount, category_id, account_id, to_account_id,
            occurred_at, occurred_date, occurred_month, note, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seed.id || newId('tx'),
          seed.type,
          seed.amount,
          seed.categoryId,
          seed.accountId,
          seed.toAccountId,
          seed.occurredAt,
          dayKeyOf(occurredAt),
          monthKeyOf(occurredAt),
          seed.note,
          JSON.stringify(seed.tags),
          nowIso,
          nowIso,
        ],
      );
      if (result.changes > 0) inserted += 1;
      else skipped += 1;
    }
  });

  return { inserted, skipped };
}

export async function countTransactionsByCategory(
  db: SQLiteDatabase,
  categoryId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
    categoryId,
  );
  return row?.n ?? 0;
}

export async function countTransactionsByAccount(db: SQLiteDatabase, accountId: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR to_account_id = ?',
    accountId,
    accountId,
  );
  return row?.n ?? 0;
}
