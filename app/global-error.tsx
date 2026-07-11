"use client";

/**
 * Last-resort error boundary — replaces the root layout, so it may render
 * without any of the app's CSS. Everything is inline-styled on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#faf6f1",
          color: "#3f3a34",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong loading this page
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#8a8177", margin: "0 0 20px" }}>
            It&apos;s usually temporary — a quick retry often fixes it.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              borderRadius: "12px",
              border: "none",
              background: "#c2703e",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#a89f94", marginTop: "16px" }}>
              Ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
