const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const stateHandler = require("./api/state");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/state")) {
    await stateHandler(request, response);
    return;
  }

  serveStatic(request.url, response);
});

server.listen(port, host, () => {
  console.log(`Dia de Bebe listo en http://127.0.0.1:${port}`);
  if (!process.env.DATABASE_URL) {
    console.log("Falta DATABASE_URL: configura una base PostgreSQL para leer y guardar datos.");
  }
  getLanAddresses().forEach((address) => {
    console.log(`Celular en la misma red: http://${address}:${port}`);
  });
});

function serveStatic(requestUrl, response) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}
