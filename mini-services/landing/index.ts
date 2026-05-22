import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const PORT = 3001;
const baseDir = import.meta.dir;
const publicDir = join(baseDir, "public");

function getMimeType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  return "application/octet-stream";
}

// Pre-load the main landing page
const indexHtml = readFileSync(join(publicDir, "index.html"), "utf-8");

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Serve landing page
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(indexHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Serve static files from /public/* (images, etc.)
    const filePath = join(publicDir, url.pathname.replace(/^\//, ""));
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const file = readFileSync(filePath);
      return new Response(file, {
        headers: { "Content-Type": getMimeType(filePath) },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("🚀 ForexAI Pro Landing Page running on http://localhost:" + PORT);
