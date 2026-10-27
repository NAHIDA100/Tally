import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '@/src/store/app';

export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  /** 完成时对应的查询标识；和当前 key 不一致说明结果已经过期 */
  key: string;
  data: T | null;
  error: Error | null;
}

/**
 * 读本地库的极简查询钩子：db + dataVersion + 调用方依赖 变化时重取。
 *
 * 之所以不引入 react-query：数据全在一台设备的 SQLite 里，查询是毫秒级的本地读，
 * 不需要缓存层、重试、乐观更新那一套。写库后 store.bump() 触发重取就够了。
 *
 * loading 由 key 比对推导而不是 setState(true)：在 effect 里同步 setState
 * 会触发级联渲染（React Compiler 的 lint 规则会直接报错）。
 * 重取期间继续展示上一次的结果，避免列表在 bump 时闪白。
 */
export function useQuery<T>(
  fetcher: (db: SQLiteDatabase) => Promise<T>,
  deps: unknown[] = [],
): QueryResult<T> {
  const db = useSQLiteContext();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: '', data: null, error: null });

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const key = `${dataVersion}:${nonce}:${JSON.stringify(deps)}`;

  useEffect(() => {
    let cancelled = false;
    fetcher(db).then(
      (data) => {
        if (!cancelled) setSettled({ key, data, error: null });
      },
      (error: unknown) => {
        if (cancelled) return;
        setSettled({ key, data: null, error: toError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
    // fetcher 每次渲染都是新函数，放进依赖会死循环；调用方通过 deps 声明意图
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  return {
    data: settled.data,
    error: settled.error,
    loading: settled.key !== key,
    reload,
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
