import { API_URL } from "./api";
import type { SyntheticEvent } from "react";

export const productFallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

export function imageUrl(url?: string | null) {
  if (!url) return productFallbackImage;
  if (url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }

  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export function useFallbackImage(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src !== productFallbackImage) {
    event.currentTarget.src = productFallbackImage;
  }
}
