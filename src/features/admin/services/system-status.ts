import "server-only";

import { prisma } from "@/lib/prisma/client";
import { getStorageProvider } from "@/lib/storage";

/**
 * Read-only operational status for the CMS.
 *
 * This reports configuration *presence* and measured connectivity only. Secret
 * values are never read into this module, so nothing here can leak a database URL,
 * a signing secret, or a storage credential.
 */

export type StatusCheck = {
  label: string;
  state: "ok" | "warning" | "error";
  detail: string;
};

export type SystemStatus = {
  checks: StatusCheck[];
  runtime: { nodeVersion: string; environment: string; generatedAt: string };
  storage: { driver: string; ready: boolean; detail: string };
  publication: { ready: boolean; detail: string };
};

function configured(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const checks: StatusCheck[] = [];

  const startedAt = Date.now();
  let databaseReady = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseReady = true;
    checks.push({
      label: "PostgreSQL",
      state: "ok",
      detail: `Terhubung dalam ${Date.now() - startedAt} ms.`,
    });
  } catch {
    checks.push({
      label: "PostgreSQL",
      state: "error",
      detail: "Tidak dapat terhubung. Periksa DATABASE_URL dan kontainer basis data.",
    });
  }

  let storageDriver = process.env.MEDIA_STORAGE_DRIVER ?? (process.env.NODE_ENV === "production" ? "s3" : "local");
  let storageReady = false;
  let storageDetail = "";

  try {
    const provider = getStorageProvider();
    storageDriver = provider.name;
    storageReady = true;
    storageDetail =
      provider.name === "local"
        ? "Penyimpanan lokal aktif. Gunakan hanya untuk pengembangan."
        : "Penyimpanan objek S3 aktif.";
  } catch (error) {
    storageDetail = error instanceof Error ? error.message : "Konfigurasi penyimpanan tidak valid.";
  }

  checks.push({
    label: "Penyimpanan media",
    state: storageReady ? (storageDriver === "local" && process.env.NODE_ENV === "production" ? "warning" : "ok") : "error",
    detail: storageDetail,
  });

  checks.push({
    label: "Kunci sesi",
    state: configured("NEXTAUTH_SECRET") || configured("AUTH_SECRET") ? "ok" : "error",
    detail:
      configured("NEXTAUTH_SECRET") || configured("AUTH_SECRET")
        ? "Secret penandatangan JWT tersedia."
        : "NEXTAUTH_SECRET tidak diset. Autentikasi akan gagal tertutup.",
  });

  checks.push({
    label: "Kunci throttle",
    state: configured("RATE_LIMIT_SECRET") ? "ok" : "error",
    detail: configured("RATE_LIMIT_SECRET")
      ? "RATE_LIMIT_SECRET tersedia untuk bucket sumber."
      : "RATE_LIMIT_SECRET tidak diset. Pembatasan percobaan masuk tidak dapat dihitung.",
  });

  checks.push({
    label: "Origin kanonik",
    state: configured("NEXTAUTH_URL") ? "ok" : "warning",
    detail: configured("NEXTAUTH_URL")
      ? "NEXTAUTH_URL diset; prefiks cookie aman diturunkan darinya."
      : "NEXTAUTH_URL tidak diset; tautan pemulihan dan prefiks cookie aman tidak dapat diturunkan.",
  });

  const trustedProxy = process.env.TRUST_PROXY_HEADERS === "true";
  checks.push({
    label: "Header proxy",
    state: trustedProxy ? "warning" : "ok",
    detail: trustedProxy
      ? "TRUST_PROXY_HEADERS=true: pastikan proxy menimpa x-forwarded-for."
      : "Header forwarded tidak dipercaya; alamat socket dipakai untuk bucket sumber.",
  });

  const mailTransport = process.env.ADMIN_MAIL_TRANSPORT ?? (process.env.NODE_ENV === "production" ? "" : "file");
  checks.push({
    label: "Transport email admin",
    state: mailTransport === "file" ? (process.env.NODE_ENV === "production" ? "error" : "warning") : mailTransport ? "ok" : "warning",
    detail:
      mailTransport === "file"
        ? "Transport berkas pengembangan: email tidak benar-benar terkirim."
        : mailTransport
          ? `Transport aktif: ${mailTransport}.`
          : "Belum ada transport produksi; pemulihan kata sandi produksi belum beroperasi.",
  });

  return {
    checks,
    runtime: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "development",
      generatedAt: new Date().toISOString(),
    },
    storage: { driver: storageDriver, ready: storageReady, detail: storageDetail },
    publication: {
      ready: databaseReady,
      detail: databaseReady
        ? "Halaman publik hanya menyajikan konten PUBLISHED, aktif, berkategori aktif, dan bertujuan valid."
        : "Tidak dapat memverifikasi aturan publikasi tanpa koneksi basis data.",
    },
  };
}