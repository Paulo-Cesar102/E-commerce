import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { Layout } from "./components/Layout";
import { Loader } from "./components/UI";
import { useAuthStore } from "./store/auth";
import { HomePage } from "./pages/HomePage";
import { CatalogPage } from "./pages/CatalogPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { AuthPage } from "./pages/AuthPage";
import { OrdersPage } from "./pages/OrdersPage";
import { AboutPage } from "./pages/AboutPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { StorePage } from "./pages/StorePage";
import { RecommendedPage } from "./pages/RecommendedPage";
import { AddressesPage } from "./pages/AddressesPage";

const ChatPage = lazy(() => import("./pages/ChatPage").then((module) => ({ default: module.ChatPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));

function Protected({ children, seller = false }: { children: ReactNode; seller?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  if (!user) return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
  if (seller && user.role === "CUSTOMER") return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/buscar" element={<CatalogPage />} />
        <Route path="/produto/:id" element={<ProductPage />} />
        <Route path="/loja/:sellerId" element={<StorePage />} />
        <Route path="/recomendados" element={<RecommendedPage />} />
        <Route path="/carrinho" element={<Protected><CartPage /></Protected>} />
        <Route path="/entrar" element={<AuthPage mode="login" />} />
        <Route path="/criar-conta" element={<AuthPage mode="register" />} />
        <Route path="/pedidos" element={<Protected><OrdersPage /></Protected>} />
        <Route path="/enderecos" element={<Protected><AddressesPage /></Protected>} />
        <Route path="/chat" element={<Protected><Suspense fallback={<Loader label="Abrindo mensagens" />}><ChatPage /></Suspense></Protected>} />
        <Route path="/dashboard" element={<Protected seller><Suspense fallback={<Loader label="Abrindo painel" />}><DashboardPage /></Suspense></Protected>} />
        <Route path="/sobre" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
