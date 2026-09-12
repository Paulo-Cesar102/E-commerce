import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type ApiOptions = Omit<AxiosRequestConfig, "url" | "auth"> & {
  auth?: boolean;
  retry?: boolean;
  body?: BodyInit | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const http = axios.create({ baseURL: API_URL, withCredentials: true });

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { accessToken, updateAccessToken, logout } = useAuthStore.getState();
  const { auth, retry, body, ...requestOptions } = options;
  const headers = { ...options.headers } as Record<string, string>;
  const isFormData = requestOptions.data instanceof FormData;

  if (auth !== false && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!isFormData) headers["Content-Type"] = "application/json";

  try {
    const response = await http.request<T>({
      ...requestOptions,
      url: path,
      headers,
      data: body ? JSON.parse(String(body)) : requestOptions.data,
    });
    return response.data;
  } catch (caught) {
    const error = caught as AxiosError<{ message?: string }>;

    if (error.response?.status === 401 && retry !== false) {
      try {
        const response = await http.post<{ accessToken: string }>("/auth/refresh");
        updateAccessToken(response.data.accessToken);
        return api<T>(path, { ...options, retry: false });
      } catch {
        logout();
      }
    }

    throw new ApiError(
      error.response?.data?.message ?? "Nao foi possivel concluir a operacao",
      error.response?.status ?? 500,
    );
  }
}
