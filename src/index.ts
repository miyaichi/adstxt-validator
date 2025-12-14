import * as psl from 'psl';

/**
 * Utility to validate and parse Ads.txt data
 */

// Severity enum to represent the importance level of validation results
export enum Severity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

// Validation keys without namespace prefixes for cleaner structure
export const VALIDATION_KEYS = {
  MISSING_FIELDS: 'missingFields',
  INVALID_FORMAT: 'invalidFormat',
  INVALID_RELATIONSHIP: 'invalidRelationship',
  INVALID_DOMAIN: 'invalidDomain',
  EMPTY_ACCOUNT_ID: 'emptyAccountId',
  IMPLIMENTED: 'implimentedEntry',
  NO_SELLERS_JSON: 'noSellersJson',
  DIRECT_ACCOUNT_ID_NOT_IN_SELLERS_JSON: 'directAccountIdNotInSellersJson',
  RESELLER_ACCOUNT_ID_NOT_IN_SELLERS_JSON: 'resellerAccountIdNotInSellersJson',
  DOMAIN_MISMATCH: 'domainMismatch',
  DIRECT_NOT_PUBLISHER: 'directNotPublisher',
  SELLER_ID_NOT_UNIQUE: 'sellerIdNotUnique',
  RESELLER_NOT_INTERMEDIARY: 'resellerNotIntermediary',
  SELLERS_JSON_VALIDATION_ERROR: 'sellersJsonValidationError',
  // Content validation
  EMPTY_FILE: 'emptyFile',
  INVALID_CHARACTERS: 'invalidCharacters',
};

// For backward compatibility
export const ERROR_KEYS = VALIDATION_KEYS;

// Export message system
export {
  ValidationMessage,
  MessageData,
  MessageProvider,
  MessageConfig,
  DefaultMessageProvider,
  SupportedLocale,
  setMessageProvider,
  getMessageProvider,
  createValidationMessage,
  configureMessages,
  isSupportedLocale,
  getSupportedLocales,
} from './messages';

// New efficient sellers.json provider interface
export interface SellersJsonProvider {
  /**
   * Get specific sellers by seller IDs for a domain
   * @param domain - The domain to fetch sellers for
   * @param sellerIds - Array of seller IDs to fetch
   * @returns Promise resolving to batch sellers result
   */
  batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult>;

  /**
   * Get metadata for a domain's sellers.json
   * @param domain - The domain to fetch metadata for
   * @returns Promise resolving to sellers.json metadata
   */
  getMetadata(domain: string): Promise<SellersJsonMetadata>;

  /**
   * Check if a domain has a sellers.json file
   * @param domain - The domain to check
   * @returns Promise resolving to boolean indicating existence
   */
  hasSellerJson(domain: string): Promise<boolean>;

  /**
   * Get cache information for a domain
   * @param domain - The domain to get cache info for
   * @returns Promise resolving to cache information
   */
  getCacheInfo(domain: string): Promise<CacheInfo>;
}

// Interfaces aligned with backend API definitions
export interface BatchSellersResult {
  domain: string;
  requested_count: number;
  found_count: number;
  results: SellerResult[];
  metadata: SellersJsonMetadata;
  cache: CacheInfo;
}

export interface SellerResult {
  sellerId: string;
  seller: Seller | null;
  found: boolean;
  source: 'cache' | 'fresh';
  error?: string;
}

export interface Seller {
  seller_id: string;
  name?: string;
  domain?: string;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
  is_confidential?: 0 | 1;
  [key: string]: any;
}

export interface SellersJsonMetadata {
  version?: string;
  contact_email?: string;
  contact_address?: string;
  seller_count?: number;
  identifiers?: any[];
}

export interface CacheInfo {
  is_cached: boolean;
  last_updated?: string;
  status: 'success' | 'error' | 'stale';
  expires_at?: string;
}

// Common base interface for both record and variable entries
export interface ParsedAdsTxtEntryBase {
  line_number: number;
  raw_line: string;
  is_valid: boolean;
  error?: string;
  has_warning?: boolean;
  warning?: string;
  validation_key?: string;
  severity?: Severity;
  warning_params?: Record<string, any>;
  all_warnings?: Array<{ key: string; params?: Record<string, any>; severity?: Severity }>;
  validation_error?: string;
}

export interface ParsedAdsTxtVariable extends ParsedAdsTxtEntryBase {
  variable_type:
    | 'CONTACT'
    | 'SUBDOMAIN'
    | 'INVENTORYPARTNERDOMAIN'
    | 'OWNERDOMAIN'
    | 'MANAGERDOMAIN';
  value: string;
  is_variable: true;
}

export type ParsedAdsTxtEntry = ParsedAdsTxtRecord | ParsedAdsTxtVariable;

/**
 * Type guard to check if an entry is a record
 */
