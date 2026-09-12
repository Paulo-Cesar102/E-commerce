import { OrderService } from "../services/OrderService.js";

const count = await new OrderService().expirePendingPayments();
console.log(`Pedidos pendentes expirados: ${count}`);
