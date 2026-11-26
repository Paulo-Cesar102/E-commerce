import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";

type SellerWithdrawal = {
  id: string;
  amount: string | number;
  status: "REQUESTED" | "APPROVED";
  requestedAt: string;
  pixKey: string | null;
  seller: { storeName: string; user: { name: string; email: string } } | null;
};

export function AdminSellerWithdrawalsPanel() {
  const queryClient = useQueryClient();
  const [references, setReferences] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const withdrawals = useQuery({
    queryKey: ["admin-seller-withdrawals"],
    queryFn: () => api<SellerWithdrawal[]>("/admin/seller-withdrawals"),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; status: "APPROVED" | "REJECTED" | "PAID"; providerRef?: string; note?: string }) =>
      api(`/admin/withdrawals/${input.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => {
      setReferences({});
      setNotes({});
      queryClient.invalidateQueries({ queryKey: ["admin-seller-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  return <section className="admin-finance-list admin-seller-withdrawals">
    <div className="section-heading">
      <div><h2>Saques solicitados pelos lojistas</h2><p>Transfira via Pix fora do sistema e registre a referência antes de confirmar.</p></div>
      <span>{withdrawals.data?.length ?? 0} em análise</span>
    </div>
    {withdrawals.isError && <p className="form-error">{(withdrawals.error as Error).message}</p>}
    {update.isError && <p className="form-error">{(update.error as Error).message}</p>}
    {withdrawals.data?.length ? withdrawals.data.map((withdrawal) => <article className="admin-seller-withdrawal-row" key={withdrawal.id}>
      <div className="admin-seller-withdrawal-details">
        <strong>{withdrawal.seller?.storeName ?? "Loja indisponível"} · {formatPrice(withdrawal.amount)}</strong>
        <small>{withdrawal.seller?.user.name ?? "Lojista"} · {withdrawal.seller?.user.email ?? "Conta removida"} · {new Date(withdrawal.requestedAt).toLocaleString("pt-BR")}</small>
        <span><b>Chave Pix:</b> <code>{withdrawal.pixKey ?? "Não informada"}</code></span>
      </div>
      <div className="admin-seller-withdrawal-actions">
        {withdrawal.status === "REQUESTED" && <button className="button button-dark" disabled={update.isPending} onClick={() => update.mutate({ id: withdrawal.id, status: "APPROVED" })}>Aprovar</button>}
        {withdrawal.status === "APPROVED" && <>
          <input
            aria-label={`Referência Pix para ${withdrawal.seller?.storeName ?? "lojista"}`}
            value={references[withdrawal.id] ?? ""}
            onChange={(event) => setReferences((current) => ({ ...current, [withdrawal.id]: event.target.value }))}
            placeholder="Referência do comprovante"
            maxLength={120}
          />
          <button className="button button-primary" disabled={update.isPending || (references[withdrawal.id] ?? "").trim().length < 3} onClick={() => update.mutate({ id: withdrawal.id, status: "PAID", providerRef: references[withdrawal.id]?.trim() })}>Confirmar Pix pago</button>
        </>}
        <input
          aria-label={`Motivo da rejeição para ${withdrawal.seller?.storeName ?? "lojista"}`}
          value={notes[withdrawal.id] ?? ""}
          onChange={(event) => setNotes((current) => ({ ...current, [withdrawal.id]: event.target.value }))}
          placeholder="Motivo se rejeitar"
          maxLength={500}
        />
        <button className="button button-dark" disabled={update.isPending || (notes[withdrawal.id] ?? "").trim().length < 3} onClick={() => update.mutate({ id: withdrawal.id, status: "REJECTED", note: notes[withdrawal.id]?.trim() })}>Rejeitar</button>
      </div>
    </article>) : <p>{withdrawals.isLoading ? "Carregando solicitações..." : "Nenhum saque de lojista aguardando análise."}</p>}
  </section>;
}
