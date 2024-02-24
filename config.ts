import { load } from "https://deno.land/std@0.217.0/dotenv/mod.ts";

await load();

export const PORT = Number(Deno.env.get("PORT")) ?? 3000;

export const APP_URL = Deno.env.get("APP_URL") ?? `http://localhost:${PORT}`;

export const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID") ?? "";
export const AWS_SECRET_ACCESS_KEY =
  Deno.env.get("AWS_SECRET_ACCESS_KEY") ?? "";
export const AWS_REGION = Deno.env.get("AWS_REGION") ?? "";
export const AWS_S3_BUCKET_NAME = Deno.env.get("AWS_S3_BUCKET_NAME") ?? "";

console.log({
  PORT,
  APP_URL,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
});
