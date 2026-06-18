import type { useToast } from "@/hooks/use-toast";

type ToastFn = ReturnType<typeof useToast>["toast"];

const STATUS_MESSAGES: Record<number, string> = {
  400: "Invalid request — please check your input and try again.",
  401: "Session expired — please sign in again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "A conflict occurred — the resource may already exist.",
  422: "The server couldn't process this request (unprocessable data).",
  429: "Too many requests — please wait a moment and try again.",
  500: "Server error — our team has been notified. Please try again shortly.",
  502: "Service temporarily unavailable — please try again in a few seconds.",
  503: "Service is under maintenance — please check back soon.",
};

function getStatusMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? `Unexpected error (${status}) — please try again.`;
}

export async function parseApiError(response: Response): Promise<string> {
  try {
    const body = await response.clone().json() as { error?: string; message?: string };
    const detail = body.error ?? body.message;
    if (detail && typeof detail === "string") {
      return detail;
    }
  } catch {
  }
  return getStatusMessage(response.status);
}

export interface ApiErrorOptions {
  title?: string;
  fallback?: string;
}

export function handleApiError(
  err: unknown,
  toast: ToastFn,
  options: ApiErrorOptions = {},
): void {
  const { title = "Request failed", fallback = "An unexpected error occurred. Please try again." } = options;

  let description = fallback;

  if (err instanceof ApiError) {
    description = err.userMessage;
  } else if (err instanceof Error) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      description = "Network error — check your connection and try again.";
    } else if (err.message.includes("aborted") || err.message.includes("AbortError")) {
      return;
    } else {
      description = err.message;
    }
  }

  toast({ variant: "destructive", title, description });
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly userMessage: string,
    public readonly raw?: unknown,
  ) {
    super(userMessage);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw err instanceof Error ? err : new Error("Network request failed");
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new ApiError(response.status, message, response);
  }

  return response.json() as Promise<T>;
}
