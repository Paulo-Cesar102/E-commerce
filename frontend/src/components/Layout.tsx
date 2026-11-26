import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Grid3X3, MapPin, Menu, MessageCircle, Moon, Search, ShoppingBag, Sparkles, Store, Sun, Tag, UserRound, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { imageUrl, useFallbackImage } from "../lib/images";
import { useAuthStore } from "../store/auth";
import type { Cart, Category } from "../types";
import { getInitials } from "../lib/format";
import { useThemeStore } from "../store/theme";
import { AdminSupportCenter } from "./AdminSupportCenter";
import { AdminOperations } from "./AdminOperations";
import { AdminCommandBar, type AdminTab } from "./AdminCommandBar";
import { AdminReturnsPanel } from "./AdminReturnsPanel";
import { AdminCouponsPanel } from "./AdminCouponsPanel";

let initialRefresh: Promise<string | null> | null = null;
function refreshFromCookie() {
  if (!initialRefresh) {
    initialRefresh = api<{ accessToken: string }>("/auth/refresh", { method: "POST", auth: false, retry: false, body: "{}" })
      .then((session) => session.accessToken)
      .catch(() => null);
  }
  return initialRefresh;
}

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [adminTab, setAdminTab] = useState<AdminTab>("overview");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken, updateUser, updateAccessToken, finishInitialization, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/products/categories", { auth: false }),
  });
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api<Cart>("/cart"),
    enabled: Boolean(accessToken),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Array<{ readAt?: string | null }>>("/notifications"),
    enabled: Boolean(accessToken),
  });

  const cartCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const token = accessToken ?? await refreshFromCookie();
        if (!token) throw new Error("No active refresh session");
        if (!accessToken) updateAccessToken(token);
        const response = await api<{ user: typeof user }>("/auth/me");
        if (active && response.user) updateUser(response.user);
      } catch {
        if (active) logout();
      } finally {
        if (active) finishInitialization();
      }
    })();
    return () => { active = false; };
  }, []);

  async function endSession() {
    try { await api("/auth/logout", { method: "POST", auth: false, retry: false }); } catch { /* always clear the in-memory session */ }
    logout();
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    navigate(search.trim() ? `/buscar?q=${encodeURIComponent(search.trim())}` : "/buscar");
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      <div className="top-strip">
        <span>Entrega acompanhada em cada etapa</span>
        <span>Compra protegida</span>
        <span>Atendimento direto com a loja</span>
      </div>
      <header className="site-header">
        <div className="header-main">
          <button className="icon-button mobile-only" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu size={22} />
          </button>
          <Link to="/" className="brand" aria-label="Vitrine">
            <span className="brand-mark">V</span>
            <span>VITRINE</span>
          </Link>
          <form className="header-search desktop-search" onSubmit={submitSearch}>
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="O que você está procurando?"
              aria-label="Buscar produtos"
            />
            <button type="submit">Buscar</button>
          </form>
          <nav className="header-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label={`Ativar tema ${theme === "light" ? "escuro" : "claro"}`} title={`Tema ${theme === "light" ? "escuro" : "claro"}`}>
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            {user ? (
              <div className="account-menu">
                <button className="account-trigger">
                  <span className="avatar">{getInitials(user.name)}</span>
                  <span className="account-copy">
                    <small>Olá,</small>
                    <strong>{user.name.split(" ")[0]}</strong>
                  </span>
                </button>
                <div className="account-dropdown">
                  <Link to="/pedidos">Meus pedidos</Link>
                  <Link to="/anunciar">Venda rápida</Link>
                  <Link to="/chat">Mensagens</Link>
                  {user.role !== "CUSTOMER" && <Link to="/dashboard">Painel da loja</Link>}
                  {user.role === "ADMIN" && <Link to="/admin">Administração</Link>}
                  <Link to="/conta/privacidade">Privacidade e conta</Link>
                  <Link to="/enderecos">Endereços</Link>
                  <button onClick={() => void endSession()}>Sair</button>
                </div>
              </div>
            ) : (
              <Link className="header-action" to="/entrar">
                <UserRound size={21} />
                <span>Entrar</span>
              </Link>
            )}
            <Link className="header-action hide-small" to="/chat" aria-label="Mensagens">
              <MessageCircle size={21} />
              <span>Mensagens</span>
            </Link>
            {user && <Link className="header-action notification-action" to="/notificacoes" aria-label="Notificações" title="Notificações"><span className="notification-icon"><Bell size={20} />{notifications.some((notification) => !notification.readAt) && <span className="notification-badge">!</span>}</span><span>Notificações</span></Link>}
            <Link className="cart-action" to="/carrinho" aria-label="Carrinho">
              <ShoppingBag size={22} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </Link>
          </nav>
        </div>
        <form className="header-search mobile-search" onSubmit={submitSearch}>
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na Vitrine" />
        </form>
        <nav className="category-nav">
          <div className="category-mega-trigger">
            <NavLink to="/buscar"><Grid3X3 size={16} /> Categorias <ChevronDown size={14} /></NavLink>
            <div className="category-mega">
              {categories.slice(0, 10).map((category) => (
                <Link key={category.id} to={`/buscar?categoryId=${category.id}`}>
                  <span className="category-mini-image">
                    {category.products?.[0]?.images?.[0]?.url ? <img src={imageUrl(category.products[0].images[0].url)} onError={useFallbackImage} alt="" /> : category.name[0]}
                  </span>
                  <span><strong>{category.name}</strong><small>{category._count?.products ?? 0} produtos</small></span>
                </Link>
              ))}
            </div>
          </div>
          <NavLink to="/recomendados"><Sparkles size={15} /> Recomendados</NavLink>
          <NavLink to="/buscar?listingType=QUICK_SALE" className={location.pathname === "/buscar" && new URLSearchParams(location.search).get("listingType") === "QUICK_SALE" ? "active" : ""}><Tag size={15} /> Venda rápida</NavLink>
          <NavLink to="/buscar?condition=USED" className={location.pathname === "/buscar" && new URLSearchParams(location.search).get("condition") === "USED" ? "active" : ""}><Tag size={15} /> Itens usados</NavLink>
          <NavLink to="/buscar?localOnly=true" className={location.pathname === "/buscar" && new URLSearchParams(location.search).get("localOnly") === "true" ? "active" : ""}><MapPin size={15} /> Produtos locais</NavLink>
          <NavLink to="/buscar?sort=new">Novidades</NavLink>
          <NavLink to="/buscar?sort=price_asc">Melhores ofertas</NavLink>
          <NavLink to="/anunciar">Anunciar item</NavLink>
          <NavLink to="/sobre">Sobre a Vitrine</NavLink>
          {user?.role !== "CUSTOMER" && user && (
            <NavLink to={user.role === "ADMIN" ? "/admin" : "/dashboard"} className="seller-link">
              <Store size={16} /> {user.role === "ADMIN" ? "Administração" : "Área do vendedor"}
            </NavLink>
          )}
        </nav>
      </header>

      {mobileOpen && (
        <div className="drawer-backdrop" onClick={() => setMobileOpen(false)}>
          <aside className="mobile-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <Link to="/" className="brand" onClick={() => setMobileOpen(false)}>
                <span className="brand-mark">V</span>
                <span>VITRINE</span>
              </Link>
              <button className="icon-button" onClick={() => setMobileOpen(false)}><X size={22} /></button>
            </div>
            <nav>
              <Link to="/buscar" onClick={() => setMobileOpen(false)}>Explorar produtos</Link>
              <Link to="/recomendados" onClick={() => setMobileOpen(false)}>Mais bem avaliados</Link>
              {categories.slice(0, 6).map((category) => <Link key={category.id} to={`/buscar?categoryId=${category.id}`} onClick={() => setMobileOpen(false)}>{category.name}</Link>)}
              <Link to="/buscar?listingType=QUICK_SALE" onClick={() => setMobileOpen(false)}>Venda rápida</Link>
              <Link to="/buscar?condition=USED" onClick={() => setMobileOpen(false)}>Itens usados</Link>
              <Link to="/buscar?localOnly=true" onClick={() => setMobileOpen(false)}>Produtos locais</Link>
              <Link to="/pedidos" onClick={() => setMobileOpen(false)}>Meus pedidos</Link>
              <Link to="/anunciar" onClick={() => setMobileOpen(false)}>Anunciar item</Link>
              <Link to="/chat" onClick={() => setMobileOpen(false)}>Mensagens</Link>
              <Link to="/sobre" onClick={() => setMobileOpen(false)}>Sobre a Vitrine</Link>
              {user?.role !== "CUSTOMER" && user && <Link to="/dashboard" onClick={() => setMobileOpen(false)}>Painel da loja</Link>}
              {user?.role === "ADMIN" && <Link to="/admin" onClick={() => setMobileOpen(false)}>Administração</Link>}
            </nav>
          </aside>
        </div>
      )}

      <main className={location.pathname === "/admin" && user?.role === "ADMIN" ? `admin-route admin-tab-${adminTab}` : undefined}>{location.pathname === "/admin" && user?.role === "ADMIN" && <AdminCommandBar active={adminTab} onChange={setAdminTab} />}{children}{location.pathname === "/admin" && user?.role === "ADMIN" && adminTab === "support" && <AdminSupportCenter />}{location.pathname === "/admin" && user?.role === "ADMIN" && (adminTab === "sellers" || adminTab === "audit") && <AdminOperations />}{location.pathname === "/admin" && user?.role === "ADMIN" && adminTab === "returns" && <AdminReturnsPanel />}{location.pathname === "/admin" && user?.role === "ADMIN" && adminTab === "coupons" && <AdminCouponsPanel />}</main>
      <footer className="site-footer">
        <div>
          <Link to="/" className="brand brand-light"><span className="brand-mark">V</span><span>VITRINE</span></Link>
          <p>Produtos de lojas reais, escolhidos para fazer sentido na sua rotina.</p>
        </div>
        <div><strong>Comprar</strong><Link to="/buscar">Produtos</Link><Link to="/pedidos">Meus pedidos</Link></div>
        <div><strong>Atendimento</strong><Link to="/chat">Falar com a loja</Link><Link to="/sobre">Sobre nós</Link></div>
        <div><strong>Vender</strong><Link to="/anunciar">Venda rápida</Link><Link to="/criar-conta?tipo=vendedor">Criar minha loja</Link><Link to="/dashboard">Painel do vendedor</Link></div>
      </footer>
    </div>
  );
}
