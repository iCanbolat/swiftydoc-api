import { ApiProperty } from '@nestjs/swagger';

export class UpsertBrandingSettingsResponseDataDto {
  @ApiProperty({ example: 'branding_123' })
  id!: string;

  @ApiProperty({ example: 'org_123' })
  organizationId!: string;

  @ApiProperty({ example: 'SwiftyDoc' })
  displayName!: string;

  @ApiProperty({ nullable: true, example: 'https://cdn.example.com/logo.png' })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true, example: '#0A1F44' })
  primaryColor!: string | null;

  @ApiProperty({ nullable: true, example: '#14B8A6' })
  secondaryColor!: string | null;

  @ApiProperty({ nullable: true, example: 'SwiftyDoc Team' })
  emailFromName!: string | null;

  @ApiProperty({ nullable: true, example: 'support@swiftydoc.com' })
  emailReplyTo!: string | null;

  @ApiProperty({ example: '2026-04-22T10:30:00.000Z' })
  updatedAt!: string;
}

export class UpsertBrandingSettingsResponseDto {
  @ApiProperty({ type: () => UpsertBrandingSettingsResponseDataDto })
  data!: UpsertBrandingSettingsResponseDataDto;
}
