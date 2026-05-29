---
name: ErrorType and TanStack Query v5 query options
description: How to handle ErrorType<T> from generated hooks and the queryKey requirement in TanStack Query v5.
---

## ErrorType<T>
`ErrorType<T> = ApiError<T>` where `ApiError extends Error`. Properties:
- `.message` — human-readable error string (built from response body fields)
- `.status` / `.statusText` — HTTP status
- `.data: T | null` — parsed response body (e.g. `ErrorResponse = { error: string }`)
- `.headers`, `.response`, `.method`, `.url`

**Access the error string from `ErrorType<ErrorResponse>` via:** `err.data?.error`
NOT `err.error` (that property doesn't exist on ApiError).

## TanStack Query v5 queryKey in generated hooks
Generated hooks (`useGetBacktest`, `useGetStrategy`, etc.) accept `{ query?: UseQueryOptions<...> }`. In TanStack Query v5, `UseQueryOptions` technically requires `queryKey`, even though the hook provides a default.

**Fix:** Cast partial options as `any`:
```ts
{ query: { enabled: !!id } as any }
```

**Why:** The hook computes its own `queryKey` from its arguments and merges it with the passed options — so omitting `queryKey` is safe at runtime, but TypeScript strict mode complains.
