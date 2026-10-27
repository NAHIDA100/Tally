import type { Cents } from './money';

export interface BudgetProgress {
  limit: Cents;
  spent: Cents;
  /** 可为负，表示超支了多少 */
  remaining: Cents;
  /** spent / limit，用于进度条宽度；limit 为 0 时返回 0 */
  ratio: number;
  isOver: boolean;
}

/**
 * 单条预算的执行情况。
 *
 * ratio 不夹到 1：进度条自己决定怎么画（超支时通常画满并变色），
 * 而界面还需要知道「超了多少」，夹掉就丢信息了。
 */
export function computeBudgetProgress(limit: Cents, spent: Cents): BudgetProgress {
  const safeLimit = limit > 0 ? limit : 0;
  // 没有预算时整条记录都是退化状态：不报差额、不算超支，
  // 否则调用方会把「未设预算」渲染成「还差 -5000」。
  if (safeLimit === 0) {
    return { limit: 0, spent, remaining: 0, ratio: 0, isOver: false };
  }
  return {
    limit: safeLimit,
    spent,
    remaining: safeLimit - spent,
    ratio: spent / safeLimit,
    isOver: spent > safeLimit,
  };
}

export interface CategoryBudgetInput {
  categoryId: string;
  limit: Cents;
}

export interface SpentInput {
  categoryId: string;
  total: Cents;
}

export interface CategoryBudgetView extends BudgetProgress {
  categoryId: string;
}

/**
 * 把「分类预算」和「分类实际支出」合成视图。
 *
 * 没设预算但有支出的分类不会凭空出现（预算页只关心设了预算的项），
 * 但设了预算还没花的分类要保留，否则用户会以为设置没生效。
 *
 * 按 ratio 倒序：最接近超支的排最前，这正是用户打开预算页时最想先看到的东西。
 */
export function categoryBudgetViews(
  budgets: readonly CategoryBudgetInput[],
  spentByCategory: readonly SpentInput[],
): CategoryBudgetView[] {
  const spentMap = new Map(spentByCategory.map((row) => [row.categoryId, row.total]));
  return budgets
    .map((budget) => {
      const spent = spentMap.get(budget.categoryId) ?? 0;
      return { categoryId: budget.categoryId, ...computeBudgetProgress(budget.limit, spent) };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** 进度条用的 0–1 夹取值；显示层专用 */
export function clampedRatio(progress: BudgetProgress): number {
  if (progress.limit === 0) return 0;
  return Math.min(1, Math.max(0, progress.ratio));
}

export interface OverspendSummary {
  overCount: number;
  /** 超支金额合计（正数） */
  overAmount: Cents;
}

/** 首页/账单页用的一句话提醒 */
export function overspendSummary(views: readonly CategoryBudgetView[]): OverspendSummary {
  let overCount = 0;
  let overAmount: Cents = 0;
  for (const view of views) {
    if (view.isOver) {
      overCount += 1;
      overAmount += view.spent - view.limit;
    }
  }
  return { overCount, overAmount };
}
