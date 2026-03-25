import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  // Pterodactyl использует переменную SERVER_PORT, обычные хостинги - PORT. По умолчанию 3000.
  const PORT = process.env.SERVER_PORT 
    ? parseInt(process.env.SERVER_PORT) 
    : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  // Здесь можно добавлять свои API маршруты
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running!" });
  });

  // Настройка Vite middleware для режима разработки
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // В продакшене отдаем собранные статические файлы из папки dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Все остальные запросы направляем на index.html (для поддержки SPA роутинга)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
