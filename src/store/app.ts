import { create } from 'zustand';

import { refreshTallyWidgets } from '../../modules/tally-widget/src';

export type ThemePreference = 'system' | 'light' | 'dark';

interface AppState {
  /** 数据库里的 settings 是否已加载完成；未完成前界面显示骨架，避免用默认值闪一下 */
  ready: boolean;
  themePreference: ThemePreference;
  currencySymbol: string;
  defaultAccountId: string | null;
  defaultAccountName: string | null;
  /**
   * 写库成功后自增。读数据的 hook 把它放进依赖里即可触发重取，
   * 相当于一个极简的缓存失效信号——避免为本地单表查询再造一套缓存层。
   */
  dataVersion: number;

  loadFromSettings: (input: {
    themePreference: ThemePreference;
    currencySymbol: string;
    defaultAccountId: string | null;
    defaultAccountName: string | null;
  }) => void;
  setThemePreference: (value: ThemePreference) => void;
  setCurrencySymbol: (value: string) => void;
  setDefaultAccount: (id: string | null, name: string | null) => void;
  bump: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  themePreference: 'system',
  currencySymbol: '¥',
  defaultAccountId: null,
  defaultAccountName: null,
  dataVersion: 0,

  loadFromSettings: (input) => set({ ...input, ready: true }),
  // 这里不刷桌面卡片：卡片是从库里读主题和符号的，而这两个 setter 只改内存。
  // 刷新必须排在 setSetting 落库之后，否则画出来的是上一个主题 ——
  // 调用方（设置页）负责在写库完成后调 refreshTallyWidgets()。
  setThemePreference: (themePreference) => set({ themePreference }),
  setCurrencySymbol: (currencySymbol) => set({ currencySymbol }),
  setDefaultAccount: (defaultAccountId, defaultAccountName) => set({ defaultAccountId, defaultAccountName }),
  bump: () => {
    set((state) => ({ dataVersion: state.dataVersion + 1 }));
    refreshTallyWidgets();
  },
}));
