import { Hono } from "hono";
import { qrcode } from "@libs/qrcode";
import { serveStatic } from "hono/deno";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { STATUS_CODE, STATUS_TEXT } from "@std/http";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

import {
  APP_URL,
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_S3_BUCKET_NAME,
  AWS_SECRET_ACCESS_KEY,
  PORT,
} from "./config.ts";
import { expireMap } from "./utils.ts";
import { STORE_KEY } from "./db.ts";
import { kv } from "./db.ts";

import type { Item } from "./types.ts";
import { Upload } from "./components/Upload.tsx";
import { getKey } from "./utils/generateId.ts";
import { createPresignedUrl, getPresignedUrl } from "./utils/AWSS3.ts";
import { Expired } from "./components/Expired.tsx";
import { NotFound } from "./components/NotFound.tsx";
import { Download } from "./components/Download.tsx";

const app = new Hono();

app.use(logger());

app.get("/", (c) => c.html(<Upload />));
app.use(
  "/static/*",
  serveStatic({
    root: ".",
    rewriteRequestPath: (path) => path.replace(/^\/static/, "/assets"),
  })
);

app.get("/download/:id", async (c) => {
  const id = c.req.param("id");
  const item = await kv.get<Item>([STORE_KEY, id]);
  if (!item.value) {
    return c.html(<NotFound />);
  }

  if (item.value.expire < new Date().getTime()) {
    c.status(410);
    return c.html(<Expired />);
  }

  const svg = qrcode(`${APP_URL}/f/${id}`, { output: "svg" }).replace("black", "rgb(var(--color-theme))");
  // const svg = qrcode(item.value.url, { output: "svg" });

  // const downloadPageTmpl = await Deno.readTextFile("download.html");
  // // match {{ key }} in the template
  // const templateRE = /\{\{\s([a-zA-Z_$][0-9a-zA-Z_$]*)\s\}\}/g;

  // const tmplVars: Record<string, string> = {
  //   qrcode: svg,
  //   filename: "item.value.name",
  //   url: "item.value.url",
  //   expire: "item.value.expire.toString()",
  // };

  // const downloadPageStr = downloadPageTmpl.replace(
  //   templateRE,
  //   (_match, key) => {
  //     return tmplVars[key];
  //   }
  // );

  // return c.html(downloadPageStr);

  return c.html(<Download qrcode={svg} item={item.value} />);
});

app.get("/f/:id", async (c) => {
  const id = c.req.param("id");
  const item = await kv.get<Item>([STORE_KEY, id]);
  if (!item.value) {
    c.status(404);
    return c.html(<NotFound />);
  }

  if (item.value.expire < new Date().getTime()) {
    c.status(STATUS_CODE.Gone);
    return c.html(<Expired />);
  }

  return c.redirect(item.value.url);
});

// app.post("/upload", async (c) => {
//   const form = await c.req.formData();
//   for (const [_key, value] of form.entries()) {
//     if (!value) {
//       c.status(STATUS_CODE.UnprocessableEntity);
//       return c.text(STATUS_TEXT[STATUS_CODE.UnprocessableEntity]);
//     }
//   }

//   const expireKey = form.get("expire") as string;
//   const file = form.get("file") as File;

//   if (file.size > 10 * 1024 * 1024) {
//     c.status(STATUS_CODE.BadRequest);
//     return c.text("File size too large! (max 10MB)");
//   }

//   const min = 100_000; // Minimum 6-digit number
//   const max = 999_999; // Maximum 6-digit number
//   const id = Math.floor(Math.random() * (max - min + 1)) + min;
//   const created = new Date().getTime();
//   const expire = created + expireMap[expireKey];
//   // upload to bucket

//   const s3Client = new S3Client({
//     region: AWS_REGION,
//     credentials: {
//       accessKeyId: AWS_ACCESS_KEY_ID,
//       secretAccessKey: AWS_SECRET_ACCESS_KEY,
//     },
//   });

//   const putObjectCommand = new PutObjectCommand({
//     Bucket: AWS_S3_BUCKET_NAME,
//     Key: id.toString(),
//     // @ts-ignore: find way to get arrayBuffer from file
//     Body: await file.arrayBuffer(),
//     ContentType: file.type,
//   });

//   const getObjectCommand = new GetObjectCommand({
//     Bucket: AWS_S3_BUCKET_NAME,
//     Key: id.toString(),
//   });

//   const s3PutResult = await s3Client.send(putObjectCommand);
//   console.log("uploaded: ", id, s3PutResult.$metadata.requestId);
//   // generate s3 presigned url
//   const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
//     expiresIn: expireMap[expireKey] / 1_000,
//   });
//   console.log("presignedUrl: ", presignedUrl);

//   await kv.set([STORE_KEY, id.toString()], {
//     id,
//     name: file.name,
//     size: file.size,
//     url: presignedUrl,
//     created,
//     expire,
//   });
//   console.log("saved to kv: ", STORE_KEY, id);

//   return c.redirect(`/download/${id.toString()}`);
// });

app.post(
  "/api/upload",
  zValidator(
    "json",
    z.object({
      expire: z.union([
        z.literal(60000),
        z.literal(3600000),
        z.literal(86400000),
      ]),
      name: z.string(),
      size: z.number(),
    })
  ),
  async (c) => {
    const v = c.req.valid("json");

    if (v.size > 10 * 1024 * 1024) {
      c.status(STATUS_CODE.BadRequest);
      return c.text("File size too large! (max 10MB)");
    }

    const key = getKey();
    const created = new Date().getTime();
    const expire = created + v.expire;

    const url = await createPresignedUrl(key.toString());

    const purl = await getPresignedUrl(
      key.toString(),
      expireMap[v.expire] / 1_000
    );

    await kv.set([STORE_KEY, key.toString()], {
      key,
      name: v.name,
      size: v.size,
      url: purl,
      created,
      expire,
    });
    console.log("saved to kv: ", STORE_KEY, key);

    const redirect = `/download/${key.toString()}`;
    console.log("storing: ", v);

    return c.json({ url, redirect });
  }
);

app.notFound((c) => {
  return c.html(<NotFound />);
});

Deno.serve({ port: PORT }, app.fetch);
