import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';
import { defaultSettings, presetAccounts, presetCategories } from './presets';

export const DATABASE_NAME = 'tally.db';

/**
 * 由 <SQLiteProvider onInit> 调用：开库后、渲染任何界面前跑完。
 *
 * PRAGMA foreign_keys 是**按连接**生效的。这里只在 provider 的那条连接上设置一次，
 * 所有 repository 通过 useSQLiteContext() 复用同一条连接，因此不会出现
 * 「有的语句有外键约束、有的没有」。级联行为我们仍不依赖它——
 * 删分类的改派、删账户的拦截都在 repository 里显式写，跨连接行为一致。
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await runMigrations(db);
  await seedPresets(db);
}

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number | null }>('PRAGMA user_version');
  let current = row?.user_version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const statement of migration.up) {
        await txn.execAsync(statement);
      }
      // PRAGMA 不支持参数绑定，只能拼字符串；version 来自本文件的常量数组，不是用户输入。
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }
}

async function seedPresets(db: SQLiteDatabase): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const category of presetCategories) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO categories
           (id, name, type, icon, color, sort_order, is_preset)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        category.id,
        category.name,
        category.type,
        category.icon,
        category.color,
        category.sortOrder,
        category.isPreset ? 1 : 0,
      );
    }
    for (const account of presetAccounts) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO accounts
           (id, name, type, initial_balance, icon, color, is_archived, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        account.id,
        account.name,
        account.type,
        account.initialBalance,
        account.icon,
        account.color,
        account.isArchived ? 1 : 0,
        account.sortOrder,
      );
    }
    for (const [key, value] of Object.entries(defaultSettings)) {
      await txn.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', key, value);
    }
    // 首次安装时把唯一的预置账户设为默认，记一笔就不用先选账户
    await txn.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      'defaultAccountId',
      presetAccounts[0].id,
    );
  });
}
