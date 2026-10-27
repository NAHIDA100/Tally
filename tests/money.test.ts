import { describe, expect, it } from 'vitest';

import {
  MAX_CENTS,
  appendDigit,
  backspaceAmount,
  centsToInputString,
  centsToYuan,
  formatAbsMoney,
  formatCents,
  formatKeypadDisplay,
  formatMoney,
  parseAmountInput,
  parseAmountLoose,
  sumCents,
} from '../src/logic/money';

describe('parseAmountInput', () => {
  it('把元的十进制字符串换成整数分，不经过浮点乘除', () => {
    expect(parseAmountInput('12.34')).toBe(1234);
    // parseFloat('0.07') * 100 === 7.000000000000001，这条断言就是为它存在的
    expect(parseAmountInput('0.07')).toBe(7);
    expect(parseAmountInput('1.15')).toBe(115);
    expect(parseAmountInput('2.675')).toBeNull();
  });

  it('接受键盘输入过程中的中间态', () => {
    expect(parseAmountInput('12.')).toBe(1200);
    expect(parseAmountInput('0.5')).toBe(50);
    expect(parseAmountInput('007')).toBe(700);
  });

  it('拒绝空、非法字符与超精度', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('.')).toBeNull();
    expect(parseAmountInput('-5')).toBeNull();
    expect(parseAmountInput('1e3')).toBeNull();
    expect(parseAmountInput('1.2.3')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
  });

  it('卡住上限，避免和 SQLite INTEGER 之外的精度假设打架', () => {
    expect(parseAmountInput('99999999.99')).toBe(MAX_CENTS);
    expect(parseAmountInput('100000000')).toBeNull();
    expect(parseAmountInput('1234567890')).toBeNull();
  });
});

describe('parseAmountLoose（导入用）', () => {
  it('容忍货币符号、千分位与空格', () => {
    expect(parseAmountLoose('¥1,234.56')).toBe(123456);
    expect(parseAmountLoose(' 12.34 ')).toBe(1234);
    expect(parseAmountLoose('$1,234')).toBe(123400);
  });

  it('多余小数位按 half-up 折分', () => {
    expect(parseAmountLoose('1.999')).toBe(200);
    expect(parseAmountLoose('0.005')).toBe(1);
    expect(parseAmountLoose('0.004')).toBe(0);
    expect(parseAmountLoose('12.345')).toBe(1235);
  });

  it('保留负号，供导入侧判断收支方向', () => {
    expect(parseAmountLoose('-5.5')).toBe(-550);
  });

  it('拒绝非数字', () => {
    expect(parseAmountLoose('')).toBeNull();
    expect(parseAmountLoose('.')).toBeNull();
    expect(parseAmountLoose('-')).toBeNull();
    expect(parseAmountLoose('abc')).toBeNull();
    expect(parseAmountLoose('1e3')).toBeNull();
    expect(parseAmountLoose('9999999999')).toBeNull();
  });
});

describe('格式化', () => {
  it('千分位与两位小数', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(5)).toBe('0.05');
    expect(formatCents(50)).toBe('0.50');
    expect(formatCents(100)).toBe('1.00');
    expect(formatCents(1234)).toBe('12.34');
    expect(formatCents(1268000)).toBe('12,680.00');
    expect(formatCents(12345678901)).toBe('123,456,789.01');
  });

  it('负数只在带符号版本里出现', () => {
    expect(formatCents(-1268000)).toBe('-12,680.00');
    expect(formatMoney(-500)).toBe('-¥5.00');
    expect(formatMoney(500)).toBe('¥5.00');
    expect(formatAbsMoney(-500)).toBe('¥5.00');
  });

  it('支持自定义货币符号', () => {
    expect(formatMoney(1234, '$')).toBe('$12.34');
  });
});

describe('centsToInputString（编辑时回填键盘）', () => {
  it('去掉无意义的尾随零', () => {
    expect(centsToInputString(0)).toBe('0');
    expect(centsToInputString(1200)).toBe('12');
    expect(centsToInputString(1234)).toBe('12.34');
    expect(centsToInputString(5)).toBe('0.05');
    expect(centsToInputString(50)).toBe('0.5');
    expect(centsToInputString(1050)).toBe('10.5');
    expect(centsToInputString(1005)).toBe('10.05');
  });

  it('和 parseAmountInput 互为逆运算', () => {
    for (const cents of [0, 5, 50, 100, 1234, 1268000, 9999999999]) {
      expect(parseAmountInput(centsToInputString(cents))).toBe(cents);
    }
  });
});

describe('键盘归约', () => {
  it('小数位封顶 2 位', () => {
    expect(appendDigit('12.34', '5')).toBe('12.34');
    expect(appendDigit('12.', '3')).toBe('12.3');
  });

  it('小数点唯一，空串上按点补 0', () => {
    expect(appendDigit('', '.')).toBe('0.');
    expect(appendDigit('12', '.')).toBe('12.');
    expect(appendDigit('12.3', '.')).toBe('12.3');
  });

  it('不产生前导零', () => {
    expect(appendDigit('0', '0')).toBe('0');
    expect(appendDigit('0', '5')).toBe('5');
  });

  it('退格', () => {
    expect(backspaceAmount('12.3')).toBe('12.');
    expect(backspaceAmount('1')).toBe('');
  });
});

describe('formatKeypadDisplay', () => {
  it('整数加千分位，小数保持敲到的位数', () => {
    expect(formatKeypadDisplay('')).toBe('0.00');
    expect(formatKeypadDisplay('.')).toBe('0.00');
    expect(formatKeypadDisplay('12')).toBe('12');
    expect(formatKeypadDisplay('12.3')).toBe('12.3');
    expect(formatKeypadDisplay('12.')).toBe('12.');
    expect(formatKeypadDisplay('12680')).toBe('12,680');
    expect(formatKeypadDisplay('12680.05')).toBe('12,680.05');
  });
});

describe('聚合', () => {
  it('整数相加，1000 笔 0.07 精确等于 70 元', () => {
    expect(sumCents(Array.from({ length: 1000 }, () => 7))).toBe(7000);
    expect(sumCents([])).toBe(0);
  });

  it('centsToYuan 只用于图表刻度', () => {
    expect(centsToYuan(1234)).toBeCloseTo(12.34);
  });
});
