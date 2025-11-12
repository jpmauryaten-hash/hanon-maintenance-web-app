import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

export const resolveApiUrl = (input: string): string => {
  if (!API_BASE_URL) {
    return input;
  }

  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  const normalizedBase = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedInput = input.startsWith("/") ? input : `/${input}`;

  try {
    return new URL(normalizedInput, normalizedBase).toString();
  } catch {
    const fallbackBase = normalizedBase.replace(/\/+$/, "");
    if (normalizedInput.startsWith("/")) {
      return `${fallbackBase}${normalizedInput}`;
    }
    return `${fallbackBase}/${normalizedInput}`;
  }
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const target = resolveApiUrl(url);
  const res = await fetch(target, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const target = resolveApiUrl(queryKey.join("/") as string);
    const res = await fetch(target, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
