const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

const normalizeBaseUrl = (value?: string) => {
  if (!value) return "";
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const API_BASE_URL = normalizeBaseUrl(rawApiBaseUrl);

export const apiUrl = (path: string) => {
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};
