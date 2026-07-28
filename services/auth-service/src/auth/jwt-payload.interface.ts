import { Role } from './dto/register.dto';

// Kontrak token yang dikonsumsi oleh domain-provisioning ({sub, role, tenantId}) dan
// mail-app-service ({sub, mailboxId}) — superset ini dipakai supaya satu token berlaku
// di semua service tanpa perlu re-login per service.
export interface JwtPayload {
  sub: string;
  role: Role;
  tenantId: string | null;
  mailboxId: string | null;
}
