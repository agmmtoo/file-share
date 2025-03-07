import type { FC } from "hono/jsx";

export const Layout: FC = (props) => {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Minimalist file sharing app." />
        <meta name="author" content="agmmtoo" />
        <meta name="theme-color" content="#8784c0" />
        <title>{props.title ? `${props.title} | ` : ""}File Share</title>
        <link rel="stylesheet" href="/static/style.css" />
      </head>

      <body>
        <main>{props.children}</main>
        <footer class="footer">
          Made with &lt;3 by <a href="https://github.com/agmmtoo">agmmtoo</a>.
        </footer>
      </body>
    </html>
  );
};
