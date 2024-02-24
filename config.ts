import { load } from "https://deno.land/std@0.217.0/dotenv/mod.ts";

const env = await load();

export const PORT = Number(env.PORT) || 4000;
export const HTML_INDEX = env.INDEX || "index.html";
export const HTML_DOWNLOAD = env.DOWNLOAD || "download.html";

export const APP_URL = env.APP_URL;

export const AWS_ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
export const AWS_SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
export const AWS_REGION = env.AWS_REGION;
export const AWS_S3_BUCKET_NAME = env.AWS_S3_BUCKET_NAME;