export function isAdsTxtRecord(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtRecord {
  return 'domain' in entry && 'account_id' in entry && 'account_type' in entry;
}

/**
 * Type guard to check if an entry is a variable
 */
export function isAdsTxtVariable(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtVariable {
  return (
    'variable_type' in entry &&
    'value' in entry &&
    'is_variable' in entry &&
    entry.is_variable === true
  );
}

export interface ParsedAdsTxtRecord extends ParsedAdsTxtEntryBase {
  domain: string;
  account_id: string;
  account_type: string;
  certification_authority_id?: string;
  relationship: 'DIRECT' | 'RESELLER';
  is_variable?: false; // Mark this as not a variable record
  duplicate_domain?: string; // Store duplicate domain without overwriting original domain
  validation_results?: CrossCheckValidationResult; // Store detailed validation results
}

/**
 * Creates an invalid record with specified validation issue
 */
function createInvalidRecord(
  partialRecord: Partial<ParsedAdsTxtRecord>,
  validationKey: string,
  severity: Severity = Severity.ERROR // Default to ERROR for validation issues
): ParsedAdsTxtRecord {
  return {
    domain: partialRecord.domain || '',
    account_id: partialRecord.account_id || '',
    account_type: partialRecord.account_type || '',
    relationship: partialRecord.relationship || 'DIRECT',
    line_number: partialRecord.line_number || 0,
    raw_line: partialRecord.raw_line || '',
    is_valid: false,
    error: validationKey, // For backward compatibility
    validation_key: validationKey, // New field
    severity: severity, // New field
    is_variable: false,
    ...partialRecord, // Allow overriding defaults
  };
}

/**
 * Parse an ads.txt variable line
 * @param line - The raw line from the file
 * @param lineNumber - The line number in the file (for error reporting)
 * @returns A parsed variable if recognized, null otherwise
 */
export function parseAdsTxtVariable(line: string, lineNumber: number): ParsedAdsTxtVariable | null {
  const trimmedLine = line.trim();

  // Check if the line contains a variable definition
  // Variables should be in the format: VARIABLE=value
  const variableMatch = trimmedLine.match(
    /^(CONTACT|SUBDOMAIN|INVENTORYPARTNERDOMAIN|OWNERDOMAIN|MANAGERDOMAIN)=(.+)$/i
  );

  if (variableMatch) {
    const variableType = variableMatch[1].toUpperCase() as
      | 'CONTACT'
      | 'SUBDOMAIN'
      | 'INVENTORYPARTNERDOMAIN'
      | 'OWNERDOMAIN'
      | 'MANAGERDOMAIN';
    const value = variableMatch[2].trim();

    return {
      variable_type: variableType,
      value,
      line_number: lineNumber,
      raw_line: line,
      is_variable: true,
      is_valid: true, // Variable entries are always considered valid
    };
  }

  return null;
}

/**
 * Validate line for invalid characters
 * @param line - The raw line from the file
 * @returns true if line contains invalid characters
 */
function hasInvalidCharacters(line: string): boolean {
  // Check for control characters (except tab, newline, and carriage return which are normal)
  // ASCII control characters: 0x00-0x1F (except 0x09 tab, 0x0A newline, 0x0D carriage return) and 0x7F
  const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

  // Check for non-printable Unicode characters, but exclude normal whitespace and line endings
  // This includes various Unicode control and format characters but excludes:
  // - 0x09 (tab), 0x0A (newline), 0x0D (carriage return)
  // - Regular space characters in the 0x2000-0x200F range
  const nonPrintableRegex =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2028-\u202F\u205F-\u206F\uFEFF]/;

  return controlCharRegex.test(line) || nonPrintableRegex.test(line);
}

/**
 * Parse and validate a line from an Ads.txt file
 * @param line - The raw line from the file
 * @param lineNumber - The line number in the file (for error reporting)
 * @returns A parsed record or variable, or null for comments and empty lines
 */
export function parseAdsTxtLine(line: string, lineNumber: number): ParsedAdsTxtEntry | null {
  // Check for invalid characters first
  if (hasInvalidCharacters(line)) {
    return createInvalidRecord(
      {
        line_number: lineNumber,
        raw_line: line,
      },
      VALIDATION_KEYS.INVALID_CHARACTERS,
      Severity.ERROR
    );
  }

  // Trim whitespace and ignore empty lines or comments
  let trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return null;
  }

  // Strip inline comments (everything after #)
  const commentIndex = trimmedLine.indexOf('#');
  if (commentIndex !== -1) {
    trimmedLine = trimmedLine.substring(0, commentIndex).trim();
    // If the line becomes empty after removing the comment, ignore it
    if (!trimmedLine) {
      return null;
    }
  }

  // Check if this is a variable definition
  const variableRecord = parseAdsTxtVariable(line, lineNumber);
  if (variableRecord) {
    return variableRecord;
  }

  // Split the line into its components
  // Format: domain, account_id, type, [certification_authority_id]
  const parts = trimmedLine.split(',').map((part) => part.trim());

  // Basic validation - must have at least domain, account ID, and type
  if (parts.length < 3) {
    return createInvalidRecord(
      {
        domain: parts[0] || '',
        account_id: parts[1] || '',
        account_type: parts[2] || '',
        line_number: lineNumber,
        raw_line: line,
      },
      VALIDATION_KEYS.MISSING_FIELDS,
      Severity.ERROR
    );
  }

  // Check for invalid format (no commas)
  if (parts.length === 1 && parts[0] === trimmedLine) {
    return createInvalidRecord(
      {
        domain: parts[0],
        line_number: lineNumber,
        raw_line: line,
      },
      VALIDATION_KEYS.INVALID_FORMAT,
      Severity.ERROR
    );
  }

  // Extract and normalize the values
  const [domain, accountId, accountType, ...rest] = parts;

  // Process relationship and certification authority ID
  const { relationship, certAuthorityId, error } = processRelationship(accountType, rest);

  if (error) {
    return createInvalidRecord(
      {
        domain,
        account_id: accountId,
        account_type: accountType,
        certification_authority_id: certAuthorityId,
        relationship,
        line_number: lineNumber,
        raw_line: line,
      },
      error,
      Severity.ERROR
    );
  }

  // Validate domain using PSL
  if (!psl.isValid(domain)) {
    return createInvalidRecord(
      {
        domain,
        account_id: accountId,
        account_type: accountType,
        certification_authority_id: certAuthorityId,
        relationship,
        line_number: lineNumber,
        raw_line: line,
      },
      VALIDATION_KEYS.INVALID_DOMAIN,
      Severity.ERROR
    );
  }

  // Validate account ID (must not be empty)
  if (!accountId) {
    return createInvalidRecord(
      {
        domain,
        account_id: accountId,
        account_type: accountType,
        certification_authority_id: certAuthorityId,
        relationship,
        line_number: lineNumber,
        raw_line: line,
      },
      VALIDATION_KEYS.EMPTY_ACCOUNT_ID,
      Severity.ERROR
    );
  }

  // Return the valid record
  return {
    domain,
    account_id: accountId,
    account_type: accountType,
    certification_authority_id: certAuthorityId,
    relationship,
    line_number: lineNumber,
    raw_line: line,
    is_valid: true,
  };
}

/**
 * Process relationship and certification authority ID from Ads.txt line parts
 */
function processRelationship(
  accountType: string,
  rest: string[]
): {
  relationship: 'DIRECT' | 'RESELLER';
  certAuthorityId?: string;
  error?: string;
} {
  const upperAccountType = accountType.toUpperCase();
  let relationship: 'DIRECT' | 'RESELLER' = 'DIRECT';
  let certAuthorityId: string | undefined;

  // Check if accountType contains the relationship
  if (upperAccountType === 'DIRECT' || upperAccountType === 'RESELLER') {
    relationship = upperAccountType as 'DIRECT' | 'RESELLER';
  } else if (
    upperAccountType !== 'DIRECT' &&
    upperAccountType !== 'RESELLER' &&
    !['DIRECT', 'RESELLER'].includes(rest[0]?.toUpperCase())
  ) {
    // Invalid relationship type
    return {
      relationship,
      error: VALIDATION_KEYS.INVALID_RELATIONSHIP,
    };
  }

  // Process remaining parts
  if (rest.length > 0) {
    // The next part could be relationship or cert authority
    const firstRest = rest[0].toUpperCase();
    if (firstRest === 'DIRECT' || firstRest === 'RESELLER') {
      relationship = firstRest as 'DIRECT' | 'RESELLER';
      if (rest.length > 1) {
        certAuthorityId = rest[1];
      }
    } else {
      certAuthorityId = rest[0];
    }
  }

  return { relationship, certAuthorityId };
}

/**
 * Parse and validate a complete Ads.txt file
 * @param content - The full content of the Ads.txt file
 * @param publisherDomain - Optional publisher domain for creating default OWNERDOMAIN if missing
 * @returns Array of parsed records and variables with validation status
 */
export function parseAdsTxtContent(content: string, publisherDomain?: string): ParsedAdsTxtEntry[] {
  // Check for empty file
  if (!content || content.trim().length === 0) {
    return [
      {
        line_number: 1,
        raw_line: '',
        is_valid: false,
        error: VALIDATION_KEYS.EMPTY_FILE,
        validation_key: VALIDATION_KEYS.EMPTY_FILE,
        severity: Severity.ERROR,
        domain: '',
        account_id: '',
        account_type: '',
        relationship: 'DIRECT' as const,
        is_variable: false,
      },
    ];
  }

  const lines = content.split('\n');
  const entries: ParsedAdsTxtEntry[] = [];

  lines.forEach((line, index) => {
    const parsedEntry = parseAdsTxtLine(line, index + 1);
    if (parsedEntry) {
      entries.push(parsedEntry);
    }
  });

  // If publisherDomain is provided, check if OWNERDOMAIN is missing and add default value
  if (publisherDomain) {
    // Check if OWNERDOMAIN already exists
    const hasOwnerDomain = entries.some(
      (entry) => isAdsTxtVariable(entry) && entry.variable_type === 'OWNERDOMAIN'
    );

    // If no OWNERDOMAIN specified, add the root domain as default value
    if (!hasOwnerDomain) {
      try {
        // Parse with psl to get the root domain (Public Suffix List + 1)
        const parsed = psl.parse(publisherDomain);
        const rootDomain = typeof parsed === 'object' && 'domain' in parsed ? parsed.domain : null;

        if (rootDomain) {
          // Create a default OWNERDOMAIN variable entry
          const defaultOwnerDomain: ParsedAdsTxtVariable = {
            variable_type: 'OWNERDOMAIN',
            value: rootDomain,
            line_number: -1, // Use -1 to indicate it's a default/generated value
            raw_line: `OWNERDOMAIN=${rootDomain}`,
            is_variable: true,
            is_valid: true,
          };

          entries.push(defaultOwnerDomain);
        }
      } catch (error) {
        // If we can't parse the domain, just skip adding the default
        console.error(`Could not parse domain for default OWNERDOMAIN: ${publisherDomain}`, error);
      }
    }
  }

  return entries;
}

