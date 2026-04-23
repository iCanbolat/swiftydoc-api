export const ORGANIZATION_PLAN_TIER_VALUES = [
  'foundation',
  'growth',
  'enterprise',
] as const;

export type OrganizationPlanTier =
  (typeof ORGANIZATION_PLAN_TIER_VALUES)[number];

export const ORGANIZATION_ENTITLEMENT_KEYS = [
  'internalUsers',
  'activeRequests',
  'storageBytes',
  'emailPerMonth',
  'smsPerMonth',
] as const;

export type OrganizationEntitlementKey =
  (typeof ORGANIZATION_ENTITLEMENT_KEYS)[number];

export interface OrganizationEntitlementLimits {
  activeRequests: number | null;
  emailPerMonth: number | null;
  internalUsers: number | null;
  smsPerMonth: number | null;
  storageBytes: number | null;
}

export interface OrganizationEntitlementUsage {
  activeRequests: number;
  emailPerMonth: number;
  internalUsers: number;
  smsPerMonth: number;
  storageBytes: number;
}

export interface OrganizationEntitlementSnapshot {
  generatedAt: string;
  limits: OrganizationEntitlementLimits;
  organizationId: string;
  planTier: string;
  usage: OrganizationEntitlementUsage;
}

export const ORGANIZATION_PLAN_ENTITLEMENTS: Record<
  OrganizationPlanTier,
  OrganizationEntitlementLimits
> = {
  foundation: {
    activeRequests: 250,
    emailPerMonth: 1000,
    internalUsers: 5,
    smsPerMonth: 250,
    storageBytes: 5 * 1024 * 1024 * 1024,
  },
  growth: {
    activeRequests: 2500,
    emailPerMonth: 10000,
    internalUsers: 25,
    smsPerMonth: 2500,
    storageBytes: 100 * 1024 * 1024 * 1024,
  },
  enterprise: {
    activeRequests: null,
    emailPerMonth: null,
    internalUsers: null,
    smsPerMonth: null,
    storageBytes: null,
  },
};
