import { describe, expect, it } from 'vitest';

import { parseCsv, toCsv } from '../src/logic/csv';

describe('toCsv', () => {
  it('表头 + 行，用 CRLF 分隔', () => {
    expect(toCsv(['a', 'b'], [['1', '2'], ['3', '4']])).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('含逗号、引号、换行的字段被加引号并双写转义', () => {
    expect(toCsv(['x'], [['a,b']])).toBe('x\r\n"a,b"');
    expect(toCsv(['x'], [['say "hi"']])).toBe('x\r\n"say ""hi"""');
    expect(toCsv(['x'], [['line1\nline2']])).toBe('x\r\n"line1\nline2"');
  });
});

describe('parseCsv', () => {
  it('基本解析', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('往返一致：转义过的字段能原样读回来', () => {
    const rows = [['含,逗号'], ['含"引号"'], ['含\n换行'], ['普通']];
    expect(parseCsv(toCsv(['col'], rows))).toEqual([['col'], ...rows]);
  });

  it('容忍 CRLF 与结尾换行', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('剥掉 Excel 写的 UTF-8 BOM，否则表头永远匹配不上', () => {
    expect(parseCsv('a,b\n1,2')[0]).toEqual(['a', 'b']);
  });

  it('丢弃全空行', () => {
    expect(parseCsv('a,b\n\n1,2\n , ')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('空文本得到空数组', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
