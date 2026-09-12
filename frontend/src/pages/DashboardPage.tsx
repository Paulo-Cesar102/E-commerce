import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, BarChart3, Boxes, Check, CircleDollarSign, Clock3, Edit3, MessageCircle, PackageCheck, Plus, Search, Settings, ShoppingBag, Store, Trash2, UploadCloud, Wallet, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";
import { imageUrl, useFallbackImage } from "../lib/images";
import type { Category, Order, Product } from "../types";
import { ErrorState, Loader, StatusBadge } from "../components/UI";

type Dashboard = {
  seller: { id: string; storeName: string; description?: string; postalCode?: string };
  totalSales: number;
  revenue: number;
  profit: number;
  financialChart: { date: string; total: number }[];
  products: Product[];
  recentOrders: Order[];
  categories: Category[];
  finance: { grossSales: string | number; platformFees: string | number; available: string | number; pending: string | number; paidOrders: number; withdrawals: Array<{ id: string; amount: string | number; status: string; requestedAt: string }> };
};

type Tab = "overview" | "finance" | "products" | "orders" | "settings";
type DraftProductImage = Product["images"][number] & { file?: File; previewUrl?: string };
type VariantDraft = { sku: string; size: string; color: string; flavor: string; price: string; stock: string };

function revokeLocalPreviews(images: DraftProductImage[]) {
  images.forEach((image) => {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  });
}

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [productModal, setProductModal] = useState<Product | "new" | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/seller/dashboard") });

  if (isLoading) return <Loader label="Montando seu painel" />;
  if (error || !data) {
    const message = (error as Error)?.message ?? "Não foi possível abrir o painel.";
    if (message.includes("PENDING") || message.toLowerCase().includes("aguardando aprovacao")) {
      return <div className="seller-approval-page"><div className="seller-approval-card"><span className="seller-approval-icon"><Clock3 size={28} /></span><span className="eyebrow">Conta em análise</span><h1>Estamos revisando sua loja</h1><p>Seu cadastro foi recebido e está aguardando aprovação administrativa. Assim que sua conta for aprovada, você poderá cadastrar produtos e começar a vender.</p><div className="seller-approval-status"><span><i /> Status atual</span><strong>Aguardando aprovação</strong></div><div className="seller-approval-actions"><a className="button button-primary" href="/">Voltar para a Vitrine <ArrowRight size={17} /></a><a className="seller-approval-link" href="/chat">Falar com o suporte</a></div></div></div>;
    }
    return <div className="dashboard-error"><ErrorState message={message} /></div>;
  }

  return <div className="dashboard-layout">
    <aside className="dashboard-sidebar">
      <div className="dashboard-store"><span><Store size={20} /></span><div><small>Minha loja</small><strong>{data.seller.storeName}</strong></div></div>
      <nav>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 /> Visão geral</button>
        <button className={tab === "finance" ? "active" : ""} onClick={() => setTab("finance")}><Wallet /> Financeiro</button>
        <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}><Boxes /> Produtos</button>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><ShoppingBag /> Pedidos</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings /> Configurações</button>
      </nav>
      <a href="/chat"><MessageCircle size={18} /> Central de mensagens</a>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-top"><div><span className="eyebrow">Painel do vendedor</span><h1>{tab === "overview" ? "Visão geral" : tab === "finance" ? "Financeiro" : tab === "products" ? "Produtos" : tab === "orders" ? "Pedidos" : "Configurações"}</h1></div>{tab === "products" && <div className="dashboard-head-actions"><span className="shared-category-note">Categorias compartilhadas com compradores</span><button className="button button-primary" onClick={() => setProductModal("new")}><Plus size={18} /> Novo produto</button></div>}</header>
      {tab === "overview" && <Overview data={data} onNavigate={setTab} />}
      {tab === "finance" && <SellerFinance finance={data.finance} />}
      {tab === "products" && <Products data={data} onEdit={setProductModal} />}
      {tab === "orders" && <SellerOrders orders={data.recentOrders} />}
      {tab === "settings" && <SettingsView seller={data.seller} />}
    </section>
    {productModal && <ProductModal product={productModal} categories={data.categories} onClose={() => setProductModal(null)} onDone={() => { setProductModal(null); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); }} />}
  </div>;
}

