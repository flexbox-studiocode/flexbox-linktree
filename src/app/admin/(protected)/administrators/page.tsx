import {
  AdminStatusForm,
  DeleteAdminForm,
  InviteAdminForm,
  RevokeInvitationForm,
} from "@/components/admin/administrator-controls";
import { Card, EmptyState, PageHeader, Stat, StatusBadge } from "@/components/admin/ui";
import { findAdminAccountRows, getAdminStatusCounts } from "@/features/admin/repositories/admin-users";
import { deriveInvitationState } from "@/features/admin/services/admin-management";
import { requireAdmin } from "@/lib/auth/session";
import { formatJakartaDateTime, toIsoString } from "@/lib/utils/format";

/**
 * Administrator management.
 *
 * Invitations are issued here but accepted through the operator CLI, which is the
 * approved provisioning path. Self-lockout and last-active-Super-Admin rules are
 * enforced inside the lifecycle transaction, not in this page.
 */
export default async function AdminAdministratorsPage() {
  const current = await requireAdmin();

  const [accounts, counts] = await Promise.all([findAdminAccountRows(), getAdminStatusCounts()]);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Tidak ada pendaftaran publik. Akun dibuat lewat bootstrap terkontrol atau undangan yang diterima dari terminal operator."
        eyebrow="Flexbox Studio · Akses"
        title="Administrator"
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total akun" value={counts.total} />
        <Stat label="Aktif" value={counts.active} />
        <Stat label="Diundang" value={counts.invited} />
        <Stat label="Ditangguhkan / nonaktif" value={counts.suspended + counts.disabled} />
      </div>

      <Card>
        <h2 className="text-base font-semibold text-[var(--ink)]">Undang administrator</h2>
        <p className="mt-1 mb-4 text-sm leading-6 text-[var(--muted)]">
          Undangan hanya dapat dibuat oleh Super Admin aktif. Token aktivasi ditampilkan satu kali dan tidak disimpan
          dalam bentuk asli.
        </p>
        <InviteAdminForm />
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          description="Belum ada akun administrator. Gunakan operator CLI bootstrap untuk membuat Super Admin pertama."
          title="Belum ada administrator"
        />
      ) : (
        <ul className="space-y-3">
          {accounts.map((account) => {
            const invitation = account.invitation;
            const invitationState = deriveInvitationState(invitation);
            const isSelf = account.id === current.id;
            const isLastActiveOwner =
              account.status === "ACTIVE" && account.role === "SUPER_ADMIN" && counts.active <= 1;

            return (
              <li key={account.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--ink)]">{account.fullName}</p>
                        <StatusBadge value={account.status} />
                        <span className="rounded-full border border-[var(--line)] bg-[var(--page)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
                          {account.role}
                        </span>
                        {isSelf ? (
                          <span className="text-xs font-semibold text-[var(--blue-strong)]">Akun Anda</span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-all text-sm text-[var(--muted)]">{account.email}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Dibuat <time dateTime={toIsoString(account.createdAt)}>{formatJakartaDateTime(account.createdAt)}</time>
                        {" · "}
                        Masuk terakhir{" "}
                        {account.lastLoginAt ? (
                          <time dateTime={toIsoString(account.lastLoginAt)}>{formatJakartaDateTime(account.lastLoginAt)}</time>
                        ) : (
                          "belum pernah"
                        )}
                      </p>
                      {invitation && invitationState !== "accepted" ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Undangan: {invitationState === "pending" ? "menunggu" : invitationState === "expired" ? "kedaluwarsa" : "dibatalkan"}
                          {" · berlaku sampai "}
                          <time dateTime={toIsoString(invitation.expiresAt)}>{formatJakartaDateTime(invitation.expiresAt)}</time>
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start gap-3">
                      {!isSelf ? <AdminStatusForm adminUserId={account.id} currentStatus={account.status} /> : null}

                      {invitation && invitationState === "pending" ? (
                        <RevokeInvitationForm invitationId={invitation.id} />
                      ) : null}

                      {current.isSuperAdmin && !isSelf ? (
                        isLastActiveOwner ? (
                          <p className="text-xs font-medium text-[var(--muted)]">
                            Super Admin aktif terakhir tidak dapat dihapus.
                          </p>
                        ) : (
                          <DeleteAdminForm accountEmail={account.email} adminUserId={account.id} />
                        )
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}