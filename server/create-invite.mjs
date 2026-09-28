import { randomBytes } from "node:crypto";
import { database, hashInvitation } from "./database.mjs";

const code = randomBytes(24).toString("base64url");
database
  .prepare("INSERT INTO invitations (code_hash, created_at) VALUES (?, ?)")
  .run(hashInvitation(code), Date.now());
database.close();

console.log(
  `Clé d’invitation à transmettre à l’agent (utilisable une seule fois) :\n\n${code}\n`,
);
