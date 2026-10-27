package com.tally.bookkeeping.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.widget.RemoteViews

/**
 * 所有卡片的公共基类。
 *
 * 关键设计：onUpdate 里**同步**查库并立刻交回 RemoteViews。
 * 不给 ROM 留下「先给一张空卡、稍后异步补画」的窗口 ——
 * 上一版用 react-native-android-widget 正是死在这里（headless JS 被荣耀冻结）。
 */
abstract class TallyWidgetProvider : AppWidgetProvider() {

    abstract val layoutId: Int

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            // 卡片崩了会把整个进程带下水，桌面的表现就是「放上去就消失」，
            // 所以这里兜住一切异常，最坏也只画一张空卡。
            val views = try {
                RemoteViews(context.packageName, layoutId).also { render(context, it) }
            } catch (error: Exception) {
                RemoteViews(context.packageName, layoutId)
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

    /** 子类负责填内容；抛出的异常由基类兜住。 */
    abstract fun render(context: Context, views: RemoteViews)

    /**
     * 读不到数据时画 "--" 而不是 ¥0.00。
     *
     * 之前这里写的是 summary?.expense ?: 0L，于是「数据库路径找错」被伪装成
     * 「这个月确实没花钱」—— 对记账 App 来说这是最坏的失败模式，
     * 数字看着完全正常其实全错，用户没有任何线索。
     */
    protected fun setAmount(views: RemoteViews, id: Int, cents: Long?, symbol: String, color: Int) {
        views.setTextViewText(id, if (cents == null) "--" else WidgetMoney.format(cents, symbol))
        views.setTextColor(id, color)
    }

    protected fun applyCardStyle(views: RemoteViews, palette: WidgetPalette) {
        views.setInt(R.id.widget_root, "setBackgroundResource", palette.cardBackground)
    }

    /** 一键记一笔：走 expo-router 已配好的 tally:// 深链。 */
    protected fun applyQuickAdd(context: Context, views: RemoteViews, palette: WidgetPalette, label: String) {
        views.setTextViewText(R.id.widget_action_label, label)
        views.setTextColor(R.id.widget_action_label, palette.onPrimary)
        views.setInt(R.id.widget_action, "setBackgroundResource", palette.actionBackground)
        views.setOnClickPendingIntent(R.id.widget_action, quickAddPendingIntent(context))
    }

    private fun quickAddPendingIntent(context: Context): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("$DEEP_LINK_SCHEME://entry")).apply {
            setPackage(context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        return PendingIntent.getActivity(
            context,
            REQUEST_CODE_QUICK_ADD,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        const val TAG = "TallyWidget"
        const val DEEP_LINK_SCHEME = "tally"
        const val REQUEST_CODE_QUICK_ADD = 1001

        /** JS 侧写完数据后调用，让所有已放置的卡片立刻重画。 */
        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context) ?: return
            val providers = listOf(
                QuickAddWidgetProvider::class.java,
                MonthSummaryWidgetProvider::class.java,
                RecentWidgetProvider::class.java,
                AnalysisWidgetProvider::class.java
            )
            var repainted = 0
            for (provider in providers) {
                val ids = manager.getAppWidgetIds(ComponentName(context, provider))
                if (ids == null || ids.isEmpty()) continue
                try {
                    val instance = provider.getDeclaredConstructor().newInstance() as TallyWidgetProvider
                    instance.onUpdate(context, manager, ids)
                    repainted += ids.size
                } catch (error: Exception) {
                    // 刷新失败不影响 App 本身；卡片最迟 30 分钟后也会被系统更新
                    Log.w(TAG, "refresh ${provider.simpleName} failed", error)
                }
            }
            // 保留一条日志：卡片不刷新时，「JS 没调到原生」「原生没找到卡片」「读到的主题是旧的」
            // 在桌面上长得一模一样，只能靠这条区分（这三种都真在这台机器上踩过）。
            Log.i(TAG, "refreshAll theme=" + WidgetData.themePreference(context) + " repainted=$repainted")
        }
    }
}

