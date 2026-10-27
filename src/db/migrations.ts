/**
 * 迁移按版本号顺序执行，PRAGMA user_version 记录当前版本。
 * 每条 SQL 单独执行（execAsync 不接受参数），因此这里只放 DDL 与静态种子。
 *
 * 命名约定：库里是 snake_case，出了 repository 一律映射成 src/types.ts 里的 camelCase。
 */
export interface Migration {
  version: number;
  up: string[];
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: [
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash','bank','credit','ewallet')),
        initial_balance INTEGER NOT NULL DEFAULT 0,
        icon TEXT NOT NULL DEFAULT 'wallet',
        color TEXT NOT NULL DEFAULT '#0F766E',
        is_archived INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('expense','income')),
        icon TEXT NOT NULL DEFAULT 'tag',
        color TEXT NOT NULL DEFAULT '#64748B',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_preset INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('expense','income','transfer')),
        -- 金额恒为正整数分：方向由 type 表达。存带符号金额会让「负数 × expense」
        -- 变成一笔收入，是账目对不平的经典根因。
        amount INTEGER NOT NULL CHECK (amount > 0),
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
        to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
        occurred_at TEXT NOT NULL,
        occurred_date TEXT NOT NULL,
        occurred_month TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        -- 标签是 JSON 数组字符串。MVP 只按关键词搜，建标签表属于过度设计。
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (type = 'transfer' OR category_id IS NOT NULL),
        CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
        CHECK (to_account_id IS NULL OR to_account_id <> account_id)
      )`,
      // 按天分组、按月统计是本 App 最高频的查询，靠两张冗余的本地日期列走索引，
      // 避免对 occurred_at 跑 strftime(..., 'localtime')（那样索引全部失效）。
      'CREATE INDEX IF NOT EXISTS idx_tx_occurred_date ON transactions(occurred_date)',
      'CREATE INDEX IF NOT EXISTS idx_tx_occurred_month ON transactions(occurred_month)',
      'CREATE INDEX IF NOT EXISTS idx_tx_month_type ON transactions(occurred_month, type)',
      'CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id)',
      'CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id)',
      // 库内用空串而不是 NULL 表示「月度总预算」：SQLite 的 UNIQUE 认为任意两个
      // NULL 互不相等，用 NULL 会允许插入多条总预算。repository 层负责 '' <-> null。
      `CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        year_month TEXT NOT NULL,
        category_id TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL CHECK (amount > 0),
        UNIQUE(year_month, category_id),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )`,
      'CREATE INDEX IF NOT EXISTS idx_budget_month ON budgets(year_month)',
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,
    ],
  },
  {
    // v1 给 budgets.category_id 加了外键，但「总预算」存的是空串 ''，
    // 它不是任何真实分类的 id，于是写总预算必然触发 FOREIGN KEY constraint failed（真机实测）。
    // 这个外键本来就是多余的：deleteCategory 已经显式 DELETE FROM budgets WHERE category_id = ?。
    // SQLite 不能改约束，只能重建表。
    version: 2,
    up: [
      `CREATE TABLE budgets_v2 (
        id TEXT PRIMARY KEY,
        year_month TEXT NOT NULL,
        category_id TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL CHECK (amount > 0),
        UNIQUE(year_month, category_id)
      )`,
      `INSERT INTO budgets_v2 (id, year_month, category_id, amount)
         SELECT id, year_month, category_id, amount FROM budgets`,
      'DROP TABLE budgets',
      'ALTER TABLE budgets_v2 RENAME TO budgets',
      'CREATE INDEX IF NOT EXISTS idx_budget_month ON budgets(year_month)',
    ],
  },
];

/** 供 repository 层复用的约定：预算表里代表「总预算」的 category_id 取值 */
export const TOTAL_BUDGET_CATEGORY_ID = '';
