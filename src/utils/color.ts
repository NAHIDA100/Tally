/** 把 #RRGGBB 转成带透明度的 rgba()，用于分类图标的浅色底块。 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#?([\da-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
