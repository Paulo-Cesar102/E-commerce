export type Role = "CUSTOMER" | "SELLER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  _count?: { products: number };
  products?: Array<{ images: ProductImage[] }>;
};

export type ProductImage = {
  id?: string;
  url: string;
  alt?: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price: string | number;
  stock: number;
  averageRating?: string | number;
  ratingCount?: number;
  status?: "ACTIVE" | "INACTIVE";
  categoryId: string;
  sellerId: string;
  category?: Category;
  seller?: { id: string; storeName: string; description?: string; userId?: string };
  images: ProductImage[];
  options?: { id: string; type: string; value: string }[];
  variants?: { id: string; sku: string; attributes: Record<string, string>; price?: string | number; stock: number; active: boolean }[];
  reviews?: Review[];
};

export type Review = {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user?: { id: string; name: string };
};

export type CartItem = {
  id: string;
  quantity: number;
  selected: boolean;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: NonNullable<Product["variants"]>[number];
};

export type Cart = {
  id: string;
  items: CartItem[];
};

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "REFUNDED";

export type Order = {
  id: string;
  subtotal?: string | number;
  shippingCost?: string | number;
  discount?: string | number;
  shippingMethod?: string;
  total: string | number;
  status: OrderStatus;
  deliveryEstimateDate?: string;
  correiosTrackingCode?: string;
  shipment?: { provider: string; service: string; status: string; trackingCode?: string; quotedDays?: number };
  mercadoPagoPreference?: string;
  createdAt: string;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: string | number;
    productName?: string;
    productSku?: string;
    imageUrl?: string;
    product?: Product;
  }>;
  customer?: Pick<User, "id" | "name" | "email">;
};

export type ChatMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  status: "OPEN" | "CLOSED";
  buyer: { id: string; name: string };
  seller: { id: string; storeName: string; userId: string };
  order?: Order;
  messages: ChatMessage[];
};
