import { Hono } from "https://deno.land/x/hono@v4.0.5/mod.ts";
import { qrcode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";
import {
  StatusCodes,

} from "https://deno.land/x/http_status@v1.0.1/mod.ts";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

import {
  PORT,
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET_NAME,
  APP_URL,
} from "./config.ts";
import { expireMap } from "./utils.ts";
import { STORE_KEY } from "./db.ts";
import { kv } from "./db.ts";

import type { Item } from "./types.ts";

const app = new Hono();

app.get("/", (c) => c.html(Deno.readTextFile("index.html")));

app.get("/download/:id", async (c) => {
  const id = c.req.param("id");
  const item = await kv.get<Item>([STORE_KEY, id]);
  if (!item.value) {
    return c.status(404);
  }

  if (item.value.expire < new Date().getTime()) {
    c.status(410);
    return c.text("Gone");
  }

  // const base64Image = await qrcode(String(item.value.url));
  const base64Image = await qrcode(`${APP_URL}/f/${id}`);

  const downloadPageTmpl = await Deno.readTextFile("download.html");
  // match {{ key }} in the template
  const templateRE = /\{\{\s([a-zA-Z_$][0-9a-zA-Z_$]*)\s\}\}/g;

  const tmplVars: Record<string, string> = {
    qrcode: String(base64Image),
    filename: item.value.name,
    url: item.value.url,
    expire: item.value.expire.toString(),
  };

  const downloadPageStr = downloadPageTmpl.replace(
    templateRE,
    (_match, key) => {
      return tmplVars[key];
    }
  );

  return c.html(downloadPageStr);
});

app.get("/f/:id", async (c) => {
  const id = c.req.param("id");
  const item = await kv.get<Item>([STORE_KEY, id]);
  if (!item.value) {
    return c.status(404);
  }

  if (item.value.expire < new Date().getTime()) {
    c.status(410);
    return c.text("Gone");
  }

  return c.redirect(item.value.url);
});

app.post("/upload", async (c) => {
  const form = await c.req.formData();
  for (const [_key, value] of form.entries()) {
    if (!value) {
      c.status(422);
      return c.text("UnprocessableEntity");
    }
  }

  const expireKey = form.get("expire") as string;
  const file = form.get("file") as File;

  if (file.size > 10 * 1024 * 1024) {
    c.status(StatusCodes.BAD_REQUEST);
    return c.text("File size too large! (max 10MB)");
  }

  const min = 100_000; // Minimum 6-digit number
  const max = 999_999; // Maximum 6-digit number
  const id = Math.floor(Math.random() * (max - min + 1)) + min;
  const created = new Date().getTime();
  const expire = created + expireMap[expireKey];
  // upload to bucket

  const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const putObjectCommand = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: id.toString(),
    Body: await file.arrayBuffer(),
    ContentType: file.type,
  });

  const getObjectCommand = new GetObjectCommand({
    Bucket: AWS_S3_BUCKET_NAME,
    Key: id.toString(),
  });

  const s3PutResult = await s3Client.send(putObjectCommand);
  console.log("uploaded: ", id, s3PutResult.$metadata.requestId);
  // generate s3 presigned url
  const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
    expiresIn: expireMap[expireKey] / 1_000,
  });
  console.log("presignedUrl: ", presignedUrl);

  await kv.set([STORE_KEY, id.toString()], {
    id,
    name: file.name,
    size: file.size,
    url: presignedUrl,
    created,
    expire,
  });
  console.log("saved to kv: ", STORE_KEY, id);

  return c.redirect(`/download/${id.toString()}`);
});

Deno.serve({ port: PORT }, app.fetch);
