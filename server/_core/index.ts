import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

// Resolve __dirname for ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve static web build (Expo export output goes to dist/)
  // Server bundle goes to dist-server/, web assets go to dist/
  // In production: process.cwd() = /app, web assets at /app/dist
  const webBuildCandidates = [
    path.join(process.cwd(), "dist"),           // /app/dist (Railway production)
    path.join(__dirname, "..", "dist"),          // relative to dist-server/
    path.join(__dirname, "dist"),               // fallback
  ];

  const webBuildPath = webBuildCandidates.find(
    (p) => fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))
  ) ?? null;

  if (webBuildPath) {
    console.log(`[web] Serving static files from: ${webBuildPath}`);
    app.use(express.static(webBuildPath));

    // SPA fallback: serve HTML files for known routes, index.html for unknown
    app.get("*", (req, res) => {
      const filePath = path.join(webBuildPath, req.path);
      if (fs.existsSync(filePath + ".html")) {
        res.sendFile(filePath + ".html");
      } else if (fs.existsSync(path.join(filePath, "index.html"))) {
        res.sendFile(path.join(filePath, "index.html"));
      } else {
        res.sendFile(path.join(webBuildPath, "index.html"));
      }
    });
  } else {
    console.warn("[web] Frontend build not found. Run pnpm build:web to generate it.");
    app.get("/", (_req, res) => {
      res.json({ message: "BarberPro API is running. Frontend not built yet." });
    });
  }

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] BarberPro server listening on port ${port}`);
  });
}

startServer().catch(console.error);
