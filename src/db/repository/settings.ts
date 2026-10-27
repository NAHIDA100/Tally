import type { SQLiteDatabase } from 'expo-sqlite';

import type { SettingRow } from './rows';

export type Settings = Record<string, string>;

export async function readSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<SettingRow>('SELECT key, value FROM settings');
  const out: Settings = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function setSettings(db: SQLiteDatabase, entries: Settings): Promise<void> {
  const pairs = Object.entries(entries);
  if (pairs.length === 0) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [key, value] of pairs) {
      await txn.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        [key, value],
      );
    }
  });
}
