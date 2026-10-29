"use client";

import Script from "next/script";

// Swagger UI rendered from the spec at /api/v1/openapi.
export default function ApiDocsPage() {
  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css" />
      <div id="swagger" className="bg-white" />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"
        strategy="afterInteractive"
        onReady={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).SwaggerUIBundle({ url: "/api/v1/openapi", dom_id: "#swagger" });
        }}
      />
    </>
  );
}
