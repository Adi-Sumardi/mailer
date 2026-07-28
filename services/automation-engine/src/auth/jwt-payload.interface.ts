// Kontrak token yang diterbitkan auth-service — service ini hanya memakai `sub` (userId)
// untuk scoping akses (automation rule dimiliki per-user, sesuai ERD).
export interface JwtPayload {
  sub: string;
  role: 'super_admin' | 'tenant_admin' | 'end_user';
  tenantId: string | null;
  mailboxId: string | null;
}
