import { Hono } from "hono";
import { qrcode } from "@libs/qrcode";
import { serveStatic } from "hono/deno";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { STATUS_CODE } from "@std/http";

import { APP_URL, PORT } from "./config.ts";
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

  const svg = qrcode(`${APP_URL}/f/${id}`, { output: "svg" }).replace(
    "black",
    "rgb(var(--color-theme))"
  );

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

app.post(
  "/api/upload",
  zValidator(
    "json",
    z.object({
      expire: z.union([
        z.literal(300000),
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
    const expireAt = created + v.expire;

    const putURL = await createPresignedUrl(v.name);

    const getURL = await getPresignedUrl(v.name, v.expire / 1000);

    await kv.set([STORE_KEY, key.toString()], {
      key,
      name: v.name,
      size: v.size,
      url: getURL,
      created,
      expire: expireAt,
    });

    console.log("saved to kv: ", STORE_KEY, key, expireAt);

    const redirect = `/download/${key.toString()}`;

    return c.json({ url: putURL, redirect });
  }
);

app.get("/favicon*", (c) => {
  return c.redirect("/static/favicon.ico");
})

app.notFound((c) => {
  c.status(404);
  return c.html(<NotFound />);
});

Deno.serve({ port: PORT }, app.fetch);
