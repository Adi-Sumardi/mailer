import { Role } from './roles.decorator';

// Kontrak token yang diasumsikan diterbitkan oleh auth-service (belum ada saat ini).
// Sesuaikan begitu auth-service benar-benar mengeluarkan JWT — ini kontrak sementara.
export interface JwtPayload {
  sub: string; // user id
  role: Role;
  tenantId: string | null; // null untuk super_admin
}
