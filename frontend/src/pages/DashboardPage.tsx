import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Boxes, Check, CircleDollarSign, Edit3, MessageCircle, PackageCheck, Plus, Search, Settings, ShoppingBag, Store, Trash2, UploadCloud, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import type { Category, Order, Product } from "../types";
import { ErrorState, Loader, StatusBadge } from "../components/UI";

type Dashboard = {
  seller: { id: string; storeName: string; description?: string };
  totalSales: number;
  revenue: number;
  profit: number;
  financialChart: { date: string; total: number }[];
  products: Product[];
  recentOrders: Order[];
  categories: Category[];
};

type Tab = "overview" | "products" | "orders" | "settings";

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [productModal, setProductModal] = useState<Product | "new" | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/seller/dashboard") });

  if (isLoading) return <Loader label="Montando seu painel" />;
  if (error || !data) return <div className="dashboard-error"><ErrorState message={(error as Error)?.message} /></div>;

  return <div className="dashboard-layout">
    <aside className="dashboard-sidebar">
      <div className="dashboard-store"><span><Store size={20} /></span><div><small>Minha loja</small><strong>{data.seller.storeName}</strong></div></div>
      <nav>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 /> Visão geral</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}><Boxes /> Produtos</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><ShoppingBag /> Pedidos</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings /> Configurações</button>
      </nav>
      <a href="/chat"><MessageCircle size={18} /> Central de mensagens</a>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-top"><div><span className="eyebrow">Painel do vendedor</span><h1>{tab === "overview" ? "Visão geral" : tab === "products" ? "Produtos" : tab === "orders" ? "Pedidos" : "Configurações"}</h1></div>{tab === "products" && <div className="dashboard-head-actions"><span className="shared-category-note">Categorias compartilhadas com compradores</span><button className="button button-primary" onClick={() => setProductModal("new")}><Plus size={18} /> Novo produto</button></div>}</header>
      {tab === "overview" && <Overview data={data} onNavigate={setTab} />}
      {tab === "products" && <Products data={data} onEdit={setProductModal} />}
      {tab === "orders" && <SellerOrders orders={data.recentOrders} />}
      {tab === "settings" && <SettingsView seller={data.seller} />}
    </section>
    {productModal && <ProductModal product={productModal} categories={data.categories} onClose={() => setProductModal(null)} onDone={() => { setProductModal(null); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); }} />}
  </div>;
}

