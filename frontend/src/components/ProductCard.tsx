import { Heart, ShoppingBag, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatPrice } from "../lib/format";
import { useAuthStore } from "../store/auth";
import type { Product } from "../types";

const fallback = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";

export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const rating = product.averageRating !== undefined
    ? Number(product.averageRating)
    : product.reviews?.length
    ? product.reviews.reduce((sum, review) => sum + review.rating, 0) / product.reviews.length
    : 0;
  const add = useMutation({
    mutationFn: () => api("/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: 1 }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  function addToCart() {
    if (!accessToken) {
      navigate("/entrar", { state: { from: `/produto/${product.id}` } });
      return;
    }
    add.mutate();
  }

  return (
    <article className="product-card">
      <Link to={`/produto/${product.id}`} className="product-image-wrap">
        <img src={product.images?.[0]?.url || fallback} alt={product.images?.[0]?.alt || product.name} />
        {product.stock <= 5 && product.stock > 0 && <span className="stock-chip">Últimas unidades</span>}
      </Link>
      <button className="favorite-button" aria-label="Favoritar produto"><Heart size={18} /></button>
      <div className="product-card-body">
        <span className="product-category">{product.category?.name ?? "Seleção Vitrine"}</span>
        <Link to={`/produto/${product.id}`}><h3>{product.name}</h3></Link>
        <div className="rating-row">
          <Star size={15} fill="currentColor" />
          <span>{rating ? rating.toFixed(1) : "Novo"}</span>
          <small>({product.ratingCount ?? product.reviews?.length ?? 0})</small>
        </div>
        <div className="product-card-footer">
          <div><strong>{formatPrice(product.price)}</strong><small>em até 10x</small></div>
          <button className="add-cart-icon" onClick={addToCart} disabled={add.isPending || product.stock === 0} aria-label="Adicionar ao carrinho">
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
