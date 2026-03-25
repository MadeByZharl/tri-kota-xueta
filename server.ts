import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  
  // Pterodactyl использует переменную SERVER_PORT, обычные хостинги - PORT. По умолчанию 3000.
  const PORT = process.env.SERVER_PORT 
    ? parseInt(process.env.SERVER_PORT) 
    : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode`);

  // Здесь можно добавлять свои API маршруты
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Server is running!", 
      mode: process.env.NODE_ENV,
      cwd: process.cwd()
    });
  });

  // Middleware для логирования запросов (поможет отладить пути)
  app.use((req, res, next) => {
    if (req.url.includes('HockeyAssets')) {
      console.log(`[Server] Request for asset: ${req.url}`);
    }
    next();
  });

  // Настройка Vite middleware для режима разработки
  if (process.env.NODE_ENV !== "production") {
    console.log("[Server] Running in DEVELOPMENT mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    // Также явно отдаем папку public в режиме разработки
    app.use(express.static(path.resolve(__dirname, 'public')));
  } else {
    console.log("[Server] Running in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    const publicPath = path.join(process.cwd(), 'public');
    
    console.log(`[Server] Dist path: ${distPath}`);
    console.log(`[Server] Public path: ${publicPath}`);
    
    // Сначала пробуем отдать из dist (там лежат собранные файлы)
    app.use(express.static(distPath));
    // Затем из public (на всякий случай)
    app.use(express.static(publicPath));
    
    // Явно прописываем путь для HockeyAssets
    app.use('/HockeyAssets', express.static(path.join(publicPath, 'HockeyAssets')));
    app.use('/HockeyAssets', express.static(path.join(distPath, 'HockeyAssets')));
    
    // Дополнительный лог для проверки существования файлов
    const checkPath = path.join(distPath, 'HockeyAssets', 'star00.png');
    if (fs.existsSync(checkPath)) {
      console.log(`[Server] Verified: ${checkPath} exists.`);
    } else {
      console.warn(`[Server] Warning: ${checkPath} NOT found!`);
    }
    
    // Все остальные запросы направляем на index.html (для поддержки SPA роутинга)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("[Server] Critical error during startup:", err);
});