/**
 * Creates a warning record with specified parameters
 */
function createWarningRecord(
  record: ParsedAdsTxtRecord,
  validationKey: string,
  params: Record<string, any> = {},
  severity: Severity = Severity.WARNING,
  additionalProps: Partial<ParsedAdsTxtRecord> = {}
): ParsedAdsTxtRecord {
  return {
    ...record,
    is_valid: true, // Keep record valid but mark with warning
    has_warning: true,
    warning: validationKey, // For backward compatibility
    validation_key: validationKey, // New field
    severity: severity, // New field
    warning_params: params,
    is_variable: false, // Explicitly mark as not a variable
    ...additionalProps,
  };
}

/**
 * Creates a duplicate warning record
 */
function createDuplicateWarningRecord(
  record: ParsedAdsTxtRecord,
  publisherDomain: string,
  validationKey: string,
  severity: Severity = Severity.WARNING
): ParsedAdsTxtRecord {
  return createWarningRecord(record, validationKey, { domain: publisherDomain }, severity, {
    duplicate_domain: publisherDomain, // Store the domain where the duplicate was found
  });
}

/**
 * Logger helper to standardize logging
 */
export type Logger = {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
};

/**
 * Create a standard logger
 */
function createLogger(): Logger {
  const isDevelopment = process.env.NODE_ENV === 'development';
  return {
    info: console.log,
    error: console.error,
    debug: isDevelopment ? console.log : () => {},
  };
}

/**
 * Interface for sellers.json seller record
 */
export interface SellersJsonSellerRecord {
  seller_id: string;
  name?: string;
  domain?: string;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
  is_confidential?: 0 | 1;
  [key: string]: any;
}

/**
 * Validation results for cross-checking ads.txt with sellers.json
 */
export interface CrossCheckValidationResult {
  // Case 11/16: Does the advertising system have a sellers.json file?
  hasSellerJson: boolean;
  // Case 12: For DIRECT entries, is the publisher account ID listed as a seller_id in the sellers.json file?
  directAccountIdInSellersJson: boolean;
  // Case 13: For DIRECT entries, does the sellers.json entry for this seller_id have matching domain?
  directDomainMatchesSellerJsonEntry: boolean | null; // null if domain is confidential or missing
  // Case 14: For DIRECT entries, is the seller_type PUBLISHER?
  directEntryHasPublisherType: boolean | null; // null if not a DIRECT entry
  // Case 15: For DIRECT entries, is the seller_id unique in the sellers.json file?
  directSellerIdIsUnique: boolean | null; // null if not a DIRECT entry
  // Case 17: For RESELLER entries, is the publisher account ID listed as a seller_id?
  resellerAccountIdInSellersJson: boolean | null; // null if not a RESELLER entry
  // Case 18: For RESELLER entries, does the sellers.json entry domain match OWNERDOMAIN or MANAGERDOMAIN?
  resellerDomainMatchesSellerJsonEntry: boolean | null; // null if domain is confidential or missing
  // Case 19: For RESELLER entries, is the seller_type INTERMEDIARY?
  resellerEntryHasIntermediaryType: boolean | null; // null if not a RESELLER entry
  // Case 20: For RESELLER entries, is the seller_id unique?
  resellerSellerIdIsUnique: boolean | null; // null if not a RESELLER entry

  // Raw seller data for reference
  sellerData?: SellersJsonSellerRecord | null;
  // Error if any occurred during validation
  error?: string;
}

/**
 * Optimized cross-check function using SellersJsonProvider
 * This is the new preferred method for performance-critical applications
 */
export async function crossCheckAdsTxtRecords(
  publisherDomain: string | undefined,
  parsedEntries: ParsedAdsTxtEntry[],
  cachedAdsTxtContent: string | null,
  sellersJsonProvider: SellersJsonProvider
): Promise<ParsedAdsTxtEntry[]>;

/**
 * Legacy cross-check function for backward compatibility
 * @deprecated Use the SellersJsonProvider version for better performance
 */
export async function crossCheckAdsTxtRecords(
  publisherDomain: string | undefined,
  parsedEntries: ParsedAdsTxtEntry[],
  cachedAdsTxtContent: string | null,
  getSellersJson: (domain: string) => Promise<any | null>
): Promise<ParsedAdsTxtEntry[]>;

/**
 * Implementation for both overloads
 */
export async function crossCheckAdsTxtRecords(
  publisherDomain: string | undefined,
  parsedEntries: ParsedAdsTxtEntry[],
  cachedAdsTxtContent: string | null,
  sellersJsonProviderOrGetSellersJson:
    | SellersJsonProvider
    | ((domain: string) => Promise<any | null>)
): Promise<ParsedAdsTxtEntry[]> {
  const logger = createLogger();

  logger.info('=== crossCheckAdsTxtRecords called with ===');
  logger.info(`publisherDomain: ${publisherDomain}`);
  logger.info(`parsedEntries: ${parsedEntries.length}`);

  // If no publisher domain provided, can't do cross-check
  if (!publisherDomain) {
    logger.info('No publisher domain provided, skipping cross-check');
    return parsedEntries;
  }

  try {
    // Separate variable entries from record entries using the type guards
    const variableEntries = parsedEntries.filter(isAdsTxtVariable);
    const recordEntries = parsedEntries.filter(isAdsTxtRecord);

    // Step 1: Check for duplicates with existing ads.txt records (only for non-variable records)
    const resultRecords = await checkForDuplicates(
      publisherDomain,
      recordEntries,
      cachedAdsTxtContent,
      logger
    );

    // Step 2: Validate against sellers.json data (only for non-variable records)
    const validatedRecords = await validateAgainstSellersJsonOptimized(
      publisherDomain,
      resultRecords,
      sellersJsonProviderOrGetSellersJson,
      logger,
      parsedEntries // Pass all entries including variables for domain validation
    );

    // Combine variable entries with validated record entries
    return [...variableEntries, ...validatedRecords];
  } catch (error) {
    // If there's any error during cross-check, log it but return entries as-is
    logger.error('Error during ads.txt cross-check:', error);
    return parsedEntries;
  }
}

/**
 * Check for duplicates in existing ads.txt records
 */
export async function checkForDuplicates(
  publisherDomain: string,
  parsedRecords: ParsedAdsTxtRecord[], // Note: This expects only record entries, not variables
  cachedAdsTxtContent: string | null,
  logger: Logger
): Promise<ParsedAdsTxtRecord[]> {
  logger.info(`Starting cross-check with publisher domain: ${publisherDomain}`);

  // Log sample of input records
  logSampleRecords(parsedRecords, logger);

  // Create result array that we'll populate with validation results
  let resultRecords = [...parsedRecords];

  // Check for duplicates if we have valid cached data
  if (cachedAdsTxtContent) {
    logger.info(`Cached content length: ${cachedAdsTxtContent.length}`);

    // Parse the cached ads.txt content
    const existingRecords = parseAdsTxtContent(cachedAdsTxtContent);

    // Log sample of existing records
    logger.info("Sample of records from publisher's ads.txt:");
    existingRecords.slice(0, 3).forEach((record, i) => {
      if (isAdsTxtRecord(record)) {
        logger.info(
          `  ${i + 1}: domain=${record.domain}, account_id=${record.account_id}, type=${record.account_type}, relationship=${record.relationship}, valid=${record.is_valid}`
        );
      } else if (isAdsTxtVariable(record)) {
        logger.info(
          `  ${i + 1}: variable_type=${record.variable_type}, value=${record.value}, valid=${record.is_valid}`
        );
      }
    });

    // Create lookup map from existing records (filter out variables)
    const recordEntries = existingRecords.filter(isAdsTxtRecord);
    const existingRecordMap = createExistingRecordsMap(recordEntries);
    logger.info(`Created lookup map with ${existingRecordMap.size} entries`);

    // Check for duplicates in input records
    resultRecords = findDuplicateRecords(parsedRecords, existingRecordMap, publisherDomain, logger);

    logger.info(
      `After duplicate check: ${resultRecords.length} records, ${resultRecords.filter((r) => r.has_warning).length} with warnings`
    );
  }

  return resultRecords;
}

