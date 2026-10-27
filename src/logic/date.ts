/**
 * 日期一律按「本地时区」解释。
 *
 * 刻意不用 new Date('2026-10-05')：这种 ISO 日期字符串会被 JS 按 UTC 午夜解析，
 * 在东八区取 getDate() 得到的是 5 号没错，但在西五区就变成 4 号。
 * 所有构造都走 new Date(y, m - 1, d) 的本地形式。
 */

export type DayKey = string; // 'YYYY-MM-DD'
export type MonthKey = string; // 'YYYY-MM'
export type TimeText = string; // 'HH:mm'

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function dayKeyOf(date: Date): DayKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

/** 存进 transactions.occurredAt 的值：UTC ISO，精确到毫秒 */
export function toStoredIso(date: Date): string {
  return date.toISOString();
}

export function parseIso(iso: string): Date {
  return new Date(iso);
}

export function dayKeyFromIso(iso: string): DayKey {
  return dayKeyOf(new Date(iso));
}

export function monthKeyFromIso(iso: string): MonthKey {
  return monthKeyOf(new Date(iso));
}

export function monthKeyOfDayKey(dayKey: DayKey): MonthKey {
  const match = DAY_PATTERN.exec(dayKey);
  if (!match) throw new Error(`非法日期: ${dayKey}`);
  return `${match[1]}-${match[2]}`;
}

function startOfMonth(month: MonthKey): Date {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`非法月份: ${month}`);
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

/** 跨年月安全的月份偏移：addMonths('2025-12', 2) === '2026-02' */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const date = startOfMonth(month);
  date.setMonth(date.getMonth() + delta);
  return monthKeyOf(date);
}

/** 含当月的最近 N 个月，从早到晚排列 */
export function lastMonths(current: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(current, i - (count - 1)));
}

/** 闰年 2 月由 Date 自己算，不手写月份天数表 */
export function daysInMonth(month: MonthKey): number {
  const date = startOfMonth(month);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/** 用于 occurredDate BETWEEN ? AND ? 的闭区间端点 */
export function monthBounds(month: MonthKey): { from: DayKey; to: DayKey } {
  const from = startOfMonth(month);
  const to = new Date(from.getFullYear(), from.getMonth(), daysInMonth(month));
  return { from: dayKeyOf(from), to: dayKeyOf(to) };
}

export function formatMonthTitle(month: MonthKey): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return month;
  return `${match[1]}年${Number(match[2])}月`;
}

export function formatDayTitle(dayKey: DayKey, today: DayKey): string {
  const match = DAY_PATTERN.exec(dayKey);
  if (!match) return dayKey;
  if (dayKey === today) return '今天';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const yesterday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  if (dayKeyOf(yesterday) === today) return '昨天';
  const sameYear = date.getFullYear() === Number(today.slice(0, 4));
  const body = `${date.getMonth() + 1}月${date.getDate()}日`;
  return sameYear ? body : `${date.getFullYear()}年${body}`;
}

export function formatTime(date: Date): TimeText {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function weekdayLabel(date: Date): string {
  return WEEKDAYS[date.getDay()];
}

/** 把日期与时间合成一个本地 Date（记一笔的日期选择器用） */
export function combineDayTime(dayKey: DayKey, time: TimeText): Date {
  const day = DAY_PATTERN.exec(dayKey);
  const hm = TIME_PATTERN.exec(time);
  if (!day) throw new Error(`非法日期: ${dayKey}`);
  const hour = hm ? Number(hm[1]) : 0;
  const minute = hm ? Number(hm[2]) : 0;
  return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), hour, minute);
}

export function isValidDayKey(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return dayKeyOf(date) === value;
}

export function isValidMonthKey(value: string): boolean {
  return MONTH_PATTERN.test(value);
}
