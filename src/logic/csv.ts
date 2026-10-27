/**
 * 最小 CSV 编解码。
 *
 * 不引第三方 csv 库：本项目只需要「带引号的字段 + 双写转义 + CRLF」这一档语义，
 * 而 RFC 4180 的实现不到 40 行；引一个库反而会让导入路径的行为不可控。
 */

/** 去掉 Excel 另存为时加的 UTF-8 BOM，否则第一列的表头永远匹配不上 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(text: string): string[][] {
  const input = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        // "" 表示一个字面量双引号；单独的 " 才是字段结束
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === ',') endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') field += char;
  }

  // 收尾：最后一个字段/行后面没有换行符
  if (field !== '' || row.length > 0) endRow();

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((row) => row.map(escapeField).join(',')).join('\r\n');
}