/**
 * Log a sample of records for debugging
 */
function logSampleRecords(records: ParsedAdsTxtEntry[], logger: Logger) {
  records.slice(0, 5).forEach((record, i) => {
    if (isAdsTxtRecord(record)) {
      logger.info(
        `Input record ${i + 1}: domain=${record.domain}, account_id=${record.account_id}, type=${record.account_type}, relationship=${record.relationship}`
      );
    } else if (isAdsTxtVariable(record)) {
      logger.info(`Input variable ${i + 1}: type=${record.variable_type}, value=${record.value}`);
    }
  });
}

/**
 * Create a map of existing records for faster lookup
 * Note: This function only works with ParsedAdsTxtRecord entries, not variables
 */
function createExistingRecordsMap(
  existingRecords: ParsedAdsTxtRecord[]
): Map<string, ParsedAdsTxtRecord> {
  const existingRecordMap = new Map<string, ParsedAdsTxtRecord>();

  for (const record of existingRecords) {
    if (record.is_valid) {
      const domainLower = record.domain.toLowerCase().trim();
      const key = `${domainLower}|${record.account_id}|${record.relationship}`;
      existingRecordMap.set(key, record);
    }
  }

  return existingRecordMap;
}

/**
 * Create lookup key for a record
 */
function createLookupKey(record: ParsedAdsTxtRecord): string {
  // Make consistent comparison:
  // - domain: case insensitive (lowercase)
  // - account_id: case sensitive (as is)
  // - relationship: already normalized to DIRECT/RESELLER
  const lowerDomain = record.domain.toLowerCase().trim();
  return `${lowerDomain}|${record.account_id}|${record.relationship}`;
}

/**
 * Find and mark duplicate records
 */
function findDuplicateRecords(
  records: ParsedAdsTxtRecord[],
  existingRecordMap: Map<string, ParsedAdsTxtRecord>,
  publisherDomain: string,
  logger: Logger
): ParsedAdsTxtRecord[] {
  logger.info(
    `Checking ${records.length} input records for duplicates against ${existingRecordMap.size} existing records`
  );

  // Log a sample of map keys for debugging
  const mapKeySample = Array.from(existingRecordMap.keys()).slice(0, 10);
  logger.debug(`Sample of existing map keys: ${JSON.stringify(mapKeySample)}`);

  return records.map((record) => {
    if (!record.is_valid) {
      return record; // Skip invalid records
    }

    // Create lookup key for this record
    const key = createLookupKey(record);

    // Check for exact implimented
    if (existingRecordMap.has(key)) {
      logger.debug(`Found implimented for: ${key}`);
      return createDuplicateWarningRecord(
        record,
        publisherDomain,
        VALIDATION_KEYS.IMPLIMENTED,
        Severity.INFO
      );
    }

    return record;
  });
}

/**
 * Validate records against sellers.json
 */
async function validateAgainstSellersJson(
  publisherDomain: string,
  records: ParsedAdsTxtRecord[],
  getSellersJson: (domain: string) => Promise<any | null>,
  logger: Logger,
  allEntries: ParsedAdsTxtEntry[] = [] // Add allEntries parameter to pass all entries including variables
): Promise<ParsedAdsTxtRecord[]> {
  // Cache for sellers.json data and seller ID counts
  const sellersJsonCache = new Map<string, any>();
  const domainSellerIdCountsMap = new Map<string, Map<string, number>>();

  // Validate each record in parallel
  const recordsWithSellerValidation = await Promise.all(
    records.map(async (record) => {
      if (!record.is_valid) {
        return record; // Skip invalid records
      }

      try {
        return await validateSingleRecord(
          record,
          publisherDomain,
          sellersJsonCache,
          domainSellerIdCountsMap,
          getSellersJson,
          logger,
          allEntries // Pass all entries including variables
        );
      } catch (error: any) {
        logger.error(
          `Error validating against sellers.json for record (domain=${record.domain}, account_id=${record.account_id}):`,
          error
        );

        // Return the original record with error warning
        return createWarningRecord(
          record,
          VALIDATION_KEYS.SELLERS_JSON_VALIDATION_ERROR,
          {
            message: error.message,
            domain: record.domain,
          },
          Severity.WARNING,
          {
            validation_error: error.message,
          }
        );
      }
    })
  );

  logger.info(
    `After sellers.json validation: ${recordsWithSellerValidation.length} records, ${recordsWithSellerValidation.filter((r) => r.has_warning).length} with warnings`
  );

  return recordsWithSellerValidation;
}

/**
 * Optimized validation function that uses SellersJsonProvider for efficient queries
 */
async function validateAgainstSellersJsonOptimized(
  publisherDomain: string,
  records: ParsedAdsTxtRecord[],
  sellersJsonProviderOrGetSellersJson:
    | SellersJsonProvider
    | ((domain: string) => Promise<any | null>),
  logger: Logger,
  allEntries: ParsedAdsTxtEntry[] = []
): Promise<ParsedAdsTxtRecord[]> {
  // Check if we have the new optimized provider
  const isOptimizedProvider =
    typeof sellersJsonProviderOrGetSellersJson === 'object' &&
    'batchGetSellers' in sellersJsonProviderOrGetSellersJson;

  if (isOptimizedProvider) {
    const provider = sellersJsonProviderOrGetSellersJson as SellersJsonProvider;
    return await validateWithOptimizedProvider(
      publisherDomain,
      records,
      provider,
      logger,
      allEntries
    );
  } else {
    // Fall back to legacy function for backward compatibility
    const getSellersJson = sellersJsonProviderOrGetSellersJson as (
      domain: string
    ) => Promise<any | null>;
    return await validateAgainstSellersJson(
      publisherDomain,
      records,
      getSellersJson,
      logger,
      allEntries
    );
  }
}

/**
 * Validate records using the optimized SellersJsonProvider
 */
