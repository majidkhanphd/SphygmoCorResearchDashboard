import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, initializeBackgroundTrackers, markBackgroundInitComplete } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { ensureFullTextSearch } from "./db";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    log(`Error: ${status} - ${message}`);
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    Promise.allSettled([
      ensureFullTextSearch(),
      initializeBackgroundTrackers(),
    ]).then((results) => {
      const ftsResult = results[0];
      const trackerResult = results[1];
      if (ftsResult.status === "rejected") {
        console.error("[STARTUP] Full-text search setup failed:", ftsResult.reason);
      }
      if (trackerResult.status === "rejected") {
        console.error("[STARTUP] Tracker initialization failed:", trackerResult.reason);
      }
      const allOk = results.every(r => r.status === "fulfilled");
      markBackgroundInitComplete();
      log(`background initialization ${allOk ? "complete" : "complete with errors"}`);
    });
  });
})();
