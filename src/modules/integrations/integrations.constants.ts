import {
  INTEGRATION_AUTH_TYPE_VALUES,
  INTEGRATION_PROVIDER_KEY_VALUES,
  type IntegrationAuthType,
  type IntegrationProviderKey,
} from '../../common/integrations/integration-types';

export const INTEGRATION_PROVIDER_CATEGORY_VALUES = [
  'messaging',
  'email',
  'accounting',
  'erp',
  'storage',
] as const;

export type IntegrationProviderCategory =
  (typeof INTEGRATION_PROVIDER_CATEGORY_VALUES)[number];

export interface IntegrationProviderCatalogEntry {
  key: IntegrationProviderKey;
  displayName: string;
  category: IntegrationProviderCategory;
  authType: IntegrationAuthType;
  supportsConnectionTesting: boolean;
  supportsManualSync: boolean;
}

export const INTEGRATION_PROVIDER_CATALOG: readonly IntegrationProviderCatalogEntry[] =
  [
    {
      key: 'whatsapp_cloud_api',
      displayName: 'WhatsApp Business Platform (Cloud API)',
      category: 'messaging',
      authType: 'bearer_token',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'plivo',
      displayName: 'Plivo',
      category: 'messaging',
      authType: 'basic_auth',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'resend',
      displayName: 'Resend',
      category: 'email',
      authType: 'api_key',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'zoho_books',
      displayName: 'Zoho Books',
      category: 'accounting',
      authType: 'oauth2',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'odoo',
      displayName: 'Odoo',
      category: 'erp',
      authType: 'basic_auth',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'google_drive',
      displayName: 'Google Drive',
      category: 'storage',
      authType: 'oauth2',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
    {
      key: 'onedrive_sharepoint',
      displayName: 'OneDrive / SharePoint',
      category: 'storage',
      authType: 'oauth2',
      supportsConnectionTesting: true,
      supportsManualSync: true,
    },
  ] as const satisfies readonly IntegrationProviderCatalogEntry[];

export const INTEGRATION_PROVIDER_KEY_SET = new Set<IntegrationProviderKey>(
  INTEGRATION_PROVIDER_KEY_VALUES,
);

export const INTEGRATION_AUTH_TYPE_SET = new Set<IntegrationAuthType>(
  INTEGRATION_AUTH_TYPE_VALUES,
);