function SellerFinance({ finance }: { finance: Dashboard["finance"] }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const withdrawal = useMutation({ mutationFn: () => api("/seller/withdrawals", { method: "POST", body: JSON.stringify({ amount: Number(amount.replace(",", ".")) }) }), onSuccess: () => { setAmount(""); queryClient.invalidateQueries({ queryKey: ["dashboard"] }); } });
  return <div className="dashboard-content seller-finance"><div className="metric-grid"><article><span className="metric-icon coral"><Wallet /></span><div><small>Saldo disponível</small><strong>{formatPrice(finance.available)}</strong><span>Somente vendas da sua loja</span></div></article><article><span className="metric-icon yellow"><Clock3 /></span><div><small>Saldo pendente</small><strong>{formatPrice(finance.pending)}</strong><span>Solicitações em análise</span></div></article><article><span className="metric-icon green"><CircleDollarSign /></span><div><small>Vendas aprovadas</small><strong>{formatPrice(finance.grossSales)}</strong><span>{finance.paidOrders} pedidos</span></div></article></div><section className="seller-payout-card"><div><span className="eyebrow">Repasse da sua loja</span><h2>{formatPrice(finance.available)}</h2><p>A comissão da plataforma já foi descontada deste valor.</p></div><form onSubmit={(event) => { event.preventDefault(); withdrawal.mutate(); }}><label>Valor do saque<input required min="0.01" max={Number(finance.available)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="R$ 0,00" /></label><button className="button button-primary" disabled={withdrawal.isPending || Number(finance.available) <= 0}><Wallet size={17} /> Solicitar saque</button></form></section><section className="dashboard-table-panel full-panel seller-withdrawals"><header><div><h2>Histórico de saques</h2><p>Acompanhe os repasses solicitados pela sua loja.</p></div><strong>{finance.withdrawals.length}</strong></header>{finance.withdrawals.length ? finance.withdrawals.map((item) => <div className="seller-withdrawal-row" key={item.id}><span><strong>{formatPrice(item.amount)}</strong><small>{new Date(item.requestedAt).toLocaleDateString("pt-BR")}</small></span><span className={`seller-payout-status seller-payout-${item.status.toLowerCase()}`}>{item.status === "REQUESTED" ? "Solicitado" : item.status === "APPROVED" ? "Aprovado" : item.status === "PAID" ? "Pago" : "Rejeitado"}</span></div>) : <div className="table-empty">Nenhum saque solicitado.</div>}</section></div>;
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
  return <div className="dashboard-content"><div className="product-admin-toolbar"><div className="admin-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no seu catálogo" /></div><span>{products.length} produtos</span></div><div className="admin-product-list">{products.map((product) => <article key={product.id}><img src={imageUrl(product.images?.[0]?.url)} onError={useFallbackImage} alt="" /><div className="admin-product-name"><strong>{product.name}</strong><span>{product.category?.name}</span></div><strong>{formatPrice(product.price)}</strong><span className={product.stock <= 5 ? "low-stock" : ""}>{product.stock} em estoque</span><button className={clsx("switch", product.status === "ACTIVE" && "active")} onClick={() => toggle.mutate(product)}><i /></button><div className="row-actions"><button title="Editar" onClick={() => onEdit(product)}><Edit3 size={17} /></button><button title="Desativar" onClick={() => remove.mutate(product.id)}><Trash2 size={17} /></button></div></article>)}</div></div>;
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
  const [postalCode, setPostalCode] = useState(seller.postalCode ?? "");
  const mutation = useMutation({
    mutationFn: () => api("/seller/settings", { method: "PATCH", body: JSON.stringify({ storeName, description, postalCode }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
  return <div className="dashboard-content settings-panel"><div><span className="store-avatar large">{seller.storeName[0]}</span><div><h2>{seller.storeName}</h2><p>{seller.description ?? "Adicione uma descrição para apresentar sua loja aos clientes."}</p></div></div><form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}><label>Nome da loja<input required minLength={2} value={storeName} onChange={(event) => setStoreName(event.target.value)} /></label><label>CEP de origem dos envios<input required inputMode="numeric" value={postalCode} onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label><label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Conte um pouco sobre sua loja" /></label>{mutation.error && <p className="form-error">{(mutation.error as Error).message}</p>}<button className="button button-primary" disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Salvar alterações"}</button></form></div>;
}

function ProductModal({ product, categories, onClose, onDone }: { product: Product | "new"; categories: Category[]; onClose: () => void; onDone: () => void }) {
  const editing = product !== "new";
  const firstVariant = editing ? product.variants?.[0] : undefined;
  const [extraVariants, setExtraVariants] = useState<VariantDraft[]>(editing ? (product.variants?.slice(1).map((variant) => ({ sku: variant.sku, size: variant.attributes.size ?? "", color: variant.attributes.color ?? "", flavor: variant.attributes.flavor ?? "", price: variant.price !== undefined ? String(variant.price) : "", stock: String(variant.stock) })) ?? []) : []);
  const [form, setForm] = useState({ name: editing ? product.name : "", description: editing ? product.description : "", price: editing ? String(product.price) : "", stock: editing ? String(product.stock) : "", categoryId: editing ? product.categoryId : categories[0]?.id ?? "", size: firstVariant?.attributes.size ?? "", color: firstVariant?.attributes.color ?? "", flavor: firstVariant?.attributes.flavor ?? "", variantSku: firstVariant?.sku ?? "", variantPrice: firstVariant?.price !== undefined ? String(firstVariant.price) : "", variantStock: firstVariant ? String(firstVariant.stock) : "" });
  const [images, setImages] = useState<DraftProductImage[]>(editing ? product.images : []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mutation = useMutation({ mutationFn: saveProduct, onSuccess: () => { revokeLocalPreviews(images); onDone(); }, onError: (caught) => setError((caught as Error).message) });
  function uploadFiles(files: FileList | File[]) {
    const selected = Array.from(files).slice(0, Math.max(0, 6 - images.length));
    if (!selected.length) return;
    setError("");

    const validFiles = selected.filter((file) => {
      const valid = ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024;
      if (!valid) setError("Envie imagens JPG, PNG ou WEBP com ate 5 MB cada");
      return valid;
    });

    setImages((current) => [
      ...current,
      ...validFiles.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        return { url: previewUrl, previewUrl, alt: file.name, file };
      }),
    ].slice(0, 6));
  }
  function removeImage(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }
  async function uploadPendingImages() {
    const localImages = images.filter((image) => image.file);
    if (!localImages.length) return images.map((image) => ({ url: image.url, alt: image.alt ?? form.name }));
    setUploading(true);
    const data = new FormData();
    localImages.forEach((image) => image.file && data.append("images", image.file));
    const response = await api<{ images: Product["images"] }>("/products/uploads", { method: "POST", data });
    let uploadedIndex = 0;
    return images.map((image) => {
      if (!image.file) return { url: image.url, alt: image.alt ?? form.name };
      const uploaded = response.images[uploadedIndex++];
      return { url: uploaded.url, alt: uploaded.alt ?? image.alt ?? form.name };
    });
  }
  async function saveProduct() {
    setError("");
    try {
      const uploadedImages = await uploadPendingImages();
      const drafts = [{ sku: form.variantSku, size: form.size, color: form.color, flavor: form.flavor, price: form.variantPrice, stock: form.variantStock }, ...extraVariants];
      const variants = drafts.filter((variant) => variant.sku).map((variant) => ({ sku: variant.sku, attributes: Object.fromEntries([["size", variant.size], ["color", variant.color], ["flavor", variant.flavor]].filter(([, value]) => value)), ...(variant.price ? { price: Number(variant.price) } : {}), stock: Number(variant.stock || 0) }));
      const options = [...new Map(variants.flatMap((variant) => Object.entries(variant.attributes)).map(([type, value]) => [`${type}:${value}`, { type, value }])).values()];
      return await api(editing ? `/products/${product.id}` : "/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ categoryId: form.categoryId, name: form.name, description: form.description, price: Number(form.price), stock: Number(form.stock), images: uploadedImages, options, variants }) });
    } finally {
      setUploading(false);
    }
  }
  function closeModal() { revokeLocalPreviews(images); onClose(); }
  function submit(event: FormEvent) { event.preventDefault(); mutation.mutate(); }
  return (
    <div className="modal-backdrop">
      <form className="modal product-modal" onSubmit={submit}>
        <header>
          <div>
            <span className="eyebrow">{editing ? "Editar catalogo" : "Novo no catalogo"}</span>
            <h2>{editing ? "Editar produto" : "Adicionar produto"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={closeModal}><X /></button>
        </header>
        <div className="modal-body">
          <label className="span-2">Nome do produto<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="span-2">Descricao<textarea required minLength={10} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>Preco<input required type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>Estoque<input required type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
          <label className="span-2">Categoria<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}><option value="">Selecione</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <div className="span-2 image-upload-field">
            <span>Fotos do produto <small>{images.length}/6</small></span>
            <label className="image-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); uploadFiles(event.dataTransfer.files); }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => event.target.files && uploadFiles(event.target.files)} />
              <UploadCloud size={28} />
              <strong>{uploading ? "Enviando fotos..." : "Arraste fotos ou clique para escolher"}</strong>
              <small>JPG, PNG ou WEBP, ate 5 MB cada</small>
            </label>
            {images.length > 0 && <div className="image-preview-grid">{images.map((image, index) => <div key={`${image.previewUrl ?? image.url}-${index}`}><img src={image.previewUrl ?? image.url} alt="" /><button type="button" onClick={() => removeImage(index)}><X size={14} /></button>{index === 0 && <span>Capa</span>}</div>)}</div>}
          </div>
          <label>Tamanho opcional<input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="P, M, G" /></label>
          <label>Cor opcional<input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Preto" /></label>
          <label className="span-2">Sabor opcional<input value={form.flavor} onChange={(e) => setForm({ ...form, flavor: e.target.value })} placeholder="Chocolate" /></label>
          <label>SKU da variação<input value={form.variantSku} onChange={(e) => setForm({ ...form, variantSku: e.target.value })} placeholder="CAM-PRE-M" /></label>
          <label>Preço da variação<input type="number" min="0.01" step="0.01" value={form.variantPrice} onChange={(e) => setForm({ ...form, variantPrice: e.target.value })} placeholder="Usar preço base" /></label>
          <label className="span-2">Estoque da variação<input type="number" min="0" value={form.variantStock} onChange={(e) => setForm({ ...form, variantStock: e.target.value })} placeholder="0" /></label>
          {extraVariants.map((variant, index) => <div className="span-2" key={index}><div className="dashboard-head-actions"><strong>Variação {index + 2}</strong><button type="button" className="button button-ghost" onClick={() => setExtraVariants((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remover</button></div><div className="modal-body"><label>SKU<input required value={variant.sku} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, sku: e.target.value } : item))} /></label><label>Tamanho<input value={variant.size} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, size: e.target.value } : item))} /></label><label>Cor<input value={variant.color} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, color: e.target.value } : item))} /></label><label>Sabor<input value={variant.flavor} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, flavor: e.target.value } : item))} /></label><label>Preço<input type="number" value={variant.price} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, price: e.target.value } : item))} /></label><label>Estoque<input type="number" required min="0" value={variant.stock} onChange={(e) => setExtraVariants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, stock: e.target.value } : item))} /></label></div></div>)}
          <button type="button" className="button button-ghost span-2" onClick={() => setExtraVariants((items) => [...items, { sku: "", size: "", color: "", flavor: "", price: "", stock: "0" }])}>+ Adicionar outra variação</button>
          {error && <p className="form-error span-2">{error}</p>}
        </div>
        <footer>
          <button type="button" className="button button-ghost" onClick={closeModal}>Cancelar</button>
          <button className="button button-primary" disabled={mutation.isPending || uploading}><Check size={17} /> {mutation.isPending ? "Salvando..." : "Salvar produto"}</button>
        </footer>
      </form>
    </div>
  );
}

