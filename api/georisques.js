import { handleGeorisquesRequest } from "../server/georisques-handler.mjs";

// Vercel Node.js Web Handler signature.
export default {
  fetch: handleGeorisquesRequest,
};
