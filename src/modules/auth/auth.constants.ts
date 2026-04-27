/**
 * Shared authentication and identification patterns.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const WORKSPACE_CODE_PATTERN = /^[A-Z0-9]{3}-[A-Z]{5}$/;

/**
 * Workspace code configuration.
 * Format: XXX-YYYYY (3 chars prefix, 5 chars random suffix).
 */
export const WORKSPACE_CODE_PREFIX_LENGTH = 3;
export const WORKSPACE_CODE_SUFFIX_LENGTH = 5;
export const WORKSPACE_CODE_SUFFIX_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Password validation constraints.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128; // Backend allows longer passwords than frontend for safety

/**
 * Field length constraints.
 */
export const MAX_LENGTH_EMAIL = 255;
export const MAX_LENGTH_FULL_NAME = 160;
export const MAX_LENGTH_ORGANIZATION_NAME = 160;
export const MAX_LENGTH_ORGANIZATION_SLUG = 64;
export const MAX_LENGTH_WORKSPACE_NAME = 160;
export const MAX_LENGTH_LOCALE = 16;
export const MAX_LENGTH_PHONE = 32;
export const MAX_LENGTH_REGION = 32;
export const MAX_LENGTH_TIMEZONE = 64;
