import { describe, expect, it } from 'vitest';

import { computeBalance, netWorth, transferEffect, type AccountFlows } from '../src/logic/balance';

const zero: AccountFlows = {
  initialBalance: 0,
  received: 0,
  spent: 0,
  transferredIn: 0,
  transferredOut: 0,
};

describe('computeBalance', () => {
  it('初始余额加收入减支出', () => {
    expect(computeBalance({ ...zero, initialBalance: 100000, received: 50000, spent: 12500 })).toBe(
      137500,
    );
  });

  it('转账两端分别影响余额', () => {
    expect(computeBalance({ ...zero, transferredOut: 50000 })).toBe(-50000);
    expect(computeBalance({ ...zero, transferredIn: 50000 })).toBe(50000);
  });

  it('信用卡：刷出去的钱把余额带成负数，那个负数就是欠款', () => {
    expect(computeBalance({ ...zero, spent: 321456 })).toBe(-321456);
    expect(computeBalance({ ...zero, spent: 321456, received: 321456 })).toBe(0);
  });

  it('1000 笔 0.07 精确等于 70 元', () => {
    expect(computeBalance({ ...zero, spent: Array.from({ length: 1000 }, () => 7).reduce((a, b) => a + b, 0) })).toBe(
      -7000,
    );
  });
});

describe('transferEffect', () => {
  it('转账本身不产生盈亏：两端相加为 0', () => {
    const effect = transferEffect(123400);
    expect(effect).toEqual({ from: -123400, to: 123400 });
    expect(effect.from + effect.to).toBe(0);
  });

  it('一次转账在两个账户上的净效果互相抵消', () => {
    const amount = 88800;
    const from = computeBalance({ ...zero, initialBalance: 1000000, transferredOut: amount });
    const to = computeBalance({ ...zero, initialBalance: 0, transferredIn: amount });
    expect(from + to).toBe(1000000);
  });
});

describe('netWorth', () => {
  it('求和，含负余额', () => {
    expect(netWorth([100000, -30000, 5000])).toBe(75000);
  });

  it('空账户列表为 0', () => {
    expect(netWorth([])).toBe(0);
  });
});
