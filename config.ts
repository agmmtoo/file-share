import { loadSync } from "https://deno.land/std@0.217.0/dotenv/mod.ts";

const env = loadSync();

export const PORT = Number(env.PORT) || 4000;

export const APP_URL = env.APP_URL;

export const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
export const AWS_REGION = env.AWS_REGION;
export const AWS_S3_BUCKET_NAME = env.AWS_S3_BUCKET_NAME;

console.log({
  PORT,
  APP_URL,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
});
