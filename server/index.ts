import express, { type Request, Response, NextFunction, type Express } from "express";
import { createServer, type Server } from "http";
import compression from "compression";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  if (req.path.startsWith("/embed/") || req.path.startsWith("/embed")) {
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors https://teams.microsoft.com https://*.teams.microsoft.com https://*.cloud.microsoft https://*.office.com https://*.microsoft365.com https://*.sharepoint.com 'self'",
    );
    res.removeHeader("X-Frame-Options");
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });

  next();
});

function detectEnvironment() {
  if (!process.env.NODE_ENV) {
    const isDevelopmentCommand = process.argv.some((arg) => arg.includes("tsx"));
    process.env.NODE_ENV = isDevelopmentCommand ? "development" : "production";
  }
  log(`🔍 Environment: ${process.env.NODE_ENV}`);
  log(`  - Port: ${process.env.PORT || "5000"} (default)`);
  return process.env.NODE_ENV;
}

function validateEnvironment() {
  const requiredVars = ["DATABASE_URL"];
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    log(`⚠️ Warning: Missing environment variables: ${missing.join(", ")}`);
    return false;
  }
  log("✅ Environment validation passed");
  return true;
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

(async () => {
  try {
    log("Starting server initialization...");
    detectEnvironment();
    const envValid = validateEnvironment();

    app.get("/healthz", (_req, res) => {
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    });

    app.get("/ready", (_req, res) => {
      res.status(200).json({
        status: "ready",
        environment: envValid,
        timestamp: new Date().toISOString(),
      });
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error handled: ${status} - ${message}`);
      res.status(status).json({ message });
    });

    const server = createServer(app);
    const port = parseInt(process.env.PORT || "5000", 10);

    await new Promise<void>((resolve, reject) => {
      server.listen(port, "0.0.0.0", () => {
        log(`✅ Server bound to port ${port} (env: ${app.get("env")}, pid: ${process.pid})`);
        resolve();
      });
      server.on("error", (error: any) => {
        log(`❌ Server binding error: ${error.message}`);
        reject(error);
      });
    });

    log("Registering routes...");
    try {
      const { registerRoutes } = await import("./routes");
      await registerRoutes(app);
      log("Routes registered successfully");
    } catch (routeError: any) {
      log(`⚠️ Route registration failed: ${routeError.message}`);
      if (routeError.stack) {
        log(`Route error stack: ${routeError.stack.split("\n").slice(0, 5).join("\n")}`);
      }
    }

    setupAdditionalServices(app, server, envValid).catch((error) => {
      log(`⚠️ Additional services setup failed: ${error.message}`);
    });

    const gracefulShutdown = (signal: string) => {
      log(`Received ${signal}, shutting down gracefully...`);
      server.close(() => {
        log("Server closed");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error: any) {
    log(`❌ Failed to start server: ${error.message}`);
    if (error.stack) log(`Stack trace: ${error.stack}`);
    process.exit(1);
  }
})();

async function setupAdditionalServices(app: Express, server: Server, _envValid: boolean) {
  if (process.env.DATABASE_URL) {
    try {
      const { db } = await import("./db");
      await db.execute(`SELECT 1 as test`);
      log("✅ Database connection successful");

      // Graph mail-subscription rehydrate is disabled in this stripped build:
      // the support email pipeline requires storage methods not present in
      // the slim storage layer.

      try {
        const { startAgentCardHealthScheduler } = await import(
          "./services/agent-card-health-scheduler.js"
        );
        await startAgentCardHealthScheduler();
        log("✅ Agent card health scheduler started");
      } catch (err: any) {
        log(`⚠️ Agent card health scheduler failed: ${err?.message}`);
      }

      try {
        const { startSlaBreachScheduler } = await import("./services/sla-breach-scheduler.js");
        await startSlaBreachScheduler();
        log("✅ SLA breach scheduler started");
      } catch (err: any) {
        log(`⚠️ SLA breach scheduler failed: ${err?.message}`);
      }
    } catch (dbError: any) {
      log(`⚠️ Database not available: ${dbError.message}`);
    }
  } else {
    log("⚠️ No DATABASE_URL provided - database features disabled");
  }

  const isDevelopment = process.env.NODE_ENV === "development";
  log(`Frontend mode: ${isDevelopment ? "Development (Vite)" : "Production (Static)"}`);

  if (isDevelopment) {
    try {
      const frontendApp = express();
      await setupVite(frontendApp, server);
      app.use((req, res, next) => {
        if (req.originalUrl.startsWith("/api") || req.originalUrl.startsWith("/object-storage")) {
          next();
        } else {
          frontendApp(req, res, next);
        }
      });
      log("✅ Vite development server setup successful");
    } catch (viteError: any) {
      log(`⚠️ Vite setup failed: ${viteError.message}`);
      try {
        serveStatic(app);
        log("✅ Fallback to static file serving successful");
      } catch (staticError: any) {
        log(`❌ Static file serving also failed: ${staticError.message}`);
      }
    }
  } else {
    try {
      serveStatic(app);
      log("✅ Static file serving setup successful");
    } catch (staticError: any) {
      log(`❌ Static file serving failed: ${staticError.message}`);
      process.exit(1);
    }
  }
}
