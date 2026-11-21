# Phase 8J — Coolify Root Cause Report

Tanggal audit: 2026-11-21 (UTC)

## Status

- PASS — Coolify API discovery dan kapasitas VPS.
- PASS — Tidak ada container atau deployment production yang dihapus/diubah.
- KNOWN ISSUE — Metadata aplikasi production `4fndzksd1vmizwovi2bmvwmf` melaporkan `exited:unhealthy`, tetapi container dan deployment history tidak ada.
- NOT PRODUCTION DEPLOYED.

## Evidence

- Coolify 4.7.6 dan Traefik 3.7.19 berjalan sehat.
- `GET /deployments/applications/4fndzksd1vmizwovi2bmvwmf` mengembalikan HTTP 200 dengan 0 deployment.
- `GET /applications/4fndzksd1vmizwovi2bmvwmf/previews` mengembalikan 0 preview.
- Docker tidak memiliki container, image, label, atau compose project yang cocok dengan aplikasi production.
- API aplikasi tetap menyimpan repository/branch, port 3000, health path `/api/health`, dan domain production.
- Database production tetap healthy, private pada network `coolify`, tanpa host port 5432.

## Root cause assessment

Status tersebut bukan bukti kegagalan health check dari container aplikasi. Bukti yang tersedia menunjukkan metadata aplikasi stale/inconsistent: resource memiliki status unhealthy tanpa deployment record dan tanpa runtime container. Penyebab internal persisnya tidak dapat dibuktikan tanpa membaca database internal Coolify, dan tindakan tersebut dilarang oleh runbook.

## Safe decision

Resource production dipertahankan. Staging dibuat pada environment dan resource terpisah untuk menghindari redeploy buta atau penghapusan resource production.
