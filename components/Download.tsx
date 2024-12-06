import { Item } from "../types.ts";
import { Layout } from "./Layout.tsx";
import type { FC } from "hono/jsx";
import { SVGShield } from "./SVGShield.tsx";

export const Download: FC<{ qrcode: string; item: Item }> = async ({
  qrcode,
  item,
}) => {
  const exp = new Date(item.expire).toLocaleString();

  return (
    <Layout title={item.name}>
      <section>
        <figure>
          <div
            class="svg-container"
            dangerouslySetInnerHTML={{ __html: qrcode }}
          />
          <figcaption>{item.name}</figcaption>
          {/* <!-- <textarea readonly>{{ comment }}</textarea> --> */}
        </figure>
      </section>
      <section style="text-align: center; margin: 1rem 0;">
        <span>{item.encrypt ? <SVGShield /> : null}Available until: </span>{" "}
        <time data-expire={item.expire} id="expire" datetime={item.expire}>
          {exp}
        </time>
      </section>
      <section style="text-align: center; display: flex; justify-content: space-evenly;">
        <a href={item.url} download={item.name} class="download">
          <button id="download-button">Download</button>
        </a>
        <button id="share-button">Share</button>
        <button
          id="copy-button"
          data-name={item.name}
          data-presigned-url={item.url}
          data-encrypt={item.encrypt}
        >
          Copy Link
        </button>
      </section>
      <script src="/static/download.js" type="module" defer></script>
      {item.encrypt && (
        <script src="/static/decrypt.js" type="module" defer></script>
      )}
    </Layout>
  );
};
