import { Layout } from "./Layout.tsx";
import { useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

const options = [
  {
    id: "minute",
    value: 60000,
    text: "1 Minute",
  },
  {
    id: "hour",
    value: 3600000,
    text: "1 Hour",
  },
  {
    id: "day",
    value: 86400000,
    text: "1 Day",
  },
];

export const Upload = async () => {
  return (
    <Layout>
      <section class="upload">
        <script src="/static/upload.js" type="module" defer></script>
        <form
          id="form"
          action="/upload"
          method="post"
          enctype="multipart/form-data"
        >
          <input type="file" name="file" required />
          <fieldset>
            <legend>Expire</legend>
            {options.map(({ id, value, text }, idx) => (
              <>
                <input
                  type="radio"
                  id={id}
                  name="expire"
                  value={value}
                  checked={!idx}
                />
                <label for={id}>{text}</label>
              </>
            ))}
          </fieldset>
          <button type="submit">Upload</button>
          {/* <!-- <progress id="progress" value="0" max="100"></progress> --> */}
        </form>
      </section>
    </Layout>
  );
};

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
