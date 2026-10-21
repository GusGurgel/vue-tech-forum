export function getPayload(body = {}) {
  // Strapi's transformer plugin accepted a `{ data: {...} }` request body.
  return body && typeof body === 'object' && body.data && typeof body.data === 'object'
    ? body.data
    : body;
}

export function relationId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (typeof value === 'object') {
    if (value.id !== undefined) return relationId(value.id);
    if (Array.isArray(value.connect) && value.connect.length) return relationId(value.connect[0]?.id);
    if (Array.isArray(value.set) && value.set.length) return relationId(value.set[0]?.id);
  }
  return null;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    username: row.username,
    email: row.email,
    confirmed: row.confirmed,
    blocked: row.blocked,
    image: row.image ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at
  };
}

export function getQueryValue(query, bracketKey) {
  if (query?.[bracketKey] !== undefined) return query[bracketKey];
  const firstBracket = bracketKey.indexOf('[');
  if (firstBracket < 0) return query?.[bracketKey];
  const root = bracketKey.slice(0, firstBracket);
  const parts = [...bracketKey.slice(firstBracket).matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
  let value = query?.[root];
  for (const part of parts) {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    value = value[part];
  }
  return value;
}

export function readPagination(query) {
  const nestedPage = getQueryValue(query, 'pagination[page]');
  const nestedPageSize = getQueryValue(query, 'pagination[pageSize]');
  const nestedStart = getQueryValue(query, 'pagination[start]');
  const page = Math.max(1, Number(nestedPage ?? query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(nestedPageSize ?? query.pageSize ?? query.limit ?? 25) || 25));
  const offset = Math.max(0, Number(nestedStart ?? query.start ?? ((page - 1) * pageSize)) || 0);
  return { page, pageSize, offset };
}

export function flattenSqlRows(rows) {
  // Explicit helper for collections when we want numbers instead of pg's bigint strings.
  return rows.map((row) => ({ ...row, id: Number(row.id) }));
}
