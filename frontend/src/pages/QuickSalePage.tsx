import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ImagePlus, PackageCheck, Plus, Store, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";
import { imageUrl, useFallbackImage } from "../lib/images";
import type { Category, Order, Product, ProductImage } from "../types";
import { EmptyState, ErrorState, Loader, PageHeading } from "../components/UI";

type QuickSaleData = {
  hasPro: boolean;
  activeCount: number;
  activeLimit: number | null;
  listings: Product[];
  orders: Array<Order & {
    sellerNet: number;
    customer: { name: string };
    quickSalePayoutStatus: "PENDING" | "PAID" | "VOIDED" | "NOT_APPLICABLE";
  }>;
};

export function QuickSalePage() {
  const queryClient = useQueryClient();
  const [images, setImages] = useState<File[]>([]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["quick-sales", "mine"],
    queryFn: () => api<QuickSaleData>("/quick-sales/mine"),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/products/categories", { auth: false }),
  });
  const create = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const values = new FormData(form);
      const upload = new FormData();
      images.forEach((image) => upload.append("images", image));
      const uploaded = await api<{ images: ProductImage[] }>("/quick-sales/uploads", { method: "POST", data: upload });
      return api("/quick-sales", {
        method: "POST",
        body: JSON.stringify({
          categoryId: values.get("categoryId"),
          name: values.get("name"),
          description: values.get("description"),
          price: Number(String(values.get("price")).replace(",", ".")),
          originPostalCode: values.get("originPostalCode"),
          weightGrams: Number(values.get("weightGrams")),
          lengthCm: Number(values.get("lengthCm")),
          widthCm: Number(values.get("widthCm")),
          heightCm: Number(values.get("heightCm")),
          images: uploaded.images,
        }),
      });
    },
    onSuccess: (_result, form) => {
      setImages([]);
      queryClient.invalidateQueries({ queryKey: ["quick-sales", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      form.reset();
    },
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "INACTIVE" }) =>
      api(`/quick-sales/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-sales", "mine"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const updateOrder = useMutation({
    mutationFn: ({ id, status, trackingCodes }: { id: string; status: "SHIPPED" | "DELIVERED"; trackingCodes?: string[] }) =>
      api(`/quick-sales/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, trackingCodes }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quick-sales", "mine"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!images.length) return;
    create.mutate(event.currentTarget);
  }

  if (isLoading) return <Loader label="Abrindo Venda rápida" />;
  if (error || !data) return <div className="page-container"><ErrorState message={(error as Error)?.message ?? "Não foi possível carregar seus anúncios."} /></div>;

  const atLimit = data.activeLimit !== null && data.activeCount >= data.activeLimit;
  return <div className="page-container quick-sale-page">
    <PageHeading eyebrow="Venda rápida" title="Anuncie algo seu" description="Venda pelo checkout da Vitrine. A comissão é 5% do valor do item; o frete é calculado pelos Correios." />
    <section className="quick-sale-plan-note">
      <span className="quick-sale-plan-icon">{data.hasPro ? <BadgeCheck /> : <Store />}</span>
      <div><strong>{data.hasPro ? "Pro: anúncios ativos ilimitados" : "Grátis: um anúncio ativo por vez"}</strong><p>{data.hasPro ? "Sua assinatura Pro atual também libera anúncios de Venda rápida." : `${data.activeCount}/1 anúncio ativo. Desative o anúncio atual para publicar outro.`}</p></div>
      {!data.hasPro && <Link className="button button-dark" to="/dashboard?tab=plan">Conhecer o Pro</Link>}
    </section>

    <section className="quick-sale-create">
      <header><span><Plus size={18} /></span><div><h2>Novo anúncio</h2><p>O item será publicado com estoque único.</p></div></header>
      <form id="quick-sale-form" onSubmit={submit}>
        <div className="quick-sale-form-grid">
          <label>Nome do item<input name="name" required minLength={2} maxLength={120} placeholder="Ex.: Videogame usado" /></label>
          <label>Categoria<select name="categoryId" required defaultValue=""><option value="" disabled>Escolha uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Preço<input name="price" required type="number" min="0.01" step="0.01" placeholder="0,00" /></label>
          <label>CEP de origem<input name="originPostalCode" required inputMode="numeric" minLength={8} maxLength={9} placeholder="00000-000" onChange={(event) => { event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"); }} /></label>
          <label>Peso embalado (g)<input name="weightGrams" required type="number" min="1" step="1" placeholder="Ex.: 1200" /></label>
          <label>Comprimento (cm)<input name="lengthCm" required type="number" min="1" step="1" placeholder="Ex.: 30" /></label>
          <label>Largura (cm)<input name="widthCm" required type="number" min="1" step="1" placeholder="Ex.: 20" /></label>
          <label>Altura (cm)<input name="heightCm" required type="number" min="1" step="1" placeholder="Ex.: 10" /></label>
        </div>
        <p className="settings-hint">Informe o peso e as medidas do pacote já embalado; os Correios usam esses dados na cotação.</p>
        <label>Descrição<textarea name="description" required minLength={10} maxLength={4000} rows={4} placeholder="Descreva o estado e os detalhes importantes do item." /></label>
        <label className="quick-sale-image-input"><ImagePlus size={20} /><span><strong>Fotos do item</strong><small>Escolha de 1 a 6 fotos · JPEG, PNG ou WEBP</small></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 6))} /></label>
        {images.length > 0 && <div className="quick-sale-image-list">{images.map((image) => <span key={`${image.name}-${image.lastModified}`}>{image.name}</span>)}</div>}
        {(create.error || update.error || updateOrder.error) && <p className="form-error">{((create.error ?? update.error ?? updateOrder.error) as Error).message}</p>}
        <button className="button button-primary" disabled={create.isPending || atLimit || !images.length}>{create.isPending ? "Publicando..." : atLimit ? "Limite de anúncio atingido" : "Publicar anúncio"}</button>
      </form>
    </section>

    <section className="quick-sale-listings">
      <header><div><span className="eyebrow">Seus itens</span><h2>Meus anúncios</h2></div><Link to="/buscar?sort=new">Ver catálogo</Link></header>
      {data.listings.length ? <div className="quick-sale-list">{data.listings.map((listing) => <article key={listing.id}>
        <img src={imageUrl(listing.images[0]?.url)} onError={useFallbackImage} alt="" />
        <div className="quick-sale-item"><strong>{listing.name}</strong><span>{listing.status === "ACTIVE" ? "Ativo" : "Inativo"} · {listing.stock > 0 ? "Disponível" : "Reservado/vendido"}</span><b>{formatPrice(listing.price)}</b></div>
        <Link className="button button-ghost compact" to={`/produto/${listing.id}`}>Abrir</Link>
        {listing.stock > 0 && <button className="button button-dark compact" onClick={() => update.mutate({ id: listing.id, status: listing.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" })} disabled={update.isPending || (listing.status === "INACTIVE" && atLimit)}>{listing.status === "ACTIVE" ? "Desativar" : "Ativar"}</button>}
      </article>)}</div> : <EmptyState title="Nenhum anúncio ainda" text="Publique seu primeiro item para começar a vender." />}
    </section>

    <section className="quick-sale-orders">
      <header><div><span className="eyebrow">Acompanhe</span><h2>Vendas e repasses</h2></div><span><Truck size={16} /> Repasse após entrega e prazo de devolução</span></header>
      {data.orders.length ? <div className="quick-sale-list">{data.orders.map((order) => {
        const item = order.items[0];
        const canShip = order.status === "PAID";
        const canDeliver = order.status === "SHIPPED";
        const shipments = order.shipments ?? [];
        return <article key={order.id}>
          <span className="quick-sale-order-icon"><PackageCheck /></span>
          <div className="quick-sale-item"><strong>{item?.productName ?? "Item anunciado"}</strong><span>Comprador: {order.customer.name} · Pedido {order.status}</span>{shipments.some((shipment) => shipment.trackingCode) && <small>Rastreios: {shipments.map((shipment) => shipment.trackingCode ? `${shipment.packageLabel ?? `Pacote ${shipment.packageNumber}`}: ${shipment.trackingCode}` : null).filter(Boolean).join(" · ")}</small>}<b>Líquido estimado: {formatPrice(order.sellerNet)}</b></div>
          <span className={`status-pill quick-sale-payout-${order.quickSalePayoutStatus.toLowerCase()}`}>{order.quickSalePayoutStatus === "PAID" ? "Repasse pago" : order.quickSalePayoutStatus === "VOIDED" ? "Repasse cancelado" : "Repasse pendente"}</span>
          {canShip && <button className="button button-primary compact" onClick={() => {
            const trackingCodes: string[] = [];
            for (let index = 0; index < shipments.length; index += 1) {
              const label = shipments[index]?.packageLabel ?? `Pacote ${index + 1}`;
              const trackingCode = window.prompt(`Rastreio de "${label}" (${index + 1} de ${shipments.length})`);
              if (!trackingCode?.trim()) return;
              trackingCodes.push(trackingCode.trim());
            }
            if (trackingCodes.length) updateOrder.mutate({ id: order.id, status: "SHIPPED", trackingCodes });
          }}>Informar envio</button>}
          {canDeliver && <button className="button button-dark compact" onClick={() => updateOrder.mutate({ id: order.id, status: "DELIVERED" })}>Marcar entregue</button>}
        </article>;
      })}</div> : <EmptyState title="Nenhuma venda recebida" text="Quando alguém comprar um dos seus anúncios, ela aparecerá aqui." />}
    </section>
  </div>;
}
