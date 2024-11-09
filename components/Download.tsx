import { Item } from "../types.ts";
import { Layout } from "./Layout.tsx";
import type { FC } from "hono/jsx";

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
        <span>Available until: </span>{" "}
        <time data-expire={item.expire} id="expire" datetime={item.expire}>
          {exp}
        </time>
      </section>
      <section style="text-align: center; display: flex; justify-content: space-evenly;">
        <a href={item.url} download={item.name} class="download">
          Download
        </a>
        <button id="share-button">Share</button>
        <button id="copy-button" data-link={item.url}>
          Copy Link
        </button>
      </section>
      <script src="/static/download.js" type="module" defer></script>
    </Layout>
  );
};
