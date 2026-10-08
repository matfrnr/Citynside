import { handleAssistantRequest } from "../server/assistant-handler.mjs";

export default async function handler(req, res) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
  }
  const request = new Request("http://localhost/api/assistant", {
    method: req.method || "POST",
    headers,
    ...(req.method === "GET" || req.method === "HEAD" ? {} : { body: JSON.stringify(req.body ?? {}) }),
  });
  const response = await handleAssistantRequest(request);
  res.status(response.status);
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(await response.text());
}
