import { describe, expect, it } from 'vitest';

import {
  categoryBudgetViews,
  clampedRatio,
  computeBudgetProgress,
  overspendSummary,
} from '../src/logic/budget';

describe('computeBudgetProgress', () => {
  it('未超支时 remaining 为正', () => {
    const p = computeBudgetProgress(100000, 40000);
    expect(p).toMatchObject({ limit: 100000, spent: 40000, remaining: 60000, isOver: false });
    expect(p.ratio).toBeCloseTo(0.4);
  });

  it('刚好用完不算超支', () => {
    expect(computeBudgetProgress(100000, 100000)).toMatchObject({ remaining: 0, isOver: false });
  });

  it('超支时 remaining 为负、ratio 大于 1', () => {
    const p = computeBudgetProgress(100000, 130000);
    expect(p.remaining).toBe(-30000);
    expect(p.isOver).toBe(true);
    expect(p.ratio).toBeCloseTo(1.3);
  });

  it('预算为 0 不产生除零', () => {
    expect(computeBudgetProgress(0, 5000)).toEqual({
      limit: 0,
      spent: 5000,
      remaining: 0,
      ratio: 0,
      isOver: false,
    });
  });

  it('负数预算按 0 处理', () => {
    expect(computeBudgetProgress(-100, 50).limit).toBe(0);
  });
});

describe('categoryBudgetViews', () => {
  it('没花过钱的分类保留为 0，而不是消失', () => {
    const views = categoryBudgetViews(
      [{ categoryId: 'a', limit: 10000 }],
      [],
    );
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ categoryId: 'a', spent: 0, isOver: false });
  });

  it('有支出但没设预算的分类不出现在预算页', () => {
    expect(categoryBudgetViews([], [{ categoryId: 'a', total: 999 }])).toEqual([]);
  });

  it('按接近超支的程度倒序', () => {
    const views = categoryBudgetViews(
      [
        { categoryId: 'low', limit: 100000 },
        { categoryId: 'over', limit: 10000 },
        { categoryId: 'mid', limit: 20000 },
      ],
      [
        { categoryId: 'low', total: 10000 },
        { categoryId: 'over', total: 15000 },
        { categoryId: 'mid', total: 15000 },
      ],
    );
    expect(views.map((v) => v.categoryId)).toEqual(['over', 'mid', 'low']);
  });

  it('同一分类多条预算不会把支出算两遍', () => {
    const views = categoryBudgetViews(
      [
        { categoryId: 'a', limit: 1000 },
        { categoryId: 'a', limit: 2000 },
      ],
      [{ categoryId: 'a', total: 500 }],
    );
    expect(views.every((v) => v.spent === 500)).toBe(true);
  });
});

describe('clampedRatio', () => {
  it('超支时夹到 1，供进度条画满', () => {
    expect(clampedRatio(computeBudgetProgress(100000, 250000))).toBe(1);
  });

  it('未超支时保持原比例', () => {
    expect(clampedRatio(computeBudgetProgress(100000, 25000))).toBeCloseTo(0.25);
  });
});

describe('overspendSummary', () => {
  it('统计超支条数与超出金额合计', () => {
    const views = categoryBudgetViews(
      [
        { categoryId: 'a', limit: 10000 },
        { categoryId: 'b', limit: 20000 },
        { categoryId: 'c', limit: 30000 },
      ],
      [
        { categoryId: 'a', total: 15000 },
        { categoryId: 'b', total: 5000 },
        { categoryId: 'c', total: 30100 },
      ],
    );
    expect(overspendSummary(views)).toEqual({ overCount: 2, overAmount: 5100 });
  });

  it('全部正常时为 0', () => {
    const views = categoryBudgetViews([{ categoryId: 'a', limit: 10000 }], [{ categoryId: 'a', total: 1 }]);
    expect(overspendSummary(views)).toEqual({ overCount: 0, overAmount: 0 });
  });
});
