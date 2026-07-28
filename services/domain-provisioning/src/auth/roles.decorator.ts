import { SetMetadata } from '@nestjs/common';

export type Role = 'super_admin' | 'tenant_admin' | 'end_user';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
