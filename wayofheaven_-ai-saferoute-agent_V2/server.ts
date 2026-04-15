import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for simulated mobility data
  app.post("/api/simulate-mobility", (req, res) => {
    const { source, destination, time } = req.body;

    const trafficLevels = ["Low", "Medium", "High"];
    const crimeRisks = ["Low", "Medium", "High"];
    const roadConditions = ["Good", "Average", "Poor"];

    // Simple simulation logic based on input (or just random as requested)
    const traffic = trafficLevels[Math.floor(Math.random() * trafficLevels.length)];
    const crime = crimeRisks[Math.floor(Math.random() * crimeRisks.length)];
    const road = roadConditions[Math.floor(Math.random() * roadConditions.length)];

    res.json({
      source,
      destination,
      time,
      simulatedData: {
        traffic,
        crime,
        road,
      },
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
