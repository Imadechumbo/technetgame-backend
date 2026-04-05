export function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

export function compareByDateDesc(a, b) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}
