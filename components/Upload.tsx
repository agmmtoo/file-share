import { Layout } from "./Layout.tsx";

const options = [
  {
    id: "minute",
    value: 300000,
    text: "5 Minutes",
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
