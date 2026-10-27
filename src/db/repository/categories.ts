import type { SQLiteDatabase } from 'expo-sqlite';

import { FALLBACK_EXPENSE_CATEGORY_ID } from '@/src/db/presets';
import type { Category, CategoryType } from '@/src/types';
import { newId } from '@/src/utils/id';

import type { CategoryRow } from './rows';

function map(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    isPreset: row.is_preset === 1,
  };
}

export async function listCategories(db: SQLiteDatabase, type?: CategoryType): Promise<Category[]> {
  const rows = type
    ? await db.getAllAsync<CategoryRow>('SELECT * FROM categories WHERE type = ? ORDER BY sort_order, name', type)
    : await db.getAllAsync<CategoryRow>('SELECT * FROM categories ORDER BY type, sort_order, name');
  return rows.map(map);
}

export async function createCategory(
  db: SQLiteDatabase,
  input: { name: string; type: CategoryType; icon: string; color: string },
): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('请输入分类名称');
  const clash = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE type = ? AND name = ? LIMIT 1',
    input.type,
    name,
  );
  if (clash) throw new Error('同类型下已有同名分类');

  const row = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE type = ?',
    input.type,
  );
  // 排在兜底「其他」(sortOrder 99) 之前，避免自定义分类跑到最后一名之外
  const sortOrder = Math.min((row?.m ?? 0) + 1, 98);
  const id = newId('cat');
  await db.runAsync(
    `INSERT INTO categories (id, name, type, icon, color, sort_order, is_preset)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, name, input.type, input.icon, input.color, sortOrder],
  );
  const created = await getCategory(db, id);
  if (!created) throw new Error('写入后未能读回该分类');
  return created;
}

export async function getCategory(db: SQLiteDatabase, id: string): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
  return row ? map(row) : null;
}

export async function updateCategory(
  db: SQLiteDatabase,
  id: string,
  input: { name: string; icon: string; color: string },
): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error('请输入分类名称');
  const current = await getCategory(db, id);
  if (!current) throw new Error('要修改的分类不存在');
  const clash = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM categories WHERE type = ? AND name = ? AND id <> ? LIMIT 1',
    current.type,
    name,
    id,
  );
  if (clash) throw new Error('同类型下已有同名分类');

  // 预置分类的名称是全局约定（统计与导入都按它认），只允许改图标和颜色
  const targetName = current.isPreset ? current.name : name;
  const result = await db.runAsync(
    'UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
    [targetName, input.icon, input.color, id],
  );
  if (result.changes === 0) throw new Error('要修改的分类不存在');
}

/**
 * 删除分类：不硬删引用它的流水，而是整体改派到兜底「其他」。
 * 直接 ON DELETE CASCADE 会让用户一次误触抹掉几十笔历史账，
 * SET NULL 又会让列表出现没有分类的孤儿行。
 */
export async function deleteCategory(db: SQLiteDatabase, id: string): Promise<number> {
  if (id === FALLBACK_EXPENSE_CATEGORY_ID) throw new Error('「其他」是兜底分类，不能删除');
  const current = await getCategory(db, id);
  if (!current) throw new Error('要删除的分类不存在');
  if (current.isPreset) throw new Error('预置分类不能删除，可修改图标与颜色');

  const usage = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
    id,
  );
  const moved = usage?.n ?? 0;

  await db.withExclusiveTransactionAsync(async (txn) => {
    if (moved > 0) {
      await txn.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', FALLBACK_EXPENSE_CATEGORY_ID, id);
    }
    await txn.runAsync('DELETE FROM budgets WHERE category_id = ?', id);
    await txn.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
  return moved;
}

export async function countCategoryUsage(db: SQLiteDatabase, id: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?',
    id,
  );
  return row?.n ?? 0;
}
