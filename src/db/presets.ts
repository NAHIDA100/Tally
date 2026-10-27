import type { Account, Category } from '@/src/types';

/**
 * 预置数据的 id 是固定字符串，配合 INSERT OR IGNORE 让种子过程幂等：
 * 二次启动、或用户删掉某个预置分类后再升级，都不会重复插入或复活已删项。
 */
export const FALLBACK_EXPENSE_CATEGORY_ID = 'cat-other';

export const presetCategories: Category[] = [
  { id: 'cat-food', name: '餐饮', type: 'expense', icon: 'silverware-fork-knife', color: '#EA580C', sortOrder: 1, isPreset: true },
  { id: 'cat-transport', name: '交通', type: 'expense', icon: 'bus-side', color: '#0EA5E9', sortOrder: 2, isPreset: true },
  { id: 'cat-shopping', name: '购物', type: 'expense', icon: 'shopping', color: '#8B5CF6', sortOrder: 3, isPreset: true },
  { id: 'cat-housing', name: '居住', type: 'expense', icon: 'home-variant', color: '#0F766E', sortOrder: 4, isPreset: true },
  { id: 'cat-fun', name: '娱乐', type: 'expense', icon: 'gamepad-variant', color: '#D946EF', sortOrder: 5, isPreset: true },
  { id: 'cat-medical', name: '医疗', type: 'expense', icon: 'medical-bag', color: '#DC2626', sortOrder: 6, isPreset: true },
  { id: 'cat-education', name: '教育', type: 'expense', icon: 'school', color: '#6366F1', sortOrder: 7, isPreset: true },
  { id: 'cat-social', name: '人情', type: 'expense', icon: 'gift', color: '#DB2777', sortOrder: 8, isPreset: true },
  { id: 'cat-telecom', name: '通讯', type: 'expense', icon: 'cellphone', color: '#0891B2', sortOrder: 9, isPreset: true },
  { id: 'cat-clothing', name: '服饰', type: 'expense', icon: 'tshirt-crew', color: '#CA8A04', sortOrder: 10, isPreset: true },
  { id: 'cat-travel', name: '旅行', type: 'expense', icon: 'airplane', color: '#65A30D', sortOrder: 11, isPreset: true },
  { id: 'cat-daily', name: '日用', type: 'expense', icon: 'broom', color: '#059669', sortOrder: 12, isPreset: true },
  // 兜底分类：不可删除，删除其它分类时其下的流水归到这里
  { id: FALLBACK_EXPENSE_CATEGORY_ID, name: '其他', type: 'expense', icon: 'apps', color: '#64748B', sortOrder: 99, isPreset: true },
  { id: 'cat-salary', name: '工资', type: 'income', icon: 'briefcase', color: '#15803D', sortOrder: 1, isPreset: true },
  { id: 'cat-bonus', name: '奖金', type: 'income', icon: 'trophy', color: '#CA8A04', sortOrder: 2, isPreset: true },
  { id: 'cat-invest', name: '理财', type: 'income', icon: 'chart-line', color: '#0EA5E9', sortOrder: 3, isPreset: true },
  { id: 'cat-reimburse', name: '报销', type: 'income', icon: 'file-document-check', color: '#8B5CF6', sortOrder: 4, isPreset: true },
  { id: 'cat-other-income', name: '其他收入', type: 'income', icon: 'plus-circle', color: '#64748B', sortOrder: 99, isPreset: true },
];

/**
 * 只预置一个「现金」账户。账户是高度个人化的（谁有几张卡、余额多少），
 * 预置支付宝/微信反而会让用户先面对一堆要删的空账户。
 */
export const presetAccounts: Account[] = [
  { id: 'acc-cash', name: '现金', type: 'cash', initialBalance: 0, icon: 'cash', color: '#0F766E', isArchived: false, sortOrder: 1 },
];

export const defaultSettings: Record<string, string> = {
  theme: 'system',
  currencySymbol: '¥',
};
