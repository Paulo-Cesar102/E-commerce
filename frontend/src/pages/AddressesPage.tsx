import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ErrorState, Loader, PageHeading } from "../components/UI";

const empty = { recipient: "", postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", isDefault: true };
const fields: Array<{ key: Exclude<keyof typeof empty, "isDefault">; label: string; wide?: boolean }> = [
  { key: "recipient", label: "Nome do destinatário", wide: true },
  { key: "postalCode", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "district", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
];
type Address = typeof empty & { id: string };
export function AddressesPage() {
  const client = useQueryClient(); const [form, setForm] = useState(empty); const [editingId, setEditingId] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const save = useMutation({ mutationFn: () => api(editingId ? `/addresses/${editingId}` : "/addresses", { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) }), onSuccess: () => { setForm(empty); setEditingId(null); client.invalidateQueries({ queryKey: ["addresses"] }); } });
  const remove = useMutation({ mutationFn: (id: string) => api(`/addresses/${id}`, { method: "DELETE" }), onSuccess: () => client.invalidateQueries({ queryKey: ["addresses"] }) });
  function edit(address: Address) { setEditingId(address.id); setForm({ recipient: address.recipient, postalCode: address.postalCode, street: address.street, number: address.number, complement: address.complement ?? "", district: address.district, city: address.city, state: address.state, isDefault: address.isDefault }); }
  if (isLoading) return <Loader label="Carregando endereços" />;
  return <div className="page-container"><PageHeading eyebrow="Sua conta" title="Endereços" description="Escolha onde seus pedidos serão entregues." />{error && <ErrorState message={(error as Error).message} />}<div className="orders-list">{data?.map((a) => <article className="order-card" key={a.id}><strong>{a.recipient}{a.isDefault ? " · Principal" : ""}</strong><p>{a.street}, {a.number} {a.complement} — {a.district}, {a.city}/{a.state}, {a.postalCode}</p><div className="row-actions"><button type="button" onClick={() => edit(a)}>Editar</button><button type="button" disabled={remove.isPending} onClick={() => { if (window.confirm("Excluir este endereço?")) remove.mutate(a.id); }}>Excluir</button></div></article>)}</div><form className="address-form" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}><div className="address-form-heading"><div><span className="eyebrow">Entrega</span><h2>{editingId ? "Editar endereço" : "Novo endereço"}</h2></div><span>Campos marcados são obrigatórios</span></div><div className="address-fields">{fields.map(({ key, label, wide }) => <label className={wide ? "field-wide" : ""} key={key}>{label}<input required={key !== "complement"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={key === "postalCode" ? "00000-000" : ""} /></label>)}</div><label className="default-address"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> <span><strong>Usar como endereço principal</strong><small>Será selecionado automaticamente no checkout.</small></span></label>{save.error && <p className="form-error">{(save.error as Error).message}</p>}{remove.error && <p className="form-error">{(remove.error as Error).message}</p>}<div className="address-form-footer"><span>Você poderá alterar este endereço depois.</span><div>{editingId && <button type="button" className="button button-ghost" onClick={() => { setEditingId(null); setForm(empty); }}>Cancelar edição</button>}<button className="button button-primary" disabled={save.isPending}>{save.isPending ? "Salvando..." : editingId ? "Atualizar endereço" : "Salvar endereço"}</button></div></div></form></div>;
}
