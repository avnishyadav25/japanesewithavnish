"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: "2rem", fontFamily: "system-ui", textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <p style={{ color: "#555", marginBottom: "1rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              background: "#D0021B",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
