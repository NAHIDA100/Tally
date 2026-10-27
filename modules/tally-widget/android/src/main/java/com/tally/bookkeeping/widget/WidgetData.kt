package com.tally.bookkeeping.widget

import android.content.Context
import android.content.res.Configuration
import android.database.sqlite.SQLiteDatabase
import android.graphics.Color
import android.util.Log
import java.text.SimpleDateFormat
import java.time.Instant
import java.util.Date
import java.util.Locale

/**
 * 卡片的数据来源。
 *
 * 直接读 expo-sqlite 建的同一个库文件，绕开 React Native：卡片进程可能根本没有
 * JS 运行时。上一版走 react-native-android-widget 的 headless JS，实测在荣耀上
 * 进程 10 秒就被省电策略冻结，卡片始终是透明的，于是被桌面当失败丢掉。
 *
 * 这里的 SQL 口径必须和 src/db/repository 与 src/logic/stats 保持一致，
 * 尤其是「转账既不算收入也不算支出」这条硬性要求。
 */
object WidgetData {

    const val DATABASE_NAME = "tally.db"

    /**
     * expo-sqlite 58 不用 Android 默认的 databases/ 目录。
     * 见 node_modules/expo-sqlite/.../SQLiteModule.kt 的 defaultDatabaseDirectory：
     *   androidContext.filesDir + "/SQLite"
     * 用 context.getDatabasePath() 会指向 databases/tally.db，那里永远是空的 ——
     * 卡片会安静地显示 ¥0.00，看起来正常其实全错（真机踩过）。
     */
    fun databaseFile(context: android.content.Context) =
        java.io.File(context.filesDir, "SQLite" + java.io.File.separator + DATABASE_NAME)

    class Summary(val income: Long = 0, val expense: Long = 0, val count: Int = 0) {
        val net: Long get() = income - expense
    }

    class Entry(val name: String, val amountCents: Long, val isExpense: Boolean, val timeLabel: String)

    class CategoryShare(val name: String, val amountCents: Long, val permille: Int)

    private var shared: SQLiteDatabase? = null

    /**
     * 整个进程共用一条连接，不要每次查询都 open/close。
     *
     * 逐次 open 在本机实测会把读视图钉死在第一次打开时的 WAL 快照上：连点三次主题，
     * 卡片三次都画第一次的值，等 25 秒也不追上来（enableWriteAheadLogging 和
     * SQLiteDatabase.releaseMemory 都救不了）。长期连接在 autocommit 下每条语句
     * 都开新的读事务，才看得到 App 刚提交的内容。
     */
    @Synchronized
    private fun connection(context: Context): SQLiteDatabase? {
        shared?.takeIf { it.isOpen }?.let { return it }
        val file = databaseFile(context)
        if (!file.exists()) return null
        // 不用 OPEN_READONLY：库是 WAL 模式，只读打开在 -shm 缺失时会 SQLITE_CANTOPEN。
        // 这里只跑 SELECT，读写标志只是为了满足 WAL 的打开条件。
        return try {
            SQLiteDatabase.openDatabase(
                file.absolutePath,
                null,
                SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.NO_LOCALIZED_COLLATORS
            ).also {
                // 显式开 WAL，让这条连接走 WAL 读连接池，能读到还在 -wal 里的新提交。
                it.enableWriteAheadLogging()
                shared = it
            }
        } catch (error: Exception) {
            Log.w(TallyWidgetProvider.TAG, "open failed: ${file.absolutePath}", error)
            null
        }
    }

    fun currentMonthKey(): String =
        SimpleDateFormat("yyyy-MM", Locale.getDefault()).format(Date())

    fun summary(context: Context, month: String): Summary? {
        val db = connection(context) ?: return null
        try {
            var income = 0L
            var expense = 0L
            var count = 0
            db.rawQuery(
                "SELECT type, COALESCE(SUM(amount), 0), COUNT(*) FROM transactions " +
                    "WHERE occurred_month = ? GROUP BY type",
                arrayOf(month)
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    // transfer 被刻意忽略：它只是钱在自家账户之间移动
                    when (cursor.getString(0)) {
                        "income" -> income += cursor.getLong(1)
                        "expense" -> expense += cursor.getLong(1)
                    }
                    count += cursor.getInt(2)
                }
            }
            return Summary(income, expense, count)
        } catch (error: Exception) {
            return null
        }
    }

    fun recentEntries(context: Context, limit: Int): List<Entry>? {
        val db = connection(context) ?: return null
        try {
            val out = ArrayList<Entry>(limit)
            db.rawQuery(
                "SELECT t.type, t.amount, t.occurred_at, " +
                    "COALESCE(c.name, ''), COALESCE(a.name, '') " +
                    "FROM transactions t " +
                    "LEFT JOIN categories c ON c.id = t.category_id " +
                    "LEFT JOIN accounts a ON a.id = t.to_account_id " +
                    "ORDER BY t.occurred_at DESC, t.id DESC LIMIT ?",
                arrayOf(limit.toString())
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    val type = cursor.getString(0)
                    val rawName = if (type == "transfer") "转账 → " + cursor.getString(4) else cursor.getString(3)
                    out.add(
                        Entry(
                            name = if (rawName.isEmpty()) "未分类" else rawName,
                            amountCents = cursor.getLong(1),
                            isExpense = type == "expense",
                            timeLabel = formatLocalTime(cursor.getString(2))
                        )
                    )
                }
            }
            return out
        } catch (error: Exception) {
            return null
        }
    }

    fun categoryShares(context: Context, month: String, limit: Int): List<CategoryShare>? {
        val db = connection(context) ?: return null
        try {
            val names = ArrayList<String>()
            val amounts = ArrayList<Long>()
            var total = 0L
            db.rawQuery(
                "SELECT COALESCE(c.name, '未分类'), SUM(t.amount) AS total FROM transactions t " +
                    "LEFT JOIN categories c ON c.id = t.category_id " +
                    "WHERE t.occurred_month = ? AND t.type = 'expense' " +
                    "GROUP BY c.id ORDER BY total DESC LIMIT ?",
                arrayOf(month, limit.toString())
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    names.add(cursor.getString(0))
                    val amount = cursor.getLong(1)
                    amounts.add(amount)
                    total += amount
                }
            }
            if (total <= 0L) return emptyList()

            // 和 JS 侧 withShares 一样先算千分比，进度条 max 直接就是 1000
            return names.mapIndexed { index, name ->
                val permille = Math.round(amounts[index] * 1000.0 / total).toInt()
                CategoryShare(name, amounts[index], permille)
            }
        } catch (error: Exception) {
            return null
        }
    }

    fun currencySymbol(context: Context): String =
        settingValue(context, "currencySymbol")?.takeIf { it.isNotEmpty() } ?: "¥"

    fun themePreference(context: Context): String = settingValue(context, "theme") ?: "system"

    private fun settingValue(context: Context, key: String): String? {
        val db = connection(context) ?: return null
        try {
            db.rawQuery("SELECT value FROM settings WHERE key = ? LIMIT 1", arrayOf(key))
                .use { cursor ->
                    return if (cursor.moveToFirst()) cursor.getString(0) else null
                }
        } catch (error: Exception) {
            return null
        }
    }

    /** occurred_at 存的是 UTC ISO；卡片要显示本地时分，和 App 内一致。 */
    private fun formatLocalTime(iso: String): String {
        return try {
            SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date.from(Instant.parse(iso)))
        } catch (error: Exception) {
            ""
        }
    }
}