/** 2×2：本月支出 + 一键记一笔 */
class QuickAddWidgetProvider : TallyWidgetProvider() {
    override val layoutId = R.layout.widget_quick_add

    override fun render(context: Context, views: RemoteViews) {
        val palette = WidgetPalette.resolve(context)
        applyCardStyle(views, palette)

        val symbol = WidgetData.currencySymbol(context)
        val summary = WidgetData.summary(context, WidgetData.currentMonthKey())

        views.setTextViewText(R.id.widget_label, "本月支出")
        views.setTextColor(R.id.widget_label, palette.textMuted)
        setAmount(views, R.id.widget_value, summary?.expense, symbol, palette.expense)

        applyQuickAdd(context, views, palette, "＋ 记一笔")
    }
}

/** 4×1：收入 / 支出 / 结余 三列 + 一键记一笔 */
class MonthSummaryWidgetProvider : TallyWidgetProvider() {
    override val layoutId = R.layout.widget_month_summary

    override fun render(context: Context, views: RemoteViews) {
        val palette = WidgetPalette.resolve(context)
        applyCardStyle(views, palette)

        val symbol = WidgetData.currencySymbol(context)
        val summary = WidgetData.summary(context, WidgetData.currentMonthKey())
        views.setTextViewText(R.id.income_label, "收入")
        views.setTextColor(R.id.income_label, palette.textMuted)
        setAmount(views, R.id.income_value, summary?.income, symbol, palette.income)

        views.setTextViewText(R.id.expense_label, "支出")
        views.setTextColor(R.id.expense_label, palette.textMuted)
        setAmount(views, R.id.expense_value, summary?.expense, symbol, palette.expense)

        views.setTextViewText(R.id.net_label, "结余")
        views.setTextColor(R.id.net_label, palette.textMuted)
        setAmount(views, R.id.net_value, summary?.net, symbol, palette.text)

        applyQuickAdd(context, views, palette, "记一笔")
    }
}

/** 4×2：本月支出 + 最近 3 笔 */
class RecentWidgetProvider : TallyWidgetProvider() {
    override val layoutId = R.layout.widget_recent

    override fun render(context: Context, views: RemoteViews) {
        val palette = WidgetPalette.resolve(context)
        applyCardStyle(views, palette)

        val symbol = WidgetData.currencySymbol(context)
        val summary = WidgetData.summary(context, WidgetData.currentMonthKey())

        views.setTextViewText(R.id.expense_label, "本月支出")
        views.setTextColor(R.id.expense_label, palette.textMuted)
        setAmount(views, R.id.expense_value, summary?.expense, symbol, palette.expense)

        applyQuickAdd(context, views, palette, "＋ 记一笔")

        views.setTextViewText(R.id.recent_header, "最近")
        views.setTextColor(R.id.recent_header, palette.textMuted)

        val rowNames = intArrayOf(R.id.recent_name_1, R.id.recent_name_2, R.id.recent_name_3)
        val rowTimes = intArrayOf(R.id.recent_time_1, R.id.recent_time_2, R.id.recent_time_3)
        val rowAmounts = intArrayOf(R.id.recent_amount_1, R.id.recent_amount_2, R.id.recent_amount_3)
        val rowRoots = intArrayOf(R.id.recent_row_1, R.id.recent_row_2, R.id.recent_row_3)

        val entriesResult = WidgetData.recentEntries(context, rowNames.size)
        val entries = entriesResult.orEmpty()
        for (index in rowNames.indices) {
            val entry = entries.getOrNull(index)
            if (entry == null) {
                views.setViewVisibility(rowRoots[index], android.view.View.GONE)
                continue
            }
            views.setViewVisibility(rowRoots[index], android.view.View.VISIBLE)
            views.setTextViewText(rowNames[index], entry.name)
            views.setTextColor(rowNames[index], palette.text)
            views.setTextViewText(rowTimes[index], entry.timeLabel)
            views.setTextColor(rowTimes[index], palette.textMuted)
            // 支出/收入靠颜色区分，不重复写正负号，和账单列表的口径一致
            views.setTextViewText(rowAmounts[index], WidgetMoney.format(entry.amountCents, symbol))
            views.setTextColor(rowAmounts[index], if (entry.isExpense) palette.expense else palette.income)
        }

        views.setViewVisibility(
            R.id.recent_empty,
            if (entries.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
        )
        // 读库失败和「真的没有记录」必须分开显示，否则路径错、权限错都会伪装成空账本
        views.setTextViewText(R.id.recent_empty, if (entriesResult == null) "暂时读不到账本" else "还没有记录")
        views.setTextColor(R.id.recent_empty, palette.textMuted)
    }
}

/** 4×3：收支概览 + 分类占比（支出分析） */
class AnalysisWidgetProvider : TallyWidgetProvider() {
    override val layoutId = R.layout.widget_analysis

