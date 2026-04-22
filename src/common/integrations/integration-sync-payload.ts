export const INTEGRATION_SYNC_DOMAIN_VALUES = ['accounting', 'erp'] as const;

export type IntegrationSyncDomain =
  (typeof INTEGRATION_SYNC_DOMAIN_VALUES)[number];

export const ACCOUNTING_ERP_SYNC_ENTITY_VALUES = [
  'customer',
  'vendor',
  'invoice',
  'sales_order',
] as const;

export type AccountingErpSyncEntityType =
  (typeof ACCOUNTING_ERP_SYNC_ENTITY_VALUES)[number];

export const ACCOUNTING_ERP_SYNC_OPERATION_VALUES = ['upsert'] as const;

export type AccountingErpSyncOperation =
  (typeof ACCOUNTING_ERP_SYNC_OPERATION_VALUES)[number];

export const INTEGRATION_SYNC_SOURCE_RESOURCE_VALUES = [
  'client',
  'contact',
  'request',
  'submission',
  'file_asset',
] as const;

export type IntegrationSyncSourceResourceType =
  (typeof INTEGRATION_SYNC_SOURCE_RESOURCE_VALUES)[number];

export interface IntegrationSyncSourceReference {
  resourceType: IntegrationSyncSourceResourceType;
  resourceId: string;
  displayName?: string;
}

export interface IntegrationSyncDestinationReference {
  externalId?: string;
  externalReferenceKey?: string;
}

export interface IntegrationSyncAddress {
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface IntegrationSyncContactPerson {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface IntegrationSyncLineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  currencyCode?: string;
  itemCode?: string;
  taxPercent?: number;
  metadata?: Record<string, unknown>;
}

export interface AccountingErpCustomerRecord {
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  currencyCode?: string;
  taxRegistrationNumber?: string;
  billingAddress?: IntegrationSyncAddress;
  shippingAddress?: IntegrationSyncAddress;
  contactPersons?: IntegrationSyncContactPerson[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingErpVendorRecord {
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  currencyCode?: string;
  billingAddress?: IntegrationSyncAddress;
  contactPersons?: IntegrationSyncContactPerson[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingErpInvoiceRecord {
  documentNumber?: string;
  customerExternalId?: string;
  issueDate?: string;
  dueDate?: string;
  currencyCode: string;
  lineItems: IntegrationSyncLineItem[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingErpSalesOrderRecord {
  orderNumber?: string;
  customerExternalId?: string;
  orderDate?: string;
  currencyCode: string;
  lineItems: IntegrationSyncLineItem[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface AccountingErpSyncPayload extends Record<string, unknown> {
  domain: IntegrationSyncDomain;
  entityType: AccountingErpSyncEntityType;
  operation: AccountingErpSyncOperation;
  source: IntegrationSyncSourceReference;
  destination?: IntegrationSyncDestinationReference;
  customer?: AccountingErpCustomerRecord;
  vendor?: AccountingErpVendorRecord;
  invoice?: AccountingErpInvoiceRecord;
  salesOrder?: AccountingErpSalesOrderRecord;
  metadata?: Record<string, unknown>;
}

export type IntegrationSyncPayload =
  | AccountingErpSyncPayload
  | Record<string, unknown>;

const ACCOUNTING_ERP_SYNC_ENTITY_SET = new Set<AccountingErpSyncEntityType>(
  ACCOUNTING_ERP_SYNC_ENTITY_VALUES,
);

const ACCOUNTING_ERP_SYNC_OPERATION_SET = new Set<AccountingErpSyncOperation>(
  ACCOUNTING_ERP_SYNC_OPERATION_VALUES,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAccountingErpSyncPayload(
  value: IntegrationSyncPayload | null | undefined,
): value is AccountingErpSyncPayload {
  if (!isRecord(value)) {
    return false;
  }

  const source = value.source;

  return (
    (value.domain === 'accounting' || value.domain === 'erp') &&
    ACCOUNTING_ERP_SYNC_ENTITY_SET.has(
      value.entityType as AccountingErpSyncEntityType,
    ) &&
    ACCOUNTING_ERP_SYNC_OPERATION_SET.has(
      value.operation as AccountingErpSyncOperation,
    ) &&
    isRecord(source) &&
    typeof source.resourceType === 'string' &&
    typeof source.resourceId === 'string' &&
    source.resourceId.trim().length > 0
  );
}