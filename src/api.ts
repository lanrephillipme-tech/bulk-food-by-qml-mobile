import { API_BASE_URL } from "./config";

export type AuthRole = "customer" | "vendor" | "financier" | "logistics" | "corporate";

export type AuthSession = {
  token?: string;
  userId?: string;
  authMethod?: string;
  requestedRole?: string;
  provider?: string;
  status?: string;
  expiresAt?: string | null;
};

export type AuthUser = {
  id?: string;
  full_name?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  country?: string;
  city?: string;
};

export type AuthBundle = {
  session?: AuthSession;
  user?: AuthUser;
  roles?: unknown;
  wallets?: unknown[];
  plans?: unknown[];
  requiresConfirmation?: boolean;
  message?: string;
};

type ApiOptions = {
  token?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, body: Record<string, unknown>, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(String(message), response.status);
  }
  return payload as T;
}

export function signIn(identifier: string, password: string) {
  return request<AuthBundle>("/api/auth/signin", { identifier, password });
}

export function signUp(input: {
  name: string;
  identifier: string;
  password: string;
  role: AuthRole;
  referralCode?: string;
}) {
  return request<AuthBundle>("/api/auth/signup", input);
}

export function requestPasswordReset(identifier: string) {
  return request<{ message?: string }>("/api/auth/password-reset", { identifier });
}

export function registerPushToken(input: {
  token: string;
  platform: string;
  deviceName?: string | null;
  projectId?: string | null;
}, sessionToken?: string) {
  return request<{ registered: boolean; status: string }>("/api/devices/push-token", input, { token: sessionToken });
}
