import { describe, expect, it } from 'vitest';

import {
  addMonths,
  combineDayTime,
  dayKeyFromIso,
  dayKeyOf,
  daysInMonth,
  formatDayTitle,
  formatMonthTitle,
  formatTime,
  isValidDayKey,
  isValidMonthKey,
  lastMonths,
  monthBounds,
  monthKeyOfDayKey,
  monthKeyOf,
  toStoredIso,
  weekdayLabel,
} from '../src/logic/date';

describe('本地日期键', () => {
  it('月日补零', () => {
    expect(dayKeyOf(new Date(2026, 9, 5))).toBe('2026-10-05');
    expect(monthKeyOf(new Date(2026, 9, 5))).toBe('2026-10');
    expect(monthKeyOfDayKey('2026-10-05')).toBe('2026-10');
  });

  it('ISO 存 UTC，展示取本地，两者不能互相污染', () => {
    const local = new Date(2026, 9, 25, 9, 41);
    const iso = toStoredIso(local);
    expect(iso.endsWith('Z')).toBe(true);
    expect(dayKeyFromIso(iso)).toBe('2026-10-25');
    expect(combineDayTime('2026-10-25', '09:41').getTime()).toBe(local.getTime());
  });

  it('拒绝不存在的日期', () => {
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-10-05')).toBe(true);
    // 闰年
    expect(isValidDayKey('2024-02-29')).toBe(true);
    expect(isValidDayKey('2023-02-29')).toBe(false);
    expect(isValidMonthKey('2026-10')).toBe(true);
    expect(isValidMonthKey('2026-10-01')).toBe(false);
  });
});

describe('月份运算', () => {
  it('跨年安全', () => {
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 2)).toBe('2026-02');
    expect(addMonths('2026-01', -13)).toBe('2024-12');
  });

  it('近 6 个月含当月，从早到晚', () => {
    expect(lastMonths('2026-10', 6)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(lastMonths('2026-03', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
    expect(lastMonths('2026-10', 1)).toEqual(['2026-10']);
  });

  it('月末日数交给 Date 算，闰年不写死', () => {
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2026-01')).toBe(31);
    expect(daysInMonth('2026-04')).toBe(30);
  });

  it('monthBounds 给出闭区间，供 occurredDate BETWEEN 使用', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('展示文案', () => {
  it('月份标题', () => {
    expect(formatMonthTitle('2026-10')).toBe('2026年10月');
    expect(formatMonthTitle('2026-01')).toBe('2026年1月');
  });

  it('今天/昨天/跨年', () => {
    expect(formatDayTitle('2026-10-25', '2026-10-25')).toBe('今天');
    expect(formatDayTitle('2026-10-24', '2026-10-25')).toBe('昨天');
    expect(formatDayTitle('2025-12-31', '2026-01-01')).toBe('昨天');
    expect(formatDayTitle('2026-03-05', '2026-10-25')).toBe('3月5日');
    expect(formatDayTitle('2025-03-05', '2026-10-25')).toBe('2025年3月5日');
  });

  it('时间与星期', () => {
    expect(formatTime(new Date(2026, 9, 25, 9, 5))).toBe('09:05');
    // 2026-10-25 是周日
    expect(weekdayLabel(new Date(2026, 9, 25))).toBe('周日');
    // 2026-01-01 是周四
    expect(weekdayLabel(new Date(2026, 0, 1))).toBe('周四');
  });

  it('时间缺省按零点', () => {
    expect(combineDayTime('2026-10-05', '').getHours()).toBe(0);
  });
});

describe('非法输入', () => {
  it('抛错而不是静默产出 NaN', () => {
    expect(() => addMonths('2026/10', 1)).toThrow();
    expect(() => daysInMonth('2026-10-01')).toThrow();
    expect(() => monthKeyOfDayKey('20261005')).toThrow();
    expect(() => combineDayTime('bogus', '09:41')).toThrow();
  });
});
