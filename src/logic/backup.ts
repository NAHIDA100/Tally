import { parseCsv, toCsv } from './csv';
import { centsToPlainString, parseAmountLoose, type Cents } from './money';
import type { Transaction, TransactionType } from '@/src/types';

export const CSV_COLUMNS = [
  'id',
  'type',
  'amount',
  'category',
  'account',
  'toAccount',
  'occurredAt',
  'note',
  'tags',
] as const;

/**
 * 名称与 id 的双向表由调用方（屏幕层）从数据库取好后传进来，
 * 这样这个文件保持纯函数、可以在 node 里单测。
 */
export interface NameMaps {
  categoryNameById: ReadonlyMap<string, string>;
  categoryIdByName: ReadonlyMap<string, string>;
  accountNameById: ReadonlyMap<string, string>;
  accountIdByName: ReadonlyMap<string, string>;
}

const TYPES: readonly TransactionType[] = ['expense', 'income', 'transfer'];

/** 导入用的中间形状：还没补 occurredDate/occurredMonth，那是 repository 的活 */
export interface TransactionSeed {
  id: string;
  type: TransactionType;
  amount: Cents;
  categoryId: string | null;
  accountId: string;
  toAccountId: string | null;
  occurredAt: string;
  note: string;
  tags: string[];
}

export interface ParseResult {
  seeds: TransactionSeed[];
  errors: string[];
}

function tagsOf(tags: string[]): string {
  // 用 JSON 而不是逗号/竖线拼接：标签本身可以包含任意字符，JSON 能无损往返
  return JSON.stringify(tags);
}

function parseTags(raw: string): string[] {
  if (raw.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function transactionsToCsv(rows: readonly Transaction[], maps: NameMaps): string {
  return toCsv(
    CSV_COLUMNS,
    rows.map((row) => [
      row.id,
      row.type,
      centsToPlainString(row.amount),
      row.categoryId ? maps.categoryNameById.get(row.categoryId) ?? '' : '',
      maps.accountNameById.get(row.accountId) ?? '',
      row.toAccountId ? maps.accountNameById.get(row.toAccountId) ?? '' : '',
      row.occurredAt,
      row.note,
      tagsOf(row.tags),
    ]),
  );
}

/** JSON 导出保留 id 与名称两份信息：id 供同机还原，名称供换机/改过名后匹配 */
export function transactionsToJson(rows: readonly Transaction[], maps: NameMaps): string {
  const payload = rows.map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.categoryId,
    categoryName: row.categoryId ? maps.categoryNameById.get(row.categoryId) ?? null : null,
    accountId: row.accountId,
    accountName: maps.accountNameById.get(row.accountId) ?? null,
    toAccountId: row.toAccountId,
    toAccountName: row.toAccountId ? maps.accountNameById.get(row.toAccountId) ?? null : null,
    occurredAt: row.occurredAt,
    note: row.note,
    tags: row.tags,
  }));
  return JSON.stringify({ version: 1, transactions: payload }, null, 2);
}

function resolve(name: string, id: string, byName: ReadonlyMap<string, string>): string | null {
  const trimmed = name.trim();
  if (trimmed !== '') {
    const matched = byName.get(trimmed);
    if (matched) return matched;
  }
  return id.trim() === '' ? null : id.trim();
}

/** JSON 里的金额必须本来就是正整数分；不做任何单位猜测 */
function jsonCents(value: unknown): Cents | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function seedFrom(
  fields: {
    id: string;
    type: string;
    /** 已经换算成整数分；CSV 走 parseAmountLoose，JSON 直接用整数，两条路径不能混 */
    amountCents: Cents | null;
    amountRaw: string;
    category: string;
    categoryId: string;
    account: string;
    accountId: string;
    toAccount: string;
    toAccountId: string;
    occurredAt: string;
    note: string;
    tags: string;
  },
  maps: NameMaps,
  lineLabel: string,
  errors: string[],
): TransactionSeed | null {
  const type = fields.type.trim() as TransactionType;
  if (!TYPES.includes(type)) {
    errors.push(`${lineLabel}：类型「${fields.type}」不合法`);
    return null;
  }

  if (fields.amountCents === null || fields.amountCents <= 0) {
    errors.push(`${lineLabel}：金额「${fields.amountRaw}」不合法`);
    return null;
  }
  const amount = fields.amountCents;

  const occurredAt = new Date(fields.occurredAt.trim());
  if (Number.isNaN(occurredAt.getTime())) {
    errors.push(`${lineLabel}：日期「${fields.occurredAt}」无法解析`);
    return null;
  }

  const accountId = resolve(fields.account, fields.accountId, maps.accountIdByName);
  if (!accountId) {
    errors.push(`${lineLabel}：找不到账户「${fields.account || fields.accountId}」`);
    return null;
  }

  if (type === 'transfer') {
    const toAccountId = resolve(fields.toAccount, fields.toAccountId, maps.accountIdByName);
    if (!toAccountId) {
      errors.push(`${lineLabel}：转账缺少有效的转入账户`);
      return null;
    }
    if (toAccountId === accountId) {
      errors.push(`${lineLabel}：转出与转入账户相同`);
      return null;
    }
    return {
      id: fields.id.trim(),
      type,
      amount,
      categoryId: null,
      accountId,
      toAccountId,
      occurredAt: occurredAt.toISOString(),
      note: fields.note,
      tags: parseTags(fields.tags),
    };
  }

  const categoryId = resolve(fields.category, fields.categoryId, maps.categoryIdByName);
  if (!categoryId) {
    errors.push(`${lineLabel}：找不到分类「${fields.category || fields.categoryId}」`);
    return null;
  }
  return {
    id: fields.id.trim(),
    type,
    amount,
    categoryId,
    accountId,
    toAccountId: null,
    occurredAt: occurredAt.toISOString(),
    note: fields.note,
    tags: parseTags(fields.tags),
  };
}

