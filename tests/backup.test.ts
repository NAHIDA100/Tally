import { describe, expect, it } from 'vitest';

import {
  parseBackup,
  transactionsToCsv,
  transactionsToJson,
  type NameMaps,
} from '../src/logic/backup';
import type { Transaction } from '../src/types';

const maps: NameMaps = {
  categoryNameById: new Map([['cat-food', '餐饮']]),
  categoryIdByName: new Map([['餐饮', 'cat-food']]),
  accountNameById: new Map([
    ['acc-cash', '现金'],
    ['acc-bank', 'BankTest'],
  ]),
  accountIdByName: new Map([
    ['现金', 'acc-cash'],
    ['BankTest', 'acc-bank'],
  ]),
};

function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx1',
    type: 'expense',
    amount: 850,
    categoryId: 'cat-food',
    accountId: 'acc-cash',
    toAccountId: null,
    occurredAt: '2026-10-25T08:15:00.000Z',
    occurredDate: '2026-10-25',
    occurredMonth: '2026-10',
    note: '午饭',
    tags: [],
    createdAt: '2026-10-25T08:15:00.000Z',
    updatedAt: '2026-10-25T08:15:00.000Z',
    ...over,
  };
}

describe('CSV 往返', () => {
  it('金额以「元」写出，读回来仍是原来的「分」', () => {
    const csv = transactionsToCsv([tx()], maps);
    // 写出的是 8.50 而不是 850 或 850.00
    expect(csv).toContain('8.50');
    const { seeds, errors } = parseBackup(csv, maps);
    expect(errors).toEqual([]);
    expect(seeds[0].amount).toBe(850);
  });

  it('备注里的逗号与引号不会破坏列对齐', () => {
    const csv = transactionsToCsv([tx({ note: 'a,b "c"' })], maps);
    const { seeds, errors } = parseBackup(csv, maps);
    expect(errors).toEqual([]);
    expect(seeds[0].note).toBe('a,b "c"');
  });

  it('标签含特殊字符也能无损往返', () => {
    const csv = transactionsToCsv([tx({ tags: ['出差', 'a,b"c'] })], maps);
    expect(parseBackup(csv, maps).seeds[0].tags).toEqual(['出差', 'a,b"c']);
  });

  it('转账保留转入账户且不带头空分类', () => {
    const csv = transactionsToCsv([tx({ type: 'transfer', toAccountId: 'acc-bank', categoryId: null })], maps);
    const { seeds, errors } = parseBackup(csv, maps);
    expect(errors).toEqual([]);
    expect(seeds[0]).toMatchObject({ type: 'transfer', accountId: 'acc-cash', toAccountId: 'acc-bank', categoryId: null });
  });
});

describe('JSON 往返', () => {
  it('金额是整数分，读回来不能被再乘 100', () => {
    const json = transactionsToJson([tx()], maps);
    expect(json).toContain('"amount": 850');
    const { seeds, errors } = parseBackup(json, maps);
    expect(errors).toEqual([]);
    expect(seeds[0].amount).toBe(850);
  });

  it('id 丢失时靠名称匹配回来', () => {
    const json = JSON.stringify({
      version: 1,
      transactions: [
        { type: 'expense', amount: 100, categoryName: '餐饮', accountName: '现金', occurredAt: '2026-10-25T00:00:00.000Z' },
      ],
    });
    const { seeds, errors } = parseBackup(json, maps);
    expect(errors).toEqual([]);
    expect(seeds[0]).toMatchObject({ categoryId: 'cat-food', accountId: 'acc-cash' });
  });
});

describe('校验与报错', () => {
  it('表头缺必要列时整份拒绝', () => {
    const { seeds, errors } = parseBackup('foo,bar\n1,2', maps);
    expect(seeds).toEqual([]);
    expect(errors[0]).toContain('表头缺少必要列');
  });

  it('非法类型、金额、日期分别报错', () => {
    const csv = [
      'id,type,amount,category,account,toAccount,occurredAt,note,tags',
      'a,bogus,100,餐饮,现金,,2026-10-25T00:00:00.000Z,,[]',
      'b,expense,abc,餐饮,现金,,2026-10-25T00:00:00.000Z,,[]',
      'c,expense,100,餐饮,现金,,not-a-date,,[]',
    ].join('\r\n');
    const { seeds, errors } = parseBackup(csv, maps);
    expect(seeds).toHaveLength(0);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/类型|金额|日期/);
  });

  it('找不到账户时只丢那一行，其它行照常导入', () => {
    const csv = [
      'id,type,amount,category,account,toAccount,occurredAt,note,tags',
      'a,expense,100,餐饮,不存在的账户,,2026-10-25T00:00:00.000Z,,[]',
      'b,expense,200,餐饮,现金,,2026-10-25T00:00:00.000Z,,[]',
    ].join('\r\n');
    const { seeds, errors } = parseBackup(csv, maps);
    expect(seeds.map((s) => s.id)).toEqual(['b']);
    expect(errors[0]).toContain('不存在的账户');
  });

  it('转出与转入相同被拒', () => {
    const { errors } = parseBackup(
      transactionsToJson([tx({ type: 'transfer', toAccountId: 'acc-cash', categoryId: null })], maps),
      maps,
    );
    expect(errors[0]).toContain('相同');
  });

  it('坏 JSON 报可读错误而不是抛异常', () => {
    expect(() => parseBackup('{ nope', maps)).not.toThrow();
    expect(parseBackup('{ nope', maps).errors[0]).toContain('JSON');
  });
});
