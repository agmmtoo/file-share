import { Layout } from "./Layout.tsx";

export const NotFound = async () => {
  return (
    <Layout title="404">
      <div style="text-align: center;">
        <h4>404</h4>
        <p>It's just... I kinda don't know.</p>
      </div>
    </Layout>
  );
};
