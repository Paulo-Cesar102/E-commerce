import { Heart, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { imageUrl, useFallbackImage } from "../lib/images";
import { formatPrice } from "../lib/format";
import type { Product } from "../types";
import { EmptyState, Loader, PageHeading } from "../components/UI";

type Favorite = { id: string; product: Product };

export function FavoritesPage() {
  const { data: favorites = [], isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: () => api<Favorite[]>("/wishlist") });
  if (isLoading) return <Loader label="Abrindo seus favoritos" />;
  if (!favorites.length) return <div className="page-container"><EmptyState title="Você ainda não salvou favoritos" text="Guarde produtos para encontrar tudo com facilidade depois." action={<Link className="button button-primary" to="/buscar">Explorar produtos <ArrowRight size={17} /></Link>} /></div>;
  return <div className="page-container"><PageHeading eyebrow="Sua curadoria" title="Favoritos" description={`${favorites.length} ${favorites.length === 1 ? "produto salvo" : "produtos salvos"}`} /><div className="product-grid">{favorites.map(({ product }) => <article className="product-card" key={product.id}><Link to={`/produto/${product.id}`}><img src={imageUrl(product.images?.[0]?.url)} onError={useFallbackImage} alt={product.name} /><h3>{product.name}</h3><strong>{formatPrice(product.price)}</strong></Link><Heart size={18} fill="currentColor" /></article>)}</div></div>;
}