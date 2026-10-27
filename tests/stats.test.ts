import { describe, expect, it } from 'vitest';

import {
  averageDailyExpense,
  balanceDelta,
  groupByDay,
  summarize,
  withShares,
  type MoneyItem,
} from '../src/logic/stats';

function item(over: Partial<MoneyItem> & Pick<MoneyItem, 'occurredDate' | 'type' | 'amount'>): MoneyItem {
  return over;
}

describe('groupByDay', () => {
  it('按日分组并倒排，同时算出当日收支与结余', () => {
    const groups = groupByDay([
      item({ occurredDate: '2026-10-24', type: 'expense', amount: 1200 }),
      item({ occurredDate: '2026-10-25', type: 'expense', amount: 500 }),
      item({ occurredDate: '2026-10-25', type: 'income', amount: 8000 }),
    ]);

    expect(groups.map((g) => g.day)).toEqual(['2026-10-25', '2026-10-24']);
    expect(groups[0]).toMatchObject({ income: 8000, expense: 500, net: 7500 });
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1]).toMatchObject({ income: 0, expense: 1200, net: -1200 });
  });

  it('转账不进收支，但保留在明细里', () => {
    const groups = groupByDay([
      item({ occurredDate: '2026-10-25', type: 'transfer', amount: 999900 }),
      item({ occurredDate: '2026-10-25', type: 'expense', amount: 100 }),
    ]);
    expect(groups[0]).toMatchObject({ income: 0, expense: 100, net: -100 });
    expect(groups[0].items).toHaveLength(2);
  });

  it('组内顺序沿用输入顺序，不额外排序', () => {
    const a = item({ occurredDate: '2026-10-25', type: 'expense', amount: 300 });
    const b = item({ occurredDate: '2026-10-25', type: 'expense', amount: 100 });
    expect(groupByDay([a, b])[0].items.map((i) => i.amount)).toEqual([300, 100]);
  });

  it('空输入不产出分组', () => {
    expect(groupByDay([])).toEqual([]);
  });

  it('跨月与跨年按字符串序即可正确倒排', () => {
    const groups = groupByDay([
      item({ occurredDate: '2025-12-31', type: 'expense', amount: 1 }),
      item({ occurredDate: '2026-01-01', type: 'expense', amount: 1 }),
      item({ occurredDate: '2025-11-30', type: 'expense', amount: 1 }),
    ]);
    expect(groups.map((g) => g.day)).toEqual(['2026-01-01', '2025-12-31', '2025-11-30']);
  });

  it('大额累加不丢精度（全是整数分）', () => {
    const groups = groupByDay(
      Array.from({ length: 1000 }, () => item({ occurredDate: '2026-10-25', type: 'expense', amount: 7 })),
    );
    expect(groups[0].expense).toBe(7000);
  });
});

describe('summarize', () => {
  it('分别合计收入与支出，转账单独计数', () => {
    expect(
      summarize([
        item({ occurredDate: '2026-10-25', type: 'income', amount: 2430000 }),
        item({ occurredDate: '2026-10-25', type: 'expense', amount: 1162000 }),
        item({ occurredDate: '2026-10-25', type: 'transfer', amount: 500000 }),
      ]),
    ).toEqual({ income: 2430000, expense: 1162000, net: 1268000, transferCount: 1 });
  });

  it('空列表给出全 0 而不是 undefined', () => {
    expect(summarize([])).toEqual({ income: 0, expense: 0, net: 0, transferCount: 0 });
  });
});

describe('balanceDelta', () => {
  it('支出为负、收入为正、转账为 0', () => {
    expect(balanceDelta('expense', 1234)).toBe(-1234);
    expect(balanceDelta('income', 1234)).toBe(1234);
    expect(balanceDelta('transfer', 1234)).toBe(0);
  });
});

describe('withShares', () => {
  it('按占比补 percent，保留一位小数', () => {
    // 总额凑成 1,000,000 分（1 万元），期望值一眼可验
    const shares = withShares([
      { total: 400000 },
      { total: 300000 },
      { total: 200000 },
      { total: 100000 },
    ]);
    expect(shares.map((s) => s.percent)).toEqual([40, 30, 20, 10]);
  });

  it('除不尽时仍保留一位小数而不是浮点长尾', () => {
    const shares = withShares([{ total: 100 }, { total: 200 }]);
    expect(shares[0].percent).toBe(33.3);
    expect(shares[1].percent).toBe(66.7);
  });

  it('总额为 0 时全部记 0，不产生 NaN', () => {
    const shares = withShares([{ total: 0 }, { total: 0 }]);
    expect(shares.map((s) => s.percent)).toEqual([0, 0]);
    expect(withShares([])).toEqual([]);
  });

  it('保留原对象上的其它字段', () => {
    expect(withShares([{ total: 500, name: '餐饮' }])).toEqual([{ total: 500, name: '餐饮', percent: 100 }]);
  });
});

describe('averageDailyExpense', () => {
  it('过去的月份按整月天数', () => {
    // 2026-10 有 31 天
    expect(averageDailyExpense(310000, '2026-10', '2026-11-15')).toBe(10000);
  });

  it('当月按已过天数，避免月初看起来异常省', () => {
    // 1000 元花到当月第 10 天 → 每天 100 元
    expect(averageDailyExpense(100000, '2026-10', '2026-10-10')).toBe(10000);
    expect(averageDailyExpense(100000, '2026-10', '2026-10-31')).toBe(3226);
  });

  it('闰年 2 月按 29 天', () => {
    expect(averageDailyExpense(290000, '2024-02', '2024-03-01')).toBe(10000);
  });

  it('没有支出就是 0', () => {
    expect(averageDailyExpense(0, '2026-10', '2026-10-05')).toBe(0);
  });
});
