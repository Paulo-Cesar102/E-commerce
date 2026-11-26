import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, CirclePlus, Pencil, Power, Ticket, X } from "lucide-react";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";
import { EmptyState, ErrorState, Loader, PageHeading } from "./UI";

type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: string | number;
  minOrderValue: string | number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
};

type CouponForm = {
  code: string;
  type: Coupon["type"];
  value: string;
  minOrderValue: string;
  maxUses: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

const emptyForm = (): CouponForm => ({
  code: "",
  type: "PERCENT",
  value: "",
  minOrderValue: "",
  maxUses: "",
  startsAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
  endsAt: "",
  active: true,
});

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AdminCouponsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const coupons = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => api<Coupon[]>("/admin/coupons"),
  });
  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editingId) {
        return api(`/admin/coupons/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      return api("/admin/coupons", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setForm(emptyForm());
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/admin/coupons/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  function editCoupon(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue === null ? "" : String(coupon.minOrderValue),
      maxUses: coupon.maxUses === null ? "" : String(coupon.maxUses),
      startsAt: toLocalDateTime(coupon.startsAt),
      endsAt: toLocalDateTime(coupon.endsAt),
      active: coupon.active,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
      maxUses: form.maxUses ? Number(form.maxUses) : null,
      ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      active: form.active,
    };
    save.mutate(payload);
  }

  if (coupons.isLoading) return <Loader label="Carregando cupons" />;
  if (coupons.error) {
    return <section className="admin-coupons-panel"><ErrorState message={(coupons.error as Error).message} /></section>;
  }

  const actionError = save.error ?? toggle.error;
  return <section className="admin-coupons-panel">
    <PageHeading
      eyebrow="Marketing"
      title="Cupons de desconto"
      description="Crie campanhas, controle limites de uso e pause ou reative códigos."
      action={<span className="admin-panel-count"><Ticket size={16} /> {coupons.data?.length ?? 0} {(coupons.data?.length ?? 0) === 1 ? "cupom" : "cupons"}</span>}
    />
    {actionError && <p className="form-error admin-action-error">{(actionError as Error).message}</p>}
    <div className="admin-coupons-layout">
      <form className="admin-coupon-form" onSubmit={submit}>
        <header><span className="admin-coupon-form-icon"><CirclePlus size={19} /></span><div><h2>{editingId ? "Editar cupom" : "Criar cupom"}</h2><p>{editingId ? "Atualize as regras desta campanha." : "Configure um novo código promocional."}</p></div></header>
        <label>Código do cupom<input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase().replace(/\s/g, "") }))} required minLength={2} maxLength={40} placeholder="EX: BEMVINDO10" /></label>
        <div className="admin-coupon-form-grid">
          <label>Tipo<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Coupon["type"] }))}><option value="PERCENT">Percentual</option><option value="FIXED">Valor fixo</option></select></label>
          <label>{form.type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"}<input type="number" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} required min="0.01" max={form.type === "PERCENT" ? 100 : undefined} step="0.01" /></label>
          <label>Pedido mínimo (R$)<input type="number" value={form.minOrderValue} onChange={(event) => setForm((current) => ({ ...current, minOrderValue: event.target.value }))} min="0" step="0.01" placeholder="Sem mínimo" /></label>
          <label>Limite de usos<input type="number" value={form.maxUses} onChange={(event) => setForm((current) => ({ ...current, maxUses: event.target.value }))} min="1" step="1" placeholder="Ilimitado" /></label>
          <label><CalendarDays size={14} /> Início<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} required /></label>
          <label><CalendarDays size={14} /> Término<input type="datetime-local" value={form.endsAt} min={form.startsAt || undefined} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
        </div>
        <label className="admin-coupon-active-toggle"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Cupom ativo e disponível para uso</label>
        <div className="admin-coupon-form-actions">
          {editingId && <button type="button" className="button button-ghost" onClick={() => { setEditingId(null); setForm(emptyForm()); }}>Cancelar edição</button>}
          <button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Salvando..." : editingId ? "Salvar alterações" : "Criar cupom"}</button>
        </div>
      </form>

      <section className="admin-coupon-list">
        <header><div><span className="eyebrow">Campanhas</span><h2>Cupons cadastrados</h2></div><strong>{coupons.data?.filter((coupon) => coupon.active).length ?? 0} {(coupons.data?.filter((coupon) => coupon.active).length ?? 0) === 1 ? "ativo" : "ativos"}</strong></header>
        {coupons.data?.length ? <div className="admin-coupon-items">{coupons.data.map((coupon) => <article className="admin-coupon-card" key={coupon.id}>
          <div className="admin-coupon-card-top"><span className={`admin-coupon-status ${coupon.active ? "active" : ""}`}>{coupon.active ? <Check size={13} /> : <X size={13} />}{coupon.active ? "Ativo" : "Pausado"}</span><strong>{coupon.code}</strong></div>
          <p>{coupon.type === "PERCENT" ? `${Number(coupon.value)}% de desconto` : `${formatPrice(coupon.value)} de desconto`}</p>
          <div className="admin-coupon-card-meta"><span>{coupon.usedCount}{coupon.maxUses ? ` / ${coupon.maxUses}` : ""} usos</span><span>{coupon.minOrderValue ? `Pedido mínimo ${formatPrice(coupon.minOrderValue)}` : "Sem pedido mínimo"}</span></div>
          <div className="admin-coupon-card-dates"><span>Início {new Date(coupon.startsAt).toLocaleDateString("pt-BR")}</span><span>{coupon.endsAt ? `Até ${new Date(coupon.endsAt).toLocaleDateString("pt-BR")}` : "Sem vencimento"}</span></div>
          <footer><button className="button button-ghost compact" onClick={() => editCoupon(coupon)} disabled={save.isPending || toggle.isPending}><Pencil size={14} /> Editar</button><button className="button button-dark compact" onClick={() => toggle.mutate({ id: coupon.id, active: !coupon.active })} disabled={toggle.isPending || save.isPending}><Power size={14} /> {coupon.active ? "Desativar" : "Ativar"}</button></footer>
        </article>)}</div> : <EmptyState title="Nenhum cupom cadastrado" text="Use o formulário para criar sua primeira campanha." />}
      </section>
    </div>
  </section>;
}
