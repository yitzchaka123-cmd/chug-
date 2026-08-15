import { randomBytes } from "node:crypto";

console.log(`CHOIR_DATA_KEY=v1:${randomBytes(32).toString("base64")}`);
console.log(`CHOIR_TOKEN_SECRET=${randomBytes(48).toString("base64url")}`);
console.log(`CRON_SECRET=${randomBytes(48).toString("base64url")}`);