    override fun render(context: Context, views: RemoteViews) {
        val palette = WidgetPalette.resolve(context)
        applyCardStyle(views, palette)

        val month = WidgetData.currentMonthKey()
        val symbol = WidgetData.currencySymbol(context)
        val summary = WidgetData.summary(context, month)

        views.setTextViewText(R.id.income_label, "本月收入")
        views.setTextColor(R.id.income_label, palette.textMuted)
        setAmount(views, R.id.income_value, summary?.income, symbol, palette.income)

        views.setTextViewText(R.id.expense_label, "本月支出")
        views.setTextColor(R.id.expense_label, palette.textMuted)
        setAmount(views, R.id.expense_value, summary?.expense, symbol, palette.expense)

        applyQuickAdd(context, views, palette, "记一笔")

        views.setTextViewText(R.id.analysis_header, "支出分析")
        views.setTextColor(R.id.analysis_header, palette.textMuted)

        val roots = intArrayOf(R.id.cat_row_1, R.id.cat_row_2, R.id.cat_row_3, R.id.cat_row_4)
        val names = intArrayOf(R.id.cat_name_1, R.id.cat_name_2, R.id.cat_name_3, R.id.cat_name_4)
        val shares = intArrayOf(R.id.cat_share_1, R.id.cat_share_2, R.id.cat_share_3, R.id.cat_share_4)
        val amounts = intArrayOf(R.id.cat_amount_1, R.id.cat_amount_2, R.id.cat_amount_3, R.id.cat_amount_4)
        val bars = intArrayOf(R.id.cat_bar_1, R.id.cat_bar_2, R.id.cat_bar_3, R.id.cat_bar_4)

        val categoriesResult = WidgetData.categoryShares(context, month, roots.size)
        val categories = categoriesResult.orEmpty()
        for (index in roots.indices) {
            val item = categories.getOrNull(index)
            if (item == null) {
                views.setViewVisibility(roots[index], android.view.View.GONE)
                continue
            }
            views.setViewVisibility(roots[index], android.view.View.VISIBLE)
            views.setTextViewText(names[index], item.name)
            views.setTextColor(names[index], palette.text)
            views.setTextViewText(shares[index], WidgetMoney.formatShare(item.permille))
            views.setTextColor(shares[index], palette.textMuted)
            views.setTextViewText(amounts[index], WidgetMoney.format(item.amountCents, symbol))
            views.setTextColor(amounts[index], palette.text)
            // RemoteViews 里唯一能按比例画的控件就是 ProgressBar，所以 max 固定 1000 配千分比
            views.setProgressBar(bars[index], 1000, item.permille, false)
        }

        views.setViewVisibility(
            R.id.analysis_empty,
            if (categories.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE
        )
        views.setTextViewText(R.id.analysis_empty, if (categoriesResult == null) "暂时读不到账本" else "这个月还没有支出")
        views.setTextColor(R.id.analysis_empty, palette.textMuted)
    }
}