function Overview({ data, onNavigate }: { data: Dashboard; onNavigate: (tab: Tab) => void }) {
  const activeProducts = data.products.filter((product) => product.status === "ACTIVE").length;
  return <div className="dashboard-content">
    <div className="metric-grid">
      <article><span className="metric-icon coral"><CircleDollarSign /></span><div><small>Faturamento</small><strong>{formatPrice(data.revenue)}</strong><span>Vendas aprovadas</span></div></article>
      <article><span className="metric-icon green"><PackageCheck /></span><div><small>Total de vendas</small><strong>{data.totalSales}</strong><span>Pedidos pagos</span></div></article>
      <article><span className="metric-icon blue"><BarChart3 /></span><div><small>Lucro estimado</small><strong>{formatPrice(data.profit)}</strong><span>Antes de custos e taxas</span></div></article>
      <article><span className="metric-icon yellow"><Boxes /></span><div><small>Produtos ativos</small><strong>{activeProducts}</strong><span>{data.products.length} cadastrados</span></div></article>
    </div>
    <div className="dashboard-grid">
      <article className="chart-panel"><header><div><h2>Desempenho financeiro</h2><p>Receita por dia</p></div><span>Último período</span></header>{data.financialChart.length ? <ResponsiveContainer width="100%" height={300}><AreaChart data={data.financialChart}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ee5d43" stopOpacity={0.35}/><stop offset="100%" stopColor="#ee5d43" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e6e0"/><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} axisLine={false} tickLine={false}/><YAxis tickFormatter={(value) => `R$${value}`} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => formatPrice(Number(value))}/><Area type="monotone" dataKey="total" stroke="#ee5d43" strokeWidth={3} fill="url(#chartFill)"/></AreaChart></ResponsiveContainer> : <div className="chart-empty">Seu gráfico aparece assim que a primeira venda for aprovada.</div>}</article>
      <article className="quick-panel"><header><h2>Ações rápidas</h2></header><button onClick={() => onNavigate("products")}><span><Plus /></span><div><strong>Cadastrar produto</strong><small>Adicione um item ao catálogo</small></div></button><a href="/chat"><span><MessageCircle /></span><div><strong>Responder clientes</strong><small>Abrir central de mensagens</small></div></a><button onClick={() => onNavigate("orders")}><span><ShoppingBag /></span><div><strong>Gerenciar pedidos</strong><small>Atualize entregas e status</small></div></button></article>
    </div>
    <div className="dashboard-table-panel"><header><div><h2>Pedidos recentes</h2><p>Últimas movimentações da sua loja</p></div><button onClick={() => onNavigate("orders")}>Ver todos</button></header><OrderTable orders={data.recentOrders.slice(0, 5)} /></div>
  </div>;
}

function Products({ data, onEdit }: { data: Dashboard; onEdit: (product: Product) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const products = data.products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()));
  const toggle = useMutation({ mutationFn: (product: Product) => api(`/products/${product.id}`, { method: "PATCH", body: JSON.stringify({ status: product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }) });
  const remove = useMutation({ mutationFn: (id: string) => api(`/products/${id}`, { method: "DELETE" }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }) });
  return <div className="dashboard-content"><div className="product-admin-toolbar"><div className="admin-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no seu catálogo" /></div><span>{products.length} produtos</span></div><div className="admin-product-list">{products.map((product) => <article key={product.id}><img src={product.images?.[0]?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80"} alt="" /><div className="admin-product-name"><strong>{product.name}</strong><span>{product.category?.name}</span></div><strong>{formatPrice(product.price)}</strong><span className={product.stock <= 5 ? "low-stock" : ""}>{product.stock} em estoque</span><button className={clsx("switch", product.status === "ACTIVE" && "active")} onClick={() => toggle.mutate(product)}><i /></button><div className="row-actions"><button title="Editar" onClick={() => onEdit(product)}><Edit3 size={17} /></button><button title="Desativar" onClick={() => remove.mutate(product.id)}><Trash2 size={17} /></button></div></article>)}</div></div>;
}

function SellerOrders({ orders }: { orders: Order[] }) {
  return <div className="dashboard-content"><div className="dashboard-table-panel full-panel"><header><div><h2>Todos os pedidos</h2><p>Atualize o andamento e mantenha o cliente informado.</p></div></header><OrderTable orders={orders} editable /></div></div>;
}

function OrderTable({ orders, editable = false }: { orders: Order[]; editable?: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => api(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }) });
  if (!orders.length) return <div className="table-empty">Nenhum pedido recebido ainda.</div>;
  return <div className="order-table"><div className="table-row table-head"><span>Pedido</span><span>Cliente</span><span>Data</span><span>Total</span><span>Status</span><span /></div>{orders.map((order) => <div className="table-row" key={order.id}><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><span>{order.customer?.name ?? "Cliente"}</span><span>{formatDate(order.createdAt)}</span><strong>{formatPrice(order.total)}</strong><span>{editable ? <select value={order.status} onChange={(event) => mutation.mutate({ id: order.id, status: event.target.value })}><option value="PREPARING">Em preparação</option><option value="SHIPPED">Enviado</option><option value="DELIVERED">Entregue</option><option value="CANCELED">Cancelado</option><option value="REFUNDED">Reembolsado</option></select> : <StatusBadge status={order.status} />}</span><a href="/chat" title="Conversar"><MessageCircle size={17} /></a></div>)}</div>;
}

function SettingsView({ seller }: { seller: Dashboard["seller"] }) {
  const queryClient = useQueryClient();
  const [storeName, setStoreName] = useState(seller.storeName);
  const [description, setDescription] = useState(seller.description ?? "");
  const mutation = useMutation({
    mutationFn: () => api("/seller/settings", { method: "PATCH", body: JSON.stringify({ storeName, description }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  return <div className="dashboard-content settings-panel"><div><span className="store-avatar large">{seller.storeName[0]}</span><div><h2>{seller.storeName}</h2><p>{seller.description ?? "Adicione uma descrição para apresentar sua loja aos clientes."}</p></div></div><form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label>Nome da loja<input required minLength={2} value={storeName} onChange={(event) => setStoreName(event.target.value)} /></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Conte um pouco sobre sua loja" /></label>{mutation.error && <p className="form-error">{(mutation.error as Error).message}</p>}<button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar alterações"}</button></form></div>;
}

function ProductModal({ product, categories, onClose, onDone }: { product: Product | "new"; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const editing = product !== "new";
  const [form, setForm] = useState({ name: editing ? product.name : "", description: editing ? product.description : "", price: editing ? String(product.price) : "", stock: editing ? String(product.stock) : "", categoryId: editing ? product.categoryId : categories[0]?.id ?? "", size: "", color: "", flavor: "" });
  const [images, setImages] = useState(editing ? product.images : []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: () => api(editing ? `/products/${product.id}` : "/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ categoryId: form.categoryId, name: form.name, description: form.description, price: Number(form.price), stock: Number(form.stock), images: images.map((image) => ({ url: image.url, alt: image.alt ?? form.name })), options: [["size", form.size], ["color", form.color], ["flavor", form.flavor]].filter(([, value]) => value).map(([type, value]) => ({ type, value })) }) }), onSuccess: onDone, onError: (caught) => setError((caught as Error).message) });
  async function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files).slice(0, Math.max(0, 6 - images.length));
    if (!selected.length) return;
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      selected.forEach((file) => data.append("images", file));
      const response = await api<{ images: Product["images"] }>("/products/uploads", { method: "POST", data });
      setImages((current) => [...current, ...response.images].slice(0, 6));
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }
  return <div className="modal-backdrop"><form className="modal product-modal" onSubmit={submit}><header><div><span className="eyebrow">{editing ? "Editar catálogo" : "Novo no catálogo"}</span><h2>{editing ? "Editar produto" : "Adicionar produto"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></header><div className="modal-body"><label className="span-2">Nome do produto<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="span-2">Descrição<textarea required minLength={10} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Preço<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><label>Estoque<input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label><label className="span-2">Categoria<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Selecione</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><div className="span-2 image-upload-field"><span>Fotos do produto <small>{images.length}/6</small></span><label className="image-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && void uploadFiles(event.target.files)} /><UploadCloud size={28} /><strong>{uploading ? "Enviando fotos..." : "Arraste fotos ou clique para escolher"}</strong><small>JPG, PNG ou WEBP, até 5 MB cada</small></label>{images.length > 0 && <div className="image-preview-grid">{images.map((image, index) => <div key={`${image.url}-${index}`}><img src={image.url} alt="" /><button type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button>{index === 0 && <span>Capa</span>}</div>)}</div>}</div><label>Tamanho opcional<input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="P, M, G" /></label><label>Cor opcional<input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Preto" /></label><label className="span-2">Sabor opcional<input value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="Chocolate" /></label>{error && <p className="form-error span-2">{error}</p>}</div><footer><button type="button" className="button button-ghost" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={mutation.isPending || uploading}><Check size={17} /> {mutation.isPending ? "Salvando..." : "Salvar produto"}</button></footer></form></div>;
}
