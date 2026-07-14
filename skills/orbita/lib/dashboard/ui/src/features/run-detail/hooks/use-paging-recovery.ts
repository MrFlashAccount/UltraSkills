import { useState } from "react";
import { type PagingState } from "../run-detail-view-model";
import { isStaleLocatorError } from "./query-client";

export type PagingQuery = {
  error: unknown;
  fetchNextPage: () => Promise<{ error: unknown }>;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  refetch: () => Promise<{ error: unknown }>;
};

/** Retains fetch-more failures that TanStack reports only on the returned result. */
export function usePagingRecovery() {
  const [pagingErrors, setPagingErrors] = useState<Record<string, unknown>>({});

  const record = (key: string, error: unknown) => {
    setPagingErrors((current) => {
      if (error) {
        return { ...current, [key]: error };
      }
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  };
  const loadNext = (key: string, query: PagingQuery) => {
    void query.fetchNextPage().then((result) => record(key, result.error));
  };
  const refetch = (key: string, query: PagingQuery) => {
    void query.refetch().then((result) => record(key, result.error));
  };
  const recover = (key: string, query: PagingQuery) => {
    const error = pagingErrors[key] ?? query.error;
    if (isStaleLocatorError(error)) {
      // Infinite-query refetch starts from page one and keeps last-good pages
      // visible until the replacement chain succeeds.
      refetch(key, query);
    } else {
      loadNext(key, query);
    }
  };
  const state = (key: string, query: PagingQuery): PagingState => {
    const error = pagingErrors[key] ?? query.error;
    if (query.isFetchingNextPage) {
      return "loading";
    }
    if (error) {
      return isStaleLocatorError(error) ? "stale" : "error";
    }
    return query.hasNextPage ? "more" : "complete";
  };

  return { loadNext, recover, refetch, state };
}
