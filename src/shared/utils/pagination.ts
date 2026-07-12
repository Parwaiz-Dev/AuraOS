/**
 * Shared pagination utilities.
 *
 * parsePagination() — extract limit/offset from query params with safe caps.
 * paginatedResponse() — wrap a list + total in the standard envelope.
 */

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Parse `limit` and `offset` from Express query params, capping limit to
 * MAX_LIMIT and flooring offset to 0.
 */
export function parsePagination(query: Record<string, any>): PaginationParams {
  const rawLimit = parseInt(query.limit as string, 10);
  const rawOffset = parseInt(query.offset as string, 10);
  return {
    limit: Math.min(Math.max(rawLimit || DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: Math.max(rawOffset || 0, 0),
  };
}

/**
 * Build a paginated response payload from a data array and a total count.
 */
export function paginatedResponse<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return {
    items,
    total,
    limit: params.limit,
    offset: params.offset,
    hasMore: params.offset + items.length < total,
  };
}
