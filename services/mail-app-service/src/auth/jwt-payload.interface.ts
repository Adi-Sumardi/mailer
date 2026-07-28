// Kontrak sementara sampai auth-service tersedia — HARUS sesuai payload yang diterbitkan di sana.
// Berbeda dari domain-provisioning: service ini scoping akses per-mailbox, bukan per-tenant.
export interface JwtPayload {
  sub: string; // user id
  mailboxId: string;
}
