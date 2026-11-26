import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert, RotateCcw, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";
import { EmptyState, ErrorState, Loader, PageHeading } from "./UI";

type ReturnOrder = {
  id: string;
  total: string | number;
  returnReason: string;
  returnRequestedAt: string;
  customer: { name: string; email: string };
  seller: { storeName: string } | null;
  directSeller: { name: string } | null;
  payment: { status: string } | null;
  items: Array<{ productName: string | null; quantity: number; unitPrice: string | number }>;
};

type Resolution = {
  decision: "APPROVE" | "DENY";
  note: string;
  confirmed: boolean;
};

export function AdminReturnsPanel() {
  const queryClient = useQueryClient();
  const [resolutionId, setResolutionId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>({
    decision: "APPROVE",
    note: "",
    confirmed: false,
  });
  const returns = useQuery({
    queryKey: ["admin-returns"],
    queryFn: () => api<ReturnOrder[]>("/admin/returns"),
  });
  const resolve = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: Resolution["decision"]; note: string }) =>
      api(`/admin/returns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision, note }),
      }),
    onSuccess: async () => {
      setResolutionId(null);
      setResolution({ decision: "APPROVE", note: "", confirmed: false });
      await queryClient.invalidateQueries({ queryKey: ["admin-returns"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  function startResolution(id: string, decision: Resolution["decision"]) {
    setResolutionId(id);
    setResolution({ decision, note: "", confirmed: false });
  }

  function submitResolution(event: FormEvent<HTMLFormElement>, orderId: string) {
    event.preventDefault();
    resolve.mutate({ id: orderId, decision: resolution.decision, note: resolution.note.trim() });
  }

  if (returns.isLoading) return <Loader label="Carregando devoluções" />;
  if (returns.error) {
    return <section className="admin-returns-panel"><ErrorState message={(returns.error as Error).message} /></section>;
  }

  return <section className="admin-returns-panel">
    <PageHeading
      eyebrow="Pós-venda"
      title="Devoluções"
      description="Analise as solicitações e registre a decisão. Aprovar solicita uma devolução integral pelo Mercado Pago."
      action={<span className="admin-panel-count"><RotateCcw size={16} /> {returns.data?.length ?? 0} {(returns.data?.length ?? 0) === 1 ? "solicitação pendente" : "solicitações pendentes"}</span>}
    />
    {resolve.error && <p className="form-error admin-action-error">{(resolve.error as Error).message}</p>}
    {returns.data?.length ? <div className="admin-return-list">{returns.data.map((order) => {
      const currentResolution = resolutionId === order.id;
      const sellerName = order.seller?.storeName ?? order.directSeller?.name ?? "Venda rápida";
      return <article className="admin-return-card" key={order.id}>
        <header className="admin-return-card-head">
          <div><span className="eyebrow">Pedido {order.id.slice(0, 8)}</span><h2>{sellerName}</h2></div>
          <span className="admin-return-status"><CircleAlert size={15} /> Em análise</span>
        </header>
        <div className="admin-return-details">
          <div><small>Comprador</small><strong>{order.customer.name}</strong><span>{order.customer.email}</span></div>
          <div><small>Solicitado em</small><strong>{new Date(order.returnRequestedAt).toLocaleString("pt-BR")}</strong><span>Pagamento: {order.payment?.status ?? "indisponível"}</span></div>
          <div><small>Valor do pedido</small><strong>{formatPrice(order.total)}</strong><span>Estorno integral em caso de aprovação</span></div>
        </div>
        <div className="admin-return-reason"><small>Motivo informado pelo comprador</small><p>{order.returnReason}</p></div>
        <div className="admin-return-items">{order.items.map((item, index) => <div key={`${order.id}-${index}`}><span>{item.productName ?? "Item"} × {item.quantity}</span><strong>{formatPrice(Number(item.unitPrice) * item.quantity)}</strong></div>)}</div>
        <div className="admin-return-actions">
          <button className="button button-ghost compact" onClick={() => startResolution(order.id, "DENY")} disabled={resolve.isPending}>Negar solicitação</button>
          <button className="button button-primary compact" onClick={() => startResolution(order.id, "APPROVE")} disabled={resolve.isPending}><ShieldCheck size={16} /> Aprovar e estornar</button>
        </div>
        {currentResolution && <form className="admin-return-resolution" onSubmit={(event) => submitResolution(event, order.id)}>
          <label>Nota da decisão<textarea value={resolution.note} onChange={(event) => setResolution((current) => ({ ...current, note: event.target.value }))} required minLength={3} maxLength={500} rows={3} placeholder={resolution.decision === "APPROVE" ? "Registre a análise antes de solicitar o estorno." : "Explique ao comprador por que a solicitação foi negada."} /></label>
          {resolution.decision === "APPROVE" && <div className="admin-refund-confirm">
            <BadgeCheck size={17} />
            <label><input type="checkbox" checked={resolution.confirmed} onChange={(event) => setResolution((current) => ({ ...current, confirmed: event.target.checked }))} /> Confirmo o estorno integral pelo Mercado Pago. O estoque não será reativado automaticamente.</label>
          </div>}
          <div className="admin-return-resolution-actions">
            <button type="button" className="button button-ghost compact" onClick={() => setResolutionId(null)}>Voltar</button>
            <button type="submit" className="button button-dark compact" disabled={resolve.isPending || resolution.note.trim().length < 3 || (resolution.decision === "APPROVE" && !resolution.confirmed)}>
              {resolve.isPending ? "Salvando..." : resolution.decision === "APPROVE" ? "Confirmar estorno" : "Registrar negativa"}
            </button>
          </div>
        </form>}
      </article>;
    })}</div> : <EmptyState title="Nenhuma devolução pendente" text="Novas solicitações dos compradores aparecerão aqui." />}
  </section>;
}
