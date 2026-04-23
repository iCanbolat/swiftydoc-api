import { SetMetadata } from '@nestjs/common';
import type { OrganizationPermission } from './organization-policy.types';

export const ORGANIZATION_POLICY_METADATA_KEY = 'auth:organization-permissions';

export function OrganizationPermissions(
  ...permissions: OrganizationPermission[]
) {
  return SetMetadata(ORGANIZATION_POLICY_METADATA_KEY, permissions);
}
