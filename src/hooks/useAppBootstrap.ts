import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getAccount } from '@/src/db/repository/accounts';
import { readSettings } from '@/src/db/repository/settings';
import { DEFAULT_CURRENCY_SYMBOL } from '@/src/logic/money';
import { useAppStore, type ThemePreference } from '@/src/store/app';

export type BootStatus = 'loading' | 'ready' | 'error';

const THEME_VALUES: ThemePreference[] = ['system', 'light', 'dark'];

function asTheme(value: string | undefined): ThemePreference {
  return value && THEME_VALUES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : 'system';
}

/**
 * 启动时把 settings 表读进 store。
 * 失败要显式暴露成界面，而不是静默用默认值——数据库打不开时用户必须知道，
 * 否则他会以为记上了，实际什么都没写进去。
 */
export function useAppBootstrap(): { status: BootStatus; detail: string | null } {
  const db = useSQLiteContext();
  const loadFromSettings = useAppStore((state) => state.loadFromSettings);
  const [status, setStatus] = useState<BootStatus>('loading');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await readSettings(db);
        const defaultAccountId = settings.defaultAccountId ?? null;
        const account = defaultAccountId ? await getAccount(db, defaultAccountId) : null;
        if (cancelled) return;
        loadFromSettings({
          themePreference: asTheme(settings.theme),
          currencySymbol: settings.currencySymbol || DEFAULT_CURRENCY_SYMBOL,
          defaultAccountId: account ? defaultAccountId : null,
          defaultAccountName: account ? account.name : null,
        });
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setDetail(error instanceof Error ? error.message : String(error));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, loadFromSettings]);

  return { status, detail };
}
