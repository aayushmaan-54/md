import { Hono } from "hono";
import authRoutes from "@/features/auth/routes";
import notesRoutes from "@/features/notes/routes";
import imagesRoutes from "@/features/images/routes";
import ping from "./ping";
import type { AppEnv } from "@/types";

const routes = new Hono<AppEnv>()
  .route("/auth", authRoutes)
  .route("/notes", notesRoutes)
  .route("/images", imagesRoutes)
  .route("/ping", ping);

export default routes;
