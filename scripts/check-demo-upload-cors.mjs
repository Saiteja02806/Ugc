const bucket = process.env.AWS_S3_BUCKET?.trim() || "postpilot-media-dev";
const region = process.env.AWS_REGION?.trim() || "us-east-2";
const origins = [
  "https://getugcpilot.com",
  "https://www.getugcpilot.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

let failed = false;

for (const origin of origins) {
  const response = await fetch(
    `https://${bucket}.s3.${region}.amazonaws.com/demos/raw/cors-check`,
    {
      headers: {
        "Access-Control-Request-Headers": "content-type",
        "Access-Control-Request-Method": "PUT",
        Origin: origin,
      },
      method: "OPTIONS",
    },
  );
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  const passed = response.ok && allowedOrigin === origin;

  console.log(
    `${passed ? "PASS" : "FAIL"} ${origin} -> ${response.status} ${allowedOrigin ?? "no allow-origin header"}`,
  );
  failed ||= !passed;
}

if (failed) {
  process.exitCode = 1;
}