async function validateWithOptimizedProvider(
  publisherDomain: string,
  records: ParsedAdsTxtRecord[],
  provider: SellersJsonProvider,
  logger: Logger,
  allEntries: ParsedAdsTxtEntry[] = []
): Promise<ParsedAdsTxtRecord[]> {
  logger.info(`Starting optimized sellers.json validation for ${records.length} records`);

  // Group records by domain and collect required seller IDs
  const domainToSellerIds = new Map<string, string[]>();
  const domainToRecords = new Map<string, ParsedAdsTxtRecord[]>();

  records.forEach((record) => {
    if (!record.is_valid) return; // Skip invalid records

    const domain = record.domain.toLowerCase();

    // Initialize arrays if not exists
    if (!domainToSellerIds.has(domain)) {
      domainToSellerIds.set(domain, []);
      domainToRecords.set(domain, []);
    }

    // Add seller ID and record to respective maps
    domainToSellerIds.get(domain)!.push(record.account_id);
    domainToRecords.get(domain)!.push(record);
  });

  // Batch fetch sellers for all domains
  const domainSellersMap = new Map<string, Map<string, Seller>>();
  const domainMetadataMap = new Map<string, SellersJsonMetadata>();

  for (const [domain, sellerIds] of domainToSellerIds) {
    try {
      logger.info(`Fetching ${sellerIds.length} sellers for domain: ${domain}`);

      // Check if domain has sellers.json first
      const hasSellerJson = await provider.hasSellerJson(domain);
      if (!hasSellerJson) {
        logger.info(`No sellers.json found for domain: ${domain}`);
        domainSellersMap.set(domain, new Map());
        domainMetadataMap.set(domain, {});
        continue;
      }

      // Batch fetch sellers
      const batchResult = await provider.batchGetSellers(domain, sellerIds);

      // Convert to Map for efficient lookup
      const sellersMap = new Map<string, Seller>();
      batchResult.results.forEach((result) => {
        if (result.found && result.seller) {
          sellersMap.set(result.sellerId, result.seller);
        }
      });

      domainSellersMap.set(domain, sellersMap);
      domainMetadataMap.set(domain, batchResult.metadata);

      logger.info(
        `Found ${batchResult.found_count}/${batchResult.requested_count} sellers for domain: ${domain}`
      );
    } catch (error) {
      logger.error(`Error fetching sellers for domain ${domain}:`, error);
      domainSellersMap.set(domain, new Map());
      domainMetadataMap.set(domain, {});
    }
  }

  // Validate each record using the fetched data
  const validatedRecords = await Promise.all(
    records.map(async (record) => {
      if (!record.is_valid) {
        return record; // Skip invalid records
      }

      const domain = record.domain.toLowerCase();
      const sellersMap = domainSellersMap.get(domain) || new Map();
      const metadata = domainMetadataMap.get(domain) || {};

      return await validateSingleRecordOptimized(
        record,
        publisherDomain,
        sellersMap,
        metadata,
        allEntries
      );
    })
  );

  logger.info(
    `After optimized sellers.json validation: ${validatedRecords.length} records, ${validatedRecords.filter((r) => r.has_warning).length} with warnings`
  );

  return validatedRecords;
}

/**
 * Validate a single record using optimized data structures
 */
async function validateSingleRecordOptimized(
  record: ParsedAdsTxtRecord,
  publisherDomain: string,
  sellersMap: Map<string, Seller>,
  metadata: SellersJsonMetadata,
  allEntries: ParsedAdsTxtEntry[]
): Promise<ParsedAdsTxtRecord> {
  // Initialize validation result
  const validationResult = createInitialValidationResult();

  // Check if sellers.json exists for this domain
  validationResult.hasSellerJson = sellersMap.size > 0 || Object.keys(metadata).length > 0;

  if (!validationResult.hasSellerJson) {
    return createWarningRecord(
      record,
      VALIDATION_KEYS.NO_SELLERS_JSON,
      { domain: record.domain },
      Severity.WARNING,
      { validation_results: validationResult }
    );
  }

  // Find matching seller
  const normalizedAccountId = record.account_id.toString().trim();
  const matchingSeller = sellersMap.get(normalizedAccountId);
  validationResult.sellerData = matchingSeller || null;

  // Set account ID match results
  validationResult.directAccountIdInSellersJson = !!matchingSeller;

  // Create seller ID counts map from metadata for uniqueness validation
  const sellerIdCounts = new Map<string, number>();
  if (metadata.seller_count && metadata.seller_count > 0) {
    // For optimized validation, we assume each seller ID appears once
    // unless we have specific count information
    sellersMap.forEach((seller, sellerId) => {
      sellerIdCounts.set(sellerId, 1);
    });
  }

  // Run relationship-specific validations
  if (record.relationship === 'DIRECT') {
    validateDirectRelationship(
      validationResult,
      matchingSeller,
      publisherDomain,
      normalizedAccountId,
      sellerIdCounts,
      allEntries
    );
  } else if (record.relationship === 'RESELLER') {
    validateResellerRelationship(
      validationResult,
      matchingSeller,
      publisherDomain,
      normalizedAccountId,
      sellerIdCounts,
      allEntries
    );
  }

  // Generate warnings based on validation results
  const warnings = generateWarnings(record, validationResult, publisherDomain);

  // Add warnings to record if any found
  if (warnings.length > 0) {
    return {
      ...record,
      has_warning: true,
      warning: warnings[0].key, // Primary warning key (legacy)
      warning_params: warnings[0].params, // Parameters for primary warning
      validation_key: warnings[0].key, // New field
      severity: warnings[0].severity || Severity.WARNING, // New field
      all_warnings: warnings, // Store all warnings with params
      validation_results: validationResult, // Store all validation details
    };
  }

  // No warnings, but still attach the validation results
  return {
    ...record,
    validation_results: validationResult,
  };
}

// Legacy function removed and replaced with enhanced version at line ~870

/**
 * Validate a single record against sellers.json
 */
async function validateSingleRecord(
  record: ParsedAdsTxtRecord,
  publisherDomain: string,
  sellersJsonCache: Map<string, any>,
  domainSellerIdCountsMap: Map<string, Map<string, number>>,
  getSellersJson: (domain: string) => Promise<any | null>,
  logger: Logger,
  allEntries: ParsedAdsTxtEntry[] = [] // Add allEntries parameter
): Promise<ParsedAdsTxtRecord> {
  // Extract advertising system domain from the record
  const adSystemDomain = record.domain.toLowerCase();

  // Initialize validation result
  const validationResult = createInitialValidationResult();

  // Get sellers.json data
  const sellersJsonData = await getSellersJsonData(
    adSystemDomain,
    sellersJsonCache,
    getSellersJson,
    validationResult,
    logger
  );

  // If no sellers.json available, add warning and return
  if (!sellersJsonData || !Array.isArray(sellersJsonData.sellers)) {
    return createWarningRecord(
      record,
      VALIDATION_KEYS.NO_SELLERS_JSON,
      {
        domain: record.domain,
      },
      Severity.WARNING,
      {
        validation_results: validationResult,
      }
    );
  }

  // Get seller ID counts for this domain
  const sellerIdCounts = getSellerIdCounts(
    adSystemDomain,
    domainSellerIdCountsMap,
    sellersJsonData.sellers
  );

  // Normalize account ID for comparison
  const normalizedAccountId = record.account_id.toString().trim();

  // Find matching seller record
  const matchingSeller = findMatchingSeller(sellersJsonData.sellers, normalizedAccountId);
  validationResult.sellerData = matchingSeller || null;

  // For DIRECT entries, set the account ID match result
  // This will be used for Case 12 (DIRECT) - later logic will handle Case 17 (RESELLER)
  validationResult.directAccountIdInSellersJson = !!matchingSeller;

  // Run relationship-specific validations
  if (record.relationship === 'DIRECT') {
    validateDirectRelationship(
      validationResult,
      matchingSeller,
      publisherDomain,
      normalizedAccountId,
      sellerIdCounts,
      allEntries // Pass all entries including variables
    );
  } else if (record.relationship === 'RESELLER') {
    validateResellerRelationship(
      validationResult,
      matchingSeller,
      publisherDomain,
      normalizedAccountId,
      sellerIdCounts,
      allEntries // Pass all entries including variables
    );
  }

  // Generate warnings based on validation results
  const warnings = generateWarnings(record, validationResult, publisherDomain);

  // Add warnings to record if any found
  if (warnings.length > 0) {
    return {
      ...record,
      has_warning: true,
      warning: warnings[0].key, // Primary warning key (legacy)
      warning_params: warnings[0].params, // Parameters for primary warning
      validation_key: warnings[0].key, // New field
      severity: warnings[0].severity || Severity.WARNING, // New field
      all_warnings: warnings, // Store all warnings with params
      validation_results: validationResult, // Store all validation details
    };
  }

  // No warnings, but still attach the validation results
  return {
    ...record,
    validation_results: validationResult,
  };
}

/**
 * Create initial validation result object
 */
