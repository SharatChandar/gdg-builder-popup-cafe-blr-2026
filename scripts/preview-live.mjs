import http from "node:http";
const target = process.env.PUBLIC_URL;
if (!target || !target.startsWith("https://"))
  throw new Error("Set PUBLIC_URL to your deployed HTTPS café URL.");
const origin = new URL(target).origin;
http
  .createServer((req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    const search = new URL(req.url, "http://localhost").search;
    res.writeHead(307, {
      Location: origin + path + search,
      "Cache-Control": "no-store",
    });
    res.end();
  })
  .listen(8080, () =>
    console.log("Local preview redirects to the live Cloud Run café."),
  );
