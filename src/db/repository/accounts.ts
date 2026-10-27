import type { SQLiteDatabase } from 'expo-sqlite';

import { computeBalance } from '@/src/logic/balance';
import type { Cents } from '@/src/logic/money';
import type { Account, AccountType } from '@/src/types';
import { newId } from '@/src/utils/id';

import { cents, type AccountBalanceRow, type AccountRow } from './rows';

const ACCOUNT_TYPES: AccountType[] = ['cash', 'bank', 'credit', 'ewallet'];

function map(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalance: row.initial_balance,
    icon: row.icon,
    color: row.color,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
  };
}

export interface AccountWithBalance extends Account {
  /** initialBalance + 收入流入 − 支出流出 + 转入 − 转出（转账不计入收支，但改变余额） */
  balance: Cents;
  transactionCount: number;
}

export async function listAccounts(db: SQLiteDatabase, includeArchived = false): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts ${includeArchived ? '' : 'WHERE is_archived = 0'}
      ORDER BY sort_order, name`,
  );
  return rows.map(map);
}

/**
 * 余额一次算完：把四类流向分开聚合，再在 JS 里合成。
 * 不在 SQL 里写成一长串 CASE 是因为转账同时涉及 account_id 与 to_account_id 两列，
 * 拆成两个子查询比一个巨型 CASE 更好读，也方便单独验证。
 */
export async function listAccountBalances(
  db: SQLiteDatabase,
  includeArchived = false,
): Promise<AccountWithBalance[]> {
  const rows = await db.getAllAsync<AccountBalanceRow>(
    `SELECT a.*,
            inc.total  AS received,
            exp.total  AS spent,
            tin.total  AS transferred_in,
            tout.total AS transferred_out,
            cnt.n      AS tx_count
       FROM accounts a
       LEFT JOIN (SELECT account_id, SUM(amount) total FROM transactions
                   WHERE type = 'income'  GROUP BY account_id) inc  ON inc.account_id  = a.id
       LEFT JOIN (SELECT account_id, SUM(amount) total FROM transactions
                   WHERE type = 'expense' GROUP BY account_id) exp  ON exp.account_id  = a.id
       LEFT JOIN (SELECT to_account_id, SUM(amount) total FROM transactions
                   WHERE type = 'transfer' GROUP BY to_account_id) tin ON tin.to_account_id = a.id
       LEFT JOIN (SELECT account_id, SUM(amount) total FROM transactions
                   WHERE type = 'transfer' GROUP BY account_id) tout ON tout.account_id = a.id
       LEFT JOIN (
         SELECT aid, COUNT(*) AS n FROM (
           SELECT account_id AS aid FROM transactions
           UNION ALL
           SELECT to_account_id AS aid FROM transactions WHERE to_account_id IS NOT NULL
         ) GROUP BY aid
       ) cnt ON cnt.aid = a.id
      ${includeArchived ? '' : 'WHERE a.is_archived = 0'}
      ORDER BY a.sort_order, a.name`,
  );

  return rows.map((row) => ({
    ...map(row),
    transactionCount: row.tx_count ?? 0,
    balance: computeBalance({
      initialBalance: row.initial_balance,
      received: cents(row.received),
      spent: cents(row.spent),
      transferredIn: cents(row.transferred_in),
      transferredOut: cents(row.transferred_out),
    }),
  }));
}

export async function createAccount(
  db: SQLiteDatabase,
  input: {
    name: string;
    type: AccountType;
    initialBalance: Cents;
    icon: string;
    color: string;
  },
): Promise<Account> {
  if (!input.name.trim()) throw new Error('请输入账户名称');
  if (!ACCOUNT_TYPES.includes(input.type)) throw new Error('账户类型不合法');
  const row = await db.getFirstAsync<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) AS m FROM accounts');
  const sortOrder = (row?.m ?? 0) + 1;
  const id = newId('acc');
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, initial_balance, icon, color, is_archived, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, input.name.trim(), input.type, input.initialBalance, input.icon, input.color, sortOrder],
  );
  const created = await getAccount(db, id);
  if (!created) throw new Error('写入后未能读回该账户');
  return created;
}

export async function getAccount(db: SQLiteDatabase, id: string): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>('SELECT * FROM accounts WHERE id = ?', id);
  return row ? map(row) : null;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  input: {
    name: string;
    type: AccountType;
    initialBalance: Cents;
    icon: string;
    color: string;
    isArchived: boolean;
  },
): Promise<void> {
  if (!input.name.trim()) throw new Error('请输入账户名称');
  const result = await db.runAsync(
    `UPDATE accounts
        SET name = ?, type = ?, initial_balance = ?, icon = ?, color = ?, is_archived = ?
      WHERE id = ?`,
    [
      input.name.trim(),
      input.type,
      input.initialBalance,
      input.icon,
      input.color,
      input.isArchived ? 1 : 0,
      id,
    ],
  );
  if (result.changes === 0) throw new Error('要修改的账户不存在');
}

/** 账户被流水引用时不允许真删，只能归档——历史账目要一直看得懂 */
export async function deleteAccount(db: SQLiteDatabase, id: string): Promise<void> {
  const usage = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ? OR to_account_id = ?',
    id,
    id,
  );
  if ((usage?.n ?? 0) > 0) {
    throw new Error('该账户下已有流水，请改为归档');
  }
  await db.runAsync('DELETE FROM accounts WHERE id = ?', id);
}

export async function reorderAccounts(db: SQLiteDatabase, orderedIds: string[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [index, id] of orderedIds.entries()) {
      await txn.runAsync('UPDATE accounts SET sort_order = ? WHERE id = ?', index + 1, id);
    }
  });
}
