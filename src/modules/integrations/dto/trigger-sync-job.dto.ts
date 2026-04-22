import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TriggerSyncJobDto {
  @ApiProperty({ example: 'org_123', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  organizationId!: string;

  @ApiPropertyOptional({ example: 'request', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetResourceType?: string;

  @ApiPropertyOptional({ example: 'req_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetResourceId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Generic integration sync payload. Accounting/ERP providers currently accept an upsert envelope for entities such as customer, vendor, invoice, and sales_order.',
    example: {
      domain: 'accounting',
      entityType: 'customer',
      operation: 'upsert',
      source: {
        resourceType: 'client',
        resourceId: 'client_123',
        displayName: 'Acme Clinic',
      },
      customer: {
        displayName: 'Acme Clinic',
        companyName: 'Acme Clinic LLC',
        email: 'billing@acme.test',
        phone: '+971500000000',
        currencyCode: 'AED',
        billingAddress: {
          addressLine1: 'Dubai Healthcare City',
          city: 'Dubai',
          countryCode: 'AE',
        },
        contactPersons: [
          {
            firstName: 'Ayla',
            lastName: 'Demir',
            email: 'billing@acme.test',
          },
        ],
      },
    },
  })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'user_123', maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  actorUserId?: string;
}