function headerIndex(header: readonly string[], column: string): number {
  return header.indexOf(column);
}

function parseCsvBackup(text: string, maps: NameMaps, errors: string[]): TransactionSeed[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    errors.push('文件是空的');
    return [];
  }

  const header = rows[0].map((cell) => cell.trim());
  const missing = (['type', 'amount', 'account', 'occurredAt'] as const).filter(
    (column) => !header.includes(column),
  );
  if (missing.length > 0) {
    errors.push(`表头缺少必要列：${missing.join('、')}`);
    return [];
  }

  const cell = (row: string[], column: string) => {
    const index = headerIndex(header, column);
    return index >= 0 ? (row[index] ?? '') : '';
  };

  const seeds: TransactionSeed[] = [];
  rows.slice(1).forEach((row, offset) => {
    const lineLabel = `第 ${offset + 2} 行`;
    const seed = seedFrom(
      {
        id: cell(row, 'id'),
        type: cell(row, 'type'),
        amountRaw: cell(row, 'amount'),
        amountCents: parseAmountLoose(cell(row, 'amount')),
        category: cell(row, 'category'),
        categoryId: cell(row, 'categoryId'),
        account: cell(row, 'account'),
        accountId: cell(row, 'accountId'),
        toAccount: cell(row, 'toAccount'),
        toAccountId: cell(row, 'toAccountId'),
        occurredAt: cell(row, 'occurredAt'),
        note: cell(row, 'note'),
        tags: cell(row, 'tags'),
      },
      maps,
      lineLabel,
      errors,
    );
    if (seed) seeds.push(seed);
  });
  return seeds;
}

interface JsonRecord {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  categoryId?: unknown;
  categoryName?: unknown;
  accountId?: unknown;
  accountName?: unknown;
  toAccountId?: unknown;
  toAccountName?: unknown;
  occurredAt?: unknown;
  note?: unknown;
  tags?: unknown;
}

function parseJsonBackup(text: string, maps: NameMaps, errors: string[]): TransactionSeed[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    errors.push('JSON 无法解析');
    return [];
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { transactions?: unknown }).transactions)
      ? (parsed as { transactions: unknown[] }).transactions
      : null;

  if (!list) {
    errors.push('JSON 里找不到 transactions 数组');
    return [];
  }

  const asString = (value: unknown) => (typeof value === 'string' ? value : '');
  const seeds: TransactionSeed[] = [];

  list.forEach((entry, offset) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`第 ${offset + 1} 条记录不是对象`);
      return;
    }
    const record = entry as JsonRecord;
    // JSON 的 amount 是整数分，不能再过一遍 parseAmountLoose（那会把它当「元」再乘 100）
    const seed = seedFrom(
      {
        id: asString(record.id),
        type: asString(record.type),
        amountRaw: String(record.amount ?? ''),
        amountCents: jsonCents(record.amount),
        category: asString(record.categoryName),
        categoryId: asString(record.categoryId),
        account: asString(record.accountName),
        accountId: asString(record.accountId),
        toAccount: asString(record.toAccountName),
        toAccountId: asString(record.toAccountId),
        occurredAt: asString(record.occurredAt),
        note: asString(record.note),
        tags: Array.isArray(record.tags) ? JSON.stringify(record.tags) : asString(record.tags),
      },
      maps,
      `第 ${offset + 1} 条`,
      errors,
    );
    if (seed) seeds.push(seed);
  });

  return seeds;
}

/** 自动识别 CSV / JSON，两种格式走同一套校验与错误收集 */
export function parseBackup(text: string, maps: NameMaps): ParseResult {
  const errors: string[] = [];
  const trimmed = text.replace(/^/, '').trimStart();
  const seeds =
    trimmed.startsWith('{') || trimmed.startsWith('[')
      ? parseJsonBackup(text, maps, errors)
      : parseCsvBackup(text, maps, errors);
  return { seeds, errors };
}
