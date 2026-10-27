package com.tally.bookkeeping.widget

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import java.util.Locale

/**
 * 卡片配色。数值抄自 src/theme/tokens.ts —— 跨 JS/Kotlin 边界没法共享，
 * 改 tokens 时这里要同步。只抄卡片真正用到的几个，不复制整个主题。
 */
class WidgetPalette private constructor(val dark: Boolean) {
    val text: Int = Color.parseColor(if (dark) "#E9EEEC" else "#141F1C")
    val textMuted: Int = Color.parseColor(if (dark) "#8FA09A" else "#6C7B76")
    val expense: Int = Color.parseColor(if (dark) "#FB923C" else "#C2410C")
    val income: Int = Color.parseColor(if (dark) "#4ADE80" else "#15803D")
    val onPrimary: Int = Color.parseColor(if (dark) "#04110F" else "#FFFFFF")

    val cardBackground: Int = if (dark) R.drawable.widget_card_dark else R.drawable.widget_card_light
    val actionBackground: Int = if (dark) R.drawable.widget_action_dark else R.drawable.widget_action_light

    companion object {
        /**
         * 跟随 App 内的主题设置而不是设备深浅色：用户显式选了深色就该是深色，
         * 只有 system 才落到系统 uiMode。
         */
        fun resolve(context: Context): WidgetPalette {
            val dark = when (WidgetData.themePreference(context)) {
                "light" -> false
                "dark" -> true
                else -> {
                    val night = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                    night == Configuration.UI_MODE_NIGHT_YES
                }
            }
            return WidgetPalette(dark)
        }
    }
}

/** 金额格式化，和 JS 侧 formatMoney 同口径：整数分 → 「¥1,234.56」，负号在符号前。 */
object WidgetMoney {
    fun format(cents: Long, symbol: String): String {
        val negative = cents < 0
        val abs = if (negative) -cents else cents
        val body = symbol + groupThousands((abs / 100).toString()) + "." +
            (abs % 100).toString().padStart(2, '0')
        return if (negative) "-$body" else body
    }

    /** 千分比 → 「75.8%」，和 JS 侧 withShares 的输出一致。 */
    fun formatShare(permille: Int): String =
        String.format(Locale.US, "%.1f%%", permille / 10.0)

    private fun groupThousands(digits: String): String {
        val builder = StringBuilder()
        for (index in digits.indices) {
            if (index > 0 && (digits.length - index) % 3 == 0) builder.append(',')
            builder.append(digits[index])
        }
        return builder.toString()
    }
}
