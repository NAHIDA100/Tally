export type Cents = number;

/**
 * 金额在本项目中永远是「整数分」。
 * 上限 99,999,999.99 元（整数部分 8 位），保证 Number(intPart) * 100 仍是精确整数，
 * 也保证 SQLite 的 INTEGER（64 位）与 JS 的 double 都不会溢出。
 * INTEGER_DIGITS_MAX 留到 9 位只是乘法前的粗筛，真正卡住上限的是下面的 MAX_CENTS 比较。
 */
export const MAX_CENTS = 9_999_999_999;
export const DEFAULT_CURRENCY_SYMBOL = '¥';

const INTEGER_DIGITS_MAX = 9;
const DECIMAL_DIGITS_MAX = 2;
const KEYPAD_PATTERN = /^\d*(\.\d*)?$/;

/**
 * 把「元」的十进制字符串拆成整数分。
 * 刻意用字符串分段而不是 parseFloat(x) * 100：后者在 0.07、1.15 这类值上会产生
 * 0.07000000000000001 * 100 = 7.000000000000001，再 Math.round 只是掩盖问题。
 */
function decimalPartsToCents(intPart: string, fracPart: string): Cents {
  const yuan = Number(intPart || '0') * 100;
  const cents = Number(fracPart.padEnd(DECIMAL_DIGITS_MAX, '0').slice(0, DECIMAL_DIGITS_MAX));
  return yuan + cents;
}

/** 记一笔数字键盘产出的字符串 → 分。非法或超出上限返回 null。 */
export function parseAmountInput(raw: string): Cents | null {
  const value = raw.trim();
  if (value === '' || value === '.' || !KEYPAD_PATTERN.test(value)) return null;

  const [intPart, fracPart = ''] = value.split('.');
  if (intPart.length > INTEGER_DIGITS_MAX) return null;
  // 键盘本身不会产出 3 位小数；走到这里说明调用方给了脏数据。
  // 静默截断会让 1.999 变成 1.99 而无人察觉，宁可判非法。
  if (fracPart.length > DECIMAL_DIGITS_MAX) return null;

  const cents = decimalPartsToCents(intPart, fracPart);
  return cents > MAX_CENTS ? null : cents;
}

/**
 * CSV / JSON 导入用的宽松解析：容忍千分位逗号、货币符号、多余空格与多余小数位。
 * 超出 2 位小数时按「四舍五入（half-up）」折分到角分，因为导入的是别人写下的历史账，
 * 丢弃精度比拒收整份文件更可用。
 */
export function parseAmountLoose(raw: string): Cents | null {
  const cleaned = raw.replace(/[\s,\u00a5\uFFE5$]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned) || cleaned === '.') return null;

  const negative = cleaned.startsWith('-');
  const unsigned = negative ? cleaned.slice(1) : cleaned;
  const [intPart, fracPart = ''] = unsigned.split('.');
  if (intPart.length > INTEGER_DIGITS_MAX) return null;

  const { cents: fracCents, carryYuan } = fracToCentsRounded(fracPart);
  const yuan = Number(intPart || '0') + carryYuan;
  const cents = yuan * 100 + fracCents;
  if (cents > MAX_CENTS) return null;
  return negative ? -cents : cents;
}

/** 第 3 位小数决定进位，全程字符串取值，不经过浮点乘除 */
function fracToCentsRounded(fracPart: string): { cents: number; carryYuan: number } {
  const padded = fracPart.padEnd(3, '0');
  let cents = Number(padded.slice(0, DECIMAL_DIGITS_MAX));
  let carryYuan = 0;
  if (Number(padded[DECIMAL_DIGITS_MAX]) >= 5) cents += 1;
  if (cents === 100) {
    cents = 0;
    carryYuan = 1;
  }
  return { cents, carryYuan };
}

/** 分 → 元（仅用于图表坐标轴缩放，不参与任何金额计算） */
export function centsToYuan(cents: Cents): number {
  return cents / 100;
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((acc, v) => acc + v, 0);
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 1234 → "12.34"，-1268000 → "-12,680.00" */
export function formatCents(cents: Cents): string {
  const safe = Math.round(cents);
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const yuan = Math.trunc(abs / 100);
  const frac = abs % 100;
  const body = `${groupThousands(String(yuan))}.${String(frac).padStart(DECIMAL_DIGITS_MAX, '0')}`;
  return negative ? `-${body}` : body;
}

/**
 * 无千分位的两位小数，供 CSV 与数字输入框使用。
 * formatCents 的逗号是给「看」的，会破坏 Excel/解析器的数字识别。
 */
export function centsToPlainString(cents: Cents): string {
  const safe = Math.round(cents);
  const negative = safe < 0;
  const abs = Math.abs(safe);
  const body = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(DECIMAL_DIGITS_MAX, '0')}`;
  return negative ? `-${body}` : body;
}

/** 带符号：-¥12.34 */
export function formatMoney(cents: Cents, symbol = DEFAULT_CURRENCY_SYMBOL): string {
  const body = `${symbol}${formatCents(Math.abs(Math.round(cents)))}`;
  return cents < 0 ? `-${body}` : body;
}

/** 不带符号：账单列表里支出/收入靠颜色区分，不重复表达正负 */
export function formatAbsMoney(cents: Cents, symbol = DEFAULT_CURRENCY_SYMBOL): string {
  return `${symbol}${formatCents(Math.abs(Math.round(cents)))}`;
}

/** 分 → 键盘初始显示的字符串：1200 → "12"，5 → "0.05"，50 → "0.5" */
export function centsToInputString(cents: Cents): string {
  const abs = Math.abs(Math.round(cents));
  const yuan = Math.trunc(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return String(yuan);
  return `${yuan}.${String(frac).padStart(DECIMAL_DIGITS_MAX, '0').replace(/0$/, '')}`;
}

/**
 * 数字键盘的按键归约：把 "12." 这类中间态补成可显示的 "12."，
 * 并硬性保证小数位不超过 2 —— 超出的按键直接忽略，避免出现 "1.999" 这种无法回放的输入。
 */
export function appendDigit(current: string, key: string): string {
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  const [intPart, fracPart] = current.split('.');
  if (fracPart !== undefined) {
    if (fracPart.length >= DECIMAL_DIGITS_MAX) return current;
    return `${intPart}.${fracPart}${key}`;
  }
  if (intPart.replace(/^0+(?=\d)/, '').length >= INTEGER_DIGITS_MAX) return current;
  // 输入 0 时不允许出现 "00"、"05" 这类前导零
  if (intPart === '0' && key === '0') return '0';
  if (intPart === '0') return key;
  return intPart + key;
}

export function backspaceAmount(current: string): string {
  return current.slice(0, -1);
}

/**
 * 键盘上方显示用的字符串：整数部分加千分位，小数部分保持用户敲到的位数。
 *
 * 不直接复用 formatCents 是因为那会把 "12.3" 补成 "12.30"，
 * 让正在输入的人误以为已经多敲了一个 0。
 */
export function formatKeypadDisplay(raw: string): string {
  if (raw === '' || raw === '.') return '0.00';
  const [intPart, fracPart] = raw.split('.');
  const grouped = groupThousands(intPart === '' ? '0' : intPart);
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
}
