import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { registerChatSocket } from "./sockets/chat.socket.js";

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: true,
  },
});

registerChatSocket(io);

httpServer.listen(env.PORT, () => {
  console.log(`Server rodando na porta ${env.PORT}`);
});
