import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import "./styles.css";
import { useThemeStore } from "./store/theme";

document.documentElement.dataset.theme = useThemeStore.getState().theme;
document.documentElement.style.colorScheme = useThemeStore.getState().theme;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const application = (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{application}</GoogleOAuthProvider> : application}
  </StrictMode>,
);
