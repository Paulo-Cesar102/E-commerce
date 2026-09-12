import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ErrorState, Loader, PageHeading } from "../components/UI";

const empty = { recipient: "", postalCode: "", street: "", number: "", complement: "", district: "", city: "", state: "", isDefault: true };
type Address = typeof empty & { id: string };
export function AddressesPage() {
  const client = useQueryClient(); const [form, setForm] = useState(empty);
  const { data, isLoading, error } = useQuery({ queryKey: ["addresses"], queryFn: () => api<Address[]>("/addresses") });
  const save = useMutation({ mutationFn: () => api("/addresses", { method: "POST", body: JSON.stringify(form) }), onSuccess: () => { setForm(empty); client.invalidateQueries({ queryKey: ["addresses"] }); } });
  if (isLoading) return <Loader label="Carregando endereços" />;
  return <div className="page-container"><PageHeading eyebrow="Sua conta" title="Endereços" description="Escolha onde seus pedidos serão entregues." />{error && <ErrorState message={(error as Error).message} />}<div className="orders-list">{data?.map((a) => <article className="order-card" key={a.id}><strong>{a.recipient}{a.isDefault ? " · Principal" : ""}</strong><p>{a.street}, {a.number} {a.complement} — {a.district}, {a.city}/{a.state}, {a.postalCode}</p></article>)}</div><form className="auth-card" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate(); }}><h2>Novo endereço</h2>{Object.entries(form).filter(([key]) => key !== "isDefault").map(([key, value]) => <label key={key}>{key}<input required={key !== "complement"} value={value as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<label><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Endereço principal</label>{save.error && <p className="form-error">{(save.error as Error).message}</p>}<button className="button button-primary" disabled={save.isPending}>Salvar endereço</button></form></div>;
}
