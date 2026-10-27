package com.tally.bookkeeping.widget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 给 JS 用的刷新入口。
 *
 * 卡片只在 onUpdate 时同步取数，而系统触发 onUpdate 的间隔下限是 30 分钟
 * （updatePeriodMillis 被 Android 强制夹到 1800000）。对「3 秒记一笔」的 App 来说，
 * 记完账卡片还停在旧数字等于坏，所以保存/删除/导入后由 JS 主动调一次。
 */
class TallyWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("TallyWidget")

        Function("refresh") {
            // 用 ?.let 而不是 ?: return@Function —— 后者会让 Kotlin 去推断
            // 这个 Function lambda 的返回类型，报 expected Any? actual Unit。
            appContext.reactContext?.let(TallyWidgetProvider::refreshAll)
        }
    }
}
