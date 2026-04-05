export function formatLakhs(value: number): string {
  if (value >= 100) {
    return `₹${(value / 100).toFixed(2)} Cr`;
  }
  return `₹${value.toFixed(1)} L`;
}

export function formatLakhsShort(value: number): string {
  if (value >= 100) {
    return `₹${(value / 100).toFixed(1)} Cr`;
  }
  return `₹${Math.round(value)}L`;
}

export function formatPricePerSqft(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}/sqft`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-IN");
}

export function formatPercent(value: number, showSign = true): string {
  const sign = value >= 0 && showSign ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
