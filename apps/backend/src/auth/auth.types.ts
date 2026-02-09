import { Role } from '@prisma/client';

export type AuthUser = {
  id: string;
  role: Role;
  account: string;
  name: string;
};