function createInitialValidationResult(): CrossCheckValidationResult {
  return {
    hasSellerJson: false,
    directAccountIdInSellersJson: false,
    directDomainMatchesSellerJsonEntry: null,
    directEntryHasPublisherType: null,
    directSellerIdIsUnique: null, // Changed from false to null to indicate unknown state
    resellerAccountIdInSellersJson: null,
    resellerDomainMatchesSellerJsonEntry: null, // Added for Case 18
    resellerEntryHasIntermediaryType: null,
    resellerSellerIdIsUnique: null,
  };
}

/**
 * Get sellers.json data for a domain
 */
async function getSellersJsonData(
  adSystemDomain: string,
  sellersJsonCache: Map<string, any>,
  getSellersJson: (domain: string) => Promise<any | null>,
  validationResult: CrossCheckValidationResult,
  logger: Logger
): Promise<any> {
  if (sellersJsonCache.has(adSystemDomain)) {
    return sellersJsonCache.get(adSystemDomain);
  }

  logger.info(`Fetching sellers.json for domain: ${adSystemDomain}`);
  const sellersJsonData = await getSellersJson(adSystemDomain);

  if (sellersJsonData) {
    validationResult.hasSellerJson = true;
  } else {
    validationResult.hasSellerJson = false;
  }

  // Cache the result
  sellersJsonCache.set(adSystemDomain, sellersJsonData);
  return sellersJsonData;
}

/**
 * Get or create seller ID counts map for a domain
 */
function getSellerIdCounts(
  adSystemDomain: string,
  domainSellerIdCountsMap: Map<string, Map<string, number>>,
  sellers: SellersJsonSellerRecord[]
): Map<string, number> {
  if (domainSellerIdCountsMap.has(adSystemDomain)) {
    return domainSellerIdCountsMap.get(adSystemDomain)!;
  }

  // Create a new counts map for this domain
  const sellerIdCounts = new Map<string, number>();

  // Count seller IDs
  sellers.forEach((seller) => {
    if (seller.seller_id) {
      const currentId = seller.seller_id.toString().trim();
      sellerIdCounts.set(currentId, (sellerIdCounts.get(currentId) || 0) + 1);
    }
  });

  // Store in domain map
  domainSellerIdCountsMap.set(adSystemDomain, sellerIdCounts);
  return sellerIdCounts;
}

/**
 * Find a matching seller record in sellers.json
 */
function findMatchingSeller(
  sellers: SellersJsonSellerRecord[],
  normalizedAccountId: string
): SellersJsonSellerRecord | undefined {
  return sellers.find(
    (seller) => seller.seller_id && seller.seller_id.toString().trim() === normalizedAccountId
  );
}

/**
 * Extract and normalize domain values from variable entries
 * @param variableEntries Array of variable entries from the ads.txt
 * @param variableType Type of variable to extract (OWNERDOMAIN or MANAGERDOMAIN)
 * @returns Array of domain values from the specified variable
 */
function extractDomainsFromVariables(
  parsedEntries: ParsedAdsTxtEntry[],
  variableType: 'OWNERDOMAIN' | 'MANAGERDOMAIN'
): string[] {
  const variableEntries = parsedEntries
    .filter(isAdsTxtVariable)
    .filter((entry) => entry.variable_type === variableType);

  return variableEntries.map((entry) => {
    // For MANAGERDOMAIN, it can be in format "domain" or "domain,CountryCode"
    if (variableType === 'MANAGERDOMAIN' && entry.value.includes(',')) {
      // Return only the domain part before comma
      return entry.value.split(',')[0].toLowerCase().trim();
    }
    return entry.value.toLowerCase().trim();
  });
}

/**
 * Validate a DIRECT relationship
 */
function validateDirectRelationship(
  validationResult: CrossCheckValidationResult,
  matchingSeller: SellersJsonSellerRecord | undefined,
  publisherDomain: string,
  normalizedAccountId: string,
  sellerIdCounts: Map<string, number>,
  parsedEntries: ParsedAdsTxtEntry[] = [] // Added parsedEntries parameter
): void {
  // Reset RESELLER-specific fields
  validationResult.resellerAccountIdInSellersJson = null;
  validationResult.resellerDomainMatchesSellerJsonEntry = null; // Reset Case 18 field
  validationResult.resellerEntryHasIntermediaryType = null;
  validationResult.resellerSellerIdIsUnique = null;

  if (matchingSeller) {
    // Case 13: For DIRECT entries, check if seller domain matches OWNERDOMAIN or MANAGERDOMAIN
    if (matchingSeller.is_confidential === 1 || !matchingSeller.domain) {
      validationResult.directDomainMatchesSellerJsonEntry = null; // Confidential or no domain
    } else {
      // Get OWNERDOMAIN and MANAGERDOMAIN values from variables
      const ownerDomains = extractDomainsFromVariables(parsedEntries, 'OWNERDOMAIN');
      const managerDomains = extractDomainsFromVariables(parsedEntries, 'MANAGERDOMAIN');

      // Normalize seller domain
      const sellerDomainLower = matchingSeller.domain.toLowerCase().trim();

      // Check if seller domain matches any OWNERDOMAIN or MANAGERDOMAIN
      const matchesOwnerDomain = ownerDomains.some((domain) => domain === sellerDomainLower);
      const matchesManagerDomain = managerDomains.some((domain) => domain === sellerDomainLower);

      validationResult.directDomainMatchesSellerJsonEntry =
        matchesOwnerDomain || matchesManagerDomain;

      // If no OWNERDOMAIN or MANAGERDOMAIN variables found, fall back to original behavior
      if (ownerDomains.length === 0 && managerDomains.length === 0) {
        // Compare publisher domain with seller domain (case insensitive)
        const publisherDomainLower = publisherDomain.toLowerCase();
        validationResult.directDomainMatchesSellerJsonEntry =
          publisherDomainLower === sellerDomainLower;
      }
    }

    // Case 14: For DIRECT entries, check if seller_type is PUBLISHER
    const sellerType = matchingSeller.seller_type?.toUpperCase() || '';
    validationResult.directEntryHasPublisherType =
      sellerType === 'PUBLISHER' || sellerType === 'BOTH';

    // Case 15: Check if seller_id is unique in the file
    if (sellerIdCounts.has(normalizedAccountId)) {
      const count = sellerIdCounts.get(normalizedAccountId)!;
      validationResult.directSellerIdIsUnique = count === 1;
      console.log(
        `Seller ID ${normalizedAccountId} appears ${count} times, unique: ${validationResult.directSellerIdIsUnique}`
      );
    } else {
      // This should not happen if we found a matching seller
      console.warn(`Seller ID ${normalizedAccountId} not found in counts map`);
      validationResult.directSellerIdIsUnique = null;
    }
  } else {
    // If no matching seller found, we can't determine uniqueness
    validationResult.directSellerIdIsUnique = null;
  }
}

/**
 * Validate a RESELLER relationship
 */
