import net from "node:net";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

function writeSocket(socket: net.Socket, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => socket.write(chunk, (error) => error ? reject(error) : resolve()));
}

export class ClamAvService {
  async scan(buffer: Buffer) {
    // Local development can run without ClamAV; production startup requires CLAMAV_HOST.
    if (!env.CLAMAV_HOST && env.NODE_ENV !== "production") return;
    if (!env.CLAMAV_HOST) throw new AppError(503, "Verificacao antivírus indisponivel");

    const socket = net.createConnection({ host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
    socket.setTimeout(env.CLAMAV_TIMEOUT_MS);
    const chunks: Buffer[] = [];
    try {
      const result = new Promise<string>((resolve, reject) => {
        socket.once("connect", async () => {
          try {
            await writeSocket(socket, Buffer.from("zINSTREAM\0"));
            for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
              const part = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
              const length = Buffer.alloc(4);
              length.writeUInt32BE(part.length);
              await writeSocket(socket, length);
              await writeSocket(socket, part);
            }
            await writeSocket(socket, Buffer.alloc(4));
          } catch (error) {
            reject(error);
            socket.destroy();
          }
        });
        socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim()));
        socket.once("error", reject);
        socket.once("timeout", () => { socket.destroy(new Error("ClamAV timeout")); });
      });
      const verdict = await result;
      if (verdict.endsWith("FOUND")) throw new AppError(400, "O arquivo foi identificado como malicioso e nao pode ser enviado");
      if (!verdict.endsWith("OK")) {
        console.error("ClamAV returned an invalid scan response");
        throw new AppError(503, "Nao foi possivel verificar o arquivo; tente novamente mais tarde");
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error("ClamAV scan service is unavailable");
      throw new AppError(503, "Verificacao antivírus indisponivel; o arquivo nao foi aceito");
    } finally {
      socket.destroy();
    }
  }
}
