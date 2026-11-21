"use client";

export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="id">
      <body>
        <main
          style={{
            display: "grid",
            minHeight: "100vh",
            placeItems: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          <div>
            <h1>Terjadi kesalahan</h1>
            <p>Halaman tidak dapat dimuat saat ini. Silakan coba lagi.</p>
            <button type="button" onClick={() => retry()}>
              Coba lagi
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
