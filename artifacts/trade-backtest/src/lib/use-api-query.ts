import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { apiFetch } from "./api-error";
import { API_BASE } from "./api-config";

export interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn"> {
  token?: string | null;
  headers?: Record<string, string>;
}

export function useApiQuery<T>(
  path: string,
  options: UseApiQueryOptions<T> = {},
): ReturnType<typeof useQuery<T, Error>> {
  const { token, headers: extraHeaders, ...queryOptions } = options;

  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, ...extraHeaders }
    : { ...extraHeaders };

  const queryKey: QueryKey = [path, token ?? "anon"];

  return useQuery<T, Error>({
    queryKey,
    queryFn: () =>
      apiFetch<T>(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json", ...authHeaders },
      }),
    enabled: options.enabled !== false && token !== null,
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if ("status" in error && typeof (error as { status: number }).status === "number") {
        const status = (error as { status: number }).status;
        if (status === 401 || status === 403 || status === 404 || status === 422) return false;
      }
      return failureCount < 2;
    },
    ...queryOptions,
  });
}
