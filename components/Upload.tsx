import { getKey } from "../utils/generateId.ts";
import { createPresignedUrl } from "../utils/AWSS3.ts";
import { Layout } from "./Layout.tsx";

export const Upload = async () => {
  return (
    <Layout>
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
          <input type="radio" id="minute" name="expire" value="m" checked />
          <label for="minute">1 Minute</label>

          <input type="radio" id="hour" name="expire" value="h" />
          <label for="hour">1 Hour</label>

          <input type="radio" id="day" name="expire" value="d" />
          <label for="day">1 Day</label>
        </fieldset>
        <button type="submit">Upload</button>
        {/* <!-- <progress id="progress" value="0" max="100"></progress> --> */}
        <span class="footer">
          Made with 🩶 by <a href="https://github.com/agmmtoo">agmmtoo</a>.
        </span>
      </form>
    </Layout>
  );
};
