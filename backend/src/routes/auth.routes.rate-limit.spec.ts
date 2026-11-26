import express from "express";
import request from "supertest";
import { authRoutes } from "./auth.routes.js";
import { errorHandler } from "../middlewares/errorHandler.js";

describe("authentication rate limits", () => {
  it("limits registration attempts to five per IP in fifteen minutes", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);
    app.use(errorHandler);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post("/auth/register").send({}).expect(400);
    }

    await request(app)
      .post("/auth/register")
      .send({})
      .expect(429, { message: "Muitas tentativas de cadastro. Tente novamente em 15 minutos." });
  });
});