function validateResellerRelationship(
  validationResult: CrossCheckValidationResult,
  matchingSeller: SellersJsonSellerRecord | undefined,
  publisherDomain: string,
  normalizedAccountId: string,
  sellerIdCounts: Map<string, number>,
  parsedEntries: ParsedAdsTxtEntry[] = [] // Added parsedEntries parameter
): void {
  // Reset DIRECT-specific fields
  validationResult.directEntryHasPublisherType = null;
  validationResult.directDomainMatchesSellerJsonEntry = null;
  validationResult.directSellerIdIsUnique = null; // Reset Case 15 field

  // Case 17: For RESELLER entries, check if account_id is in sellers.json
  validationResult.resellerAccountIdInSellersJson = !!matchingSeller;

  // Case 18: For RESELLER entries, check if seller domain matches OWNERDOMAIN or MANAGERDOMAIN
  if (matchingSeller) {
    if (matchingSeller.is_confidential === 1 || !matchingSeller.domain) {
      validationResult.resellerDomainMatchesSellerJsonEntry = null; // Confidential or no domain
    } else {
      // Get OWNERDOMAIN and MANAGERDOMAIN values from variables
      const ownerDomains = extractDomainsFromVariables(parsedEntries, 'OWNERDOMAIN');
      const managerDomains = extractDomainsFromVariables(parsedEntries, 'MANAGERDOMAIN');

      // Normalize seller domain
      const sellerDomainLower = matchingSeller.domain.toLowerCase().trim();

      // Check if seller domain matches any OWNERDOMAIN or MANAGERDOMAIN
      const matchesOwnerDomain = ownerDomains.some((domain) => domain === sellerDomainLower);
      const matchesManagerDomain = managerDomains.some((domain) => domain === sellerDomainLower);

      validationResult.resellerDomainMatchesSellerJsonEntry =
        matchesOwnerDomain || matchesManagerDomain;

      // If no OWNERDOMAIN or MANAGERDOMAIN variables found, fall back to original behavior
      if (ownerDomains.length === 0 && managerDomains.length === 0) {
        // Compare publisher domain with seller domain (case insensitive)
        const publisherDomainLower = publisherDomain.toLowerCase();
        validationResult.resellerDomainMatchesSellerJsonEntry =
          publisherDomainLower === sellerDomainLower;
      }
    }
  }

  if (matchingSeller) {
    // Case 19: For RESELLER entries, check if seller_type is INTERMEDIARY
    const sellerType = matchingSeller.seller_type?.toUpperCase() || '';
    validationResult.resellerEntryHasIntermediaryType =
      sellerType === 'INTERMEDIARY' || sellerType === 'BOTH';

    // Case 20: Check if seller_id is unique in the file
    if (sellerIdCounts.has(normalizedAccountId)) {
      const count = sellerIdCounts.get(normalizedAccountId)!;
      validationResult.resellerSellerIdIsUnique = count === 1;
      console.log(
        `Reseller ID ${normalizedAccountId} appears ${count} times, unique: ${validationResult.resellerSellerIdIsUnique}`
      );
    } else {
      // This should not happen if we found a matching seller
      console.warn(`Reseller ID ${normalizedAccountId} not found in counts map`);
      validationResult.resellerSellerIdIsUnique = null;
    }
  } else {
    validationResult.resellerEntryHasIntermediaryType = null;
    validationResult.resellerSellerIdIsUnique = null; // Changed from false to null
  }
}

/**
 * Create a warning object with key, parameters and severity
 */
function createWarning(
  validationKey: string,
  params: Record<string, any> = {},
  severity: Severity = Severity.WARNING
) {
  return {
    key: validationKey,
    params,
    severity,
  };
}

/**
 * Generate warnings based on validation results
 */
function generateWarnings(
  record: ParsedAdsTxtRecord,
  validationResult: CrossCheckValidationResult,
  publisherDomain: string
): Array<{ key: string; params?: Record<string, any>; severity?: Severity }> {
  const warnings: Array<{ key: string; params?: Record<string, any>; severity?: Severity }> = [];

  // Case 11/16: Missing sellers.json
  if (!validationResult.hasSellerJson) {
    warnings.push(createWarning(VALIDATION_KEYS.NO_SELLERS_JSON, { domain: record.domain }));
    return warnings; // Return early if no sellers.json - don't add other warnings
  }

  // Case 12/17 Account ID not found
  if (!validationResult.directAccountIdInSellersJson) {
    if (record.relationship === 'DIRECT') {
      warnings.push(
        createWarning(VALIDATION_KEYS.DIRECT_ACCOUNT_ID_NOT_IN_SELLERS_JSON, {
          domain: record.domain,
          account_id: record.account_id,
        })
      );
    } else {
      warnings.push(
        createWarning(VALIDATION_KEYS.RESELLER_ACCOUNT_ID_NOT_IN_SELLERS_JSON, {
          domain: record.domain,
          account_id: record.account_id,
        })
      );
    }
    // Skip further checks that require a match if account ID not found
    return warnings;
  }

  // Case 13: Domain mismatch for DIRECT - now checks against OWNERDOMAIN and MANAGERDOMAIN as well
  if (
    record.relationship === 'DIRECT' &&
    validationResult.directDomainMatchesSellerJsonEntry === false
  ) {
    warnings.push(
      createWarning(VALIDATION_KEYS.DOMAIN_MISMATCH, {
        domain: record.domain,
        publisher_domain: publisherDomain,
        seller_domain: validationResult.sellerData?.domain || 'unknown',
      })
    );
  }

  // Case 18: Domain mismatch for RESELLER - checks against OWNERDOMAIN and MANAGERDOMAIN as well
  // ただし、RESELLERの場合はINTERMEDIARYまたはBOTHの場合はドメインが一致しなくても許容する
  if (
    record.relationship === 'RESELLER' &&
    validationResult.resellerDomainMatchesSellerJsonEntry === false &&
    validationResult.sellerData &&
    validationResult.sellerData.seller_type &&
    !['INTERMEDIARY', 'BOTH'].includes(validationResult.sellerData.seller_type.toUpperCase())
  ) {
    warnings.push(
      createWarning(VALIDATION_KEYS.DOMAIN_MISMATCH, {
        domain: record.domain,
        publisher_domain: publisherDomain,
        seller_domain: validationResult.sellerData?.domain || 'unknown',
      })
    );
  }

  // Case 14: DIRECT entry not marked as PUBLISHER
  if (record.relationship === 'DIRECT' && validationResult.directEntryHasPublisherType === false) {
    warnings.push(
      createWarning(VALIDATION_KEYS.DIRECT_NOT_PUBLISHER, {
        domain: record.domain,
        account_id: record.account_id,
        seller_type: validationResult.sellerData?.seller_type || 'unknown',
      })
    );
  }

  // Case 5/8: Seller ID not unique
  const hasDuplicateDirectSellerId =
    record.relationship === 'DIRECT' &&
    validationResult.directAccountIdInSellersJson &&
    validationResult.directSellerIdIsUnique === false;

  const hasDuplicateResellerSellerId =
    record.relationship === 'RESELLER' &&
    validationResult.resellerAccountIdInSellersJson &&
    validationResult.resellerSellerIdIsUnique === false;

  if (hasDuplicateDirectSellerId || hasDuplicateResellerSellerId) {
    console.log(`Adding SELLER_ID_NOT_UNIQUE warning for ${record.account_id} in ${record.domain}`);
    warnings.push(
      createWarning(VALIDATION_KEYS.SELLER_ID_NOT_UNIQUE, {
        domain: record.domain,
        account_id: record.account_id,
      })
    );
  }

  // Case 19: RESELLER entry not marked as INTERMEDIARY
  if (
    record.relationship === 'RESELLER' &&
    validationResult.directAccountIdInSellersJson &&
    validationResult.resellerEntryHasIntermediaryType === false
  ) {
    warnings.push(
      createWarning(VALIDATION_KEYS.RESELLER_NOT_INTERMEDIARY, {
        domain: record.domain,
        account_id: record.account_id,
        seller_type: validationResult.sellerData?.seller_type || 'unknown',
      })
    );
  }

  return warnings;
}

/**
 * Ads.txt Level 1 Optimization
 * Optimizes ads.txt content by:
 * 1. Removing duplicates
 * 2. Standardizing format
 * 3. Preserving comments and variables
 *
 * @param content - The original ads.txt content
 * @param publisherDomain - Optional publisher domain for OWNERDOMAIN default
 * @returns Optimized ads.txt content as a string
 */
