const { readState, writeState } = require("../lib/db");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      sendJson(response, await readState());
      return;
    }

    if (request.method === "PUT") {
      const body = await readBody(request);
      sendJson(response, await writeState(body));
      return;
    }

    response.statusCode = 405;
    response.setHeader("Allow", "GET, PUT");
    response.end();
  } catch (error) {
    response.statusCode = 500;
    sendJson(response, { error: "Server error", detail: error.message });
  }
};

function readBody(request) {
  if (request.body && typeof request.body === "object") return Promise.resolve(request.body);
  if (request.body && typeof request.body === "string") return Promise.resolve(JSON.parse(request.body));

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, data) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(data));
}