export function optimizeAdsTxt(content: string, publisherDomain?: string): string {
  // キャパシティの大きいファイルも処理できるよう、ストリーム的に処理
  const lines = content.split('\n');

  // 重複検出のためのマップを準備
  const uniqueRecordMap = new Map<string, ParsedAdsTxtRecord>();
  const uniqueVariableMap = new Map<string, ParsedAdsTxtVariable>();
  const comments: { index: number; text: string }[] = [];
  const parsedEntries: ParsedAdsTxtEntry[] = []; // 一時的なストレージ
  let hasOwnerDomain = false;

  // ストリーム的に処理しながら重複を検出して除外
  lines.forEach((line, index) => {
    try {
      const trimmedLine = line.trim();

      // コメント行を記録
      if (trimmedLine.startsWith('#')) {
        comments.push({ index, text: line });
        return;
      }

      // 空行は無視
      if (!trimmedLine) {
        return;
      }

      // エントリを解析
      const parsedEntry = parseAdsTxtLine(line, index + 1);
      if (!parsedEntry) return; // 解析できない行は無視
      if (!parsedEntry.is_valid) return; // 無効なエントリは無視

      // 変数エントリの場合
      if (isAdsTxtVariable(parsedEntry)) {
        // OWNERDOMAINの有無を確認
        if (parsedEntry.variable_type === 'OWNERDOMAIN') {
          hasOwnerDomain = true;
        }

        // 変数の重複を検出（同じタイプと値の組み合わせ）
        const key = `${parsedEntry.variable_type}|${parsedEntry.value.toLowerCase()}`;

        // まだ見たことがない変数なら追加
        if (!uniqueVariableMap.has(key)) {
          uniqueVariableMap.set(key, parsedEntry);
          parsedEntries.push(parsedEntry);
        }
      }
      // レコードエントリの場合
      else if (isAdsTxtRecord(parsedEntry)) {
        // レコードの重複を検出（ドメイン、アカウントID、関係の組み合わせ）
        try {
          const key = `${parsedEntry.domain.toLowerCase()}|${parsedEntry.account_id}|${parsedEntry.relationship}`;

          // まだ見たことがないレコードなら追加
          if (!uniqueRecordMap.has(key)) {
            uniqueRecordMap.set(key, parsedEntry);
            parsedEntries.push(parsedEntry);
          }
        } catch (error: unknown) {
          // エラーが発生したエントリは無視して続行
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`Error processing record at line ${index + 1}: ${errorMsg}`);
        }
      }
    } catch (error: unknown) {
      // 行単位の処理中にエラーが発生しても、次の行の処理を続行
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error at line ${index + 1}: ${errorMsg}`);
    }
  });

  // パブリッシャードメインが提供されていて、OWNERDOMAINが指定されていない場合はデフォルト値を追加
  if (publisherDomain && !hasOwnerDomain) {
    try {
      const parsed = psl.parse(publisherDomain);
      const rootDomain = typeof parsed === 'object' && 'domain' in parsed ? parsed.domain : null;

      if (rootDomain) {
        // OWNERDOMAINのデフォルト値を作成
        const defaultOwnerDomain: ParsedAdsTxtVariable = {
          variable_type: 'OWNERDOMAIN',
          value: rootDomain,
          line_number: -1, // Use -1 to indicate it's a default/generated value
          raw_line: `OWNERDOMAIN=${rootDomain}`,
          is_variable: true,
          is_valid: true,
        };

        parsedEntries.push(defaultOwnerDomain);
      }
    } catch (error) {
      console.error(`Could not parse domain for default OWNERDOMAIN: ${publisherDomain}`, error);
    }
  }

  // Sort entries:
  // 1. Variables first (sorted by variable_type)
  // 2. Records after (sorted by domain)
  parsedEntries.sort((a, b) => {
    // If both are variables, sort by variable_type
    if (isAdsTxtVariable(a) && isAdsTxtVariable(b)) {
      return a.variable_type.localeCompare(b.variable_type);
    }

    // Variables come before records
    if (isAdsTxtVariable(a) && isAdsTxtRecord(b)) {
      return -1;
    }

    // Records come after variables
    if (isAdsTxtRecord(a) && isAdsTxtVariable(b)) {
      return 1;
    }

    // If both are records, sort by domain
    if (isAdsTxtRecord(a) && isAdsTxtRecord(b)) {
      return a.domain.localeCompare(b.domain);
    }

    return 0;
  });

  // Generate optimized output
  const optimizedLines: string[] = [];

  // Add initial comment if one exists
  if (comments.length > 0 && comments[0].index === 0) {
    optimizedLines.push(comments[0].text);
    comments.shift(); // Remove the first comment as it's been added
  }

  // Add empty line after header comment if there was one
  if (optimizedLines.length > 0) {
    optimizedLines.push('');
  }

  // Add variables in standardized format
  const variableEntries = parsedEntries.filter(isAdsTxtVariable);
  if (variableEntries.length > 0) {
    // Group variables by type and sort them
    const groupedVariables = new Map<string, ParsedAdsTxtVariable[]>();

    variableEntries.forEach((variable) => {
      const group = groupedVariables.get(variable.variable_type) || [];
      group.push(variable);
      groupedVariables.set(variable.variable_type, group);
    });

    // Process each variable type group
    Array.from(groupedVariables.keys())
      .sort()
      .forEach((variableType) => {
        const variables = groupedVariables.get(variableType)!;

        // Add a comment header for each variable type group
        optimizedLines.push(`# ${variableType} Variables`);

        // Add the variables in standardized format
        variables.forEach((variable) => {
          optimizedLines.push(`${variable.variable_type}=${variable.value}`);
        });

        // Add an empty line after each variable type group
        optimizedLines.push('');
      });
  }

  // Add record entries in standardized format
  const recordEntries = parsedEntries.filter(isAdsTxtRecord);

  // Always add a header for records section, even if there are no records
  optimizedLines.push('# Advertising System Records');

  if (recordEntries.length > 0) {
    // Group records by domain and sort them
    const groupedRecords = new Map<string, ParsedAdsTxtRecord[]>();

    recordEntries.forEach((record) => {
      const domainLower = record.domain.toLowerCase().trim();
      const group = groupedRecords.get(domainLower) || [];
      group.push(record);
      groupedRecords.set(domainLower, group);
    });

    // Process each domain group
    Array.from(groupedRecords.keys())
      .sort()
      .forEach((domain) => {
        const records = groupedRecords.get(domain)!;

        // Sort records within the same domain by relationship (DIRECT first)
        records.sort((a, b) => {
          if (a.relationship === 'DIRECT' && b.relationship === 'RESELLER') {
            return -1;
          }
          if (a.relationship === 'RESELLER' && b.relationship === 'DIRECT') {
            return 1;
          }
          return a.account_id.localeCompare(b.account_id);
        });

        // Add the records in standardized format
        records.forEach((record) => {
          try {
            let line = `${record.domain}, ${record.account_id}, ${record.relationship}`;
            if (record.certification_authority_id) {
              line += `, ${record.certification_authority_id}`;
            }
            // 注意: certification_authority_id の補完機能は同期関数では実装が難しいため、
            // この関数ではレコードに既に含まれている certification_authority_id のみ処理します。
            // TAG-ID の補完処理はコントローラーの generateAdsTxtContent で行われるべきです。
            optimizedLines.push(line);
          } catch (error: unknown) {
            // エラーが発生したレコードは無視して続行
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`Error formatting record: ${errorMsg}`);
          }
        });
      });
  }

  // Join all lines and return the optimized content
  return optimizedLines.join('\n');
}

/**
 * Check if an email address is valid
 * @param email - The email address to validate
 * @returns Boolean indicating if the email is valid
 */
export function isValidEmail(email: string): boolean {
  // More comprehensive email validation
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Check for invalid email patterns first
  if (
    !email ||
    email.includes('..') ||
    email.includes(' ') ||
    !email.includes('@') ||
    email.indexOf('@') === 0 ||
    email.indexOf('@') === email.length - 1 ||
    !email.includes('.', email.indexOf('@'))
  ) {
    return false;
  }

  return emailRegex.test(email);
}
