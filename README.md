# adstxt-validator

A comprehensive TypeScript library for parsing, validating, and cross-checking ads.txt files against sellers.json data. This package provides robust validation capabilities with detailed error reporting and optimization features.

## Features

- **Complete ads.txt parsing**: Parse ads.txt files and extract records and variables
- **Sellers.json cross-checking**: Validate ads.txt entries against sellers.json specifications
- **Duplicate detection**: Identify duplicate entries across ads.txt files
- **Content optimization**: Remove duplicates and standardize format
- **Comprehensive validation**: Multiple validation levels with detailed error reporting
- **Internationalized messages**: Multi-language support with configurable help URLs
- **External URL configuration**: Configure base URLs for help links when used as external library
- **TypeScript support**: Full TypeScript support with detailed type definitions

## Installation

```bash
npm install adstxt-validator
```

## Quick Start

### Basic Usage

```typescript
import { parseAdsTxtContent, crossCheckAdsTxtRecords } from 'adstxt-validator';

// Parse ads.txt content
const adsTxtContent = `
example.com, pub-1234, DIRECT
reseller.com, reseller-5678, RESELLER
CONTACT=admin@example.com
`;

const parsedEntries = parseAdsTxtContent(adsTxtContent, 'example.com');

// Legacy approach (still supported)
const getSellersJson = async (domain: string) => {
  const response = await fetch(`https://${domain}/sellers.json`);
  return response.json();
};

const validatedEntries = await crossCheckAdsTxtRecords(
  'publisher.com',
  parsedEntries,
  null, // cached ads.txt content
  getSellersJson
);
```

### Optimized Usage (Recommended)

For better performance, especially with large sellers.json files, use the new `SellersJsonProvider` interface:

```typescript
import {
  parseAdsTxtContent,
  crossCheckAdsTxtRecords,
  SellersJsonProvider,
} from 'adstxt-validator';

// Create optimized provider
const sellersJsonProvider: SellersJsonProvider = {
  async batchGetSellers(domain: string, sellerIds: string[]) {
    // Efficiently fetch only needed sellers
    const result = await fetchSellersFromDatabase(domain, sellerIds);
    return {
      domain,
      requested_count: sellerIds.length,
      found_count: result.foundCount,
      results: result.sellers,
      metadata: result.metadata,
      cache: result.cacheInfo,
    };
  },

  async hasSellerJson(domain: string) {
    return await checkSellerJsonExists(domain);
  },

  async getMetadata(domain: string) {
    return await getSellerJsonMetadata(domain);
  },

  async getCacheInfo(domain: string) {
    return await getCacheInformation(domain);
  },
};

// Use optimized validation
const validatedEntries = await crossCheckAdsTxtRecords(
  'publisher.com',
  parsedEntries,
  null,
  sellersJsonProvider
);
```

## API Reference

### Core Functions

#### `parseAdsTxtContent(content: string, publisherDomain?: string): ParsedAdsTxtEntry[]`

Parses complete ads.txt file content and returns an array of parsed entries.

**Parameters:**

- `content`: Raw ads.txt file content
- `publisherDomain`: Optional publisher domain for default OWNERDOMAIN

**Returns:** Array of `ParsedAdsTxtEntry` objects

#### `parseAdsTxtLine(line: string, lineNumber: number): ParsedAdsTxtEntry | null`

Parses a single line from an ads.txt file.

**Parameters:**

- `line`: Single line from ads.txt file
- `lineNumber`: Line number for error reporting

**Returns:** `ParsedAdsTxtEntry` object or `null` for comments/empty lines

#### `crossCheckAdsTxtRecords(publisherDomain: string, parsedEntries: ParsedAdsTxtEntry[], cachedAdsTxtContent: string | null, sellersJsonProvider: SellersJsonProvider): Promise<ParsedAdsTxtEntry[]>`

**Optimized cross-check function (recommended)** - Cross-checks parsed entries against existing ads.txt and sellers.json data using efficient selective queries.

**Parameters:**

- `publisherDomain`: Publisher's domain for validation
- `parsedEntries`: Array of parsed ads.txt entries
- `cachedAdsTxtContent`: Existing ads.txt content for duplicate detection
- `sellersJsonProvider`: Optimized provider for sellers.json data

**Returns:** Promise resolving to enhanced entries with validation results

#### `crossCheckAdsTxtRecords(publisherDomain: string, parsedEntries: ParsedAdsTxtEntry[], cachedAdsTxtContent: string | null, getSellersJson: (domain: string) => Promise<any>): Promise<ParsedAdsTxtEntry[]>`

**Legacy cross-check function** - Cross-checks parsed entries against existing ads.txt and sellers.json data.

**Parameters:**

- `publisherDomain`: Publisher's domain for validation
- `parsedEntries`: Array of parsed ads.txt entries
- `cachedAdsTxtContent`: Existing ads.txt content for duplicate detection
- `getSellersJson`: Function to fetch complete sellers.json data

**Returns:** Promise resolving to enhanced entries with validation results

**Note:** This overload is deprecated in favor of the `SellersJsonProvider` version for better performance.

#### `optimizeAdsTxt(content: string, publisherDomain?: string): string`

Optimizes ads.txt content by removing duplicates and standardizing format.

**Parameters:**

- `content`: Raw ads.txt content
- `publisherDomain`: Optional publisher domain

**Returns:** Optimized ads.txt content string

#### `isValidEmail(email: string): boolean`

Validates email addresses with comprehensive regex.

**Parameters:**

- `email`: Email address to validate

**Returns:** Boolean indicating validity

### Message System Functions

#### `configureMessages(config: MessageConfig): void`

Configures the global message provider with base URL and locale settings.

**Parameters:**

- `config`: Configuration object with optional `defaultLocale` and `baseUrl`

#### `createValidationMessage(key: string, placeholders?: string[], locale?: string): ValidationMessage | null`

Creates a localized validation message with formatted help URLs.

**Parameters:**

- `key`: Validation error key (e.g., 'domainMismatch')
- `placeholders`: Array of values to substitute in message templates
- `locale`: Target locale (defaults to configured locale)

**Returns:** `ValidationMessage` object or null if key not found

#### `setMessageProvider(provider: MessageProvider): void`

Sets a custom message provider for advanced usage.

**Parameters:**

- `provider`: Custom message provider implementation

#### `getMessageProvider(): MessageProvider`

Gets the current message provider.

**Returns:** Current `MessageProvider` instance

### Type Definitions

#### `SellersJsonProvider`

Interface for optimized sellers.json data access:

```typescript
interface SellersJsonProvider {
  batchGetSellers(domain: string, sellerIds: string[]): Promise<BatchSellersResult>;
  getMetadata(domain: string): Promise<SellersJsonMetadata>;
  hasSellerJson(domain: string): Promise<boolean>;
  getCacheInfo(domain: string): Promise<CacheInfo>;
}
```

#### `BatchSellersResult`

Result structure for batch seller queries:

```typescript
interface BatchSellersResult {
  domain: string;
  requested_count: number;
  found_count: number;
  results: SellerResult[];
  metadata: SellersJsonMetadata;
  cache: CacheInfo;
}
```

#### `SellerResult`

Individual seller query result:

```typescript
interface SellerResult {
  sellerId: string;
  seller: Seller | null;
  found: boolean;
  source: 'cache' | 'fresh';
  error?: string;
}
```

#### `Seller`

Seller information from sellers.json:

```typescript
interface Seller {
  seller_id: string;
  name?: string;
  domain?: string;
  seller_type?: 'PUBLISHER' | 'INTERMEDIARY' | 'BOTH';
  is_confidential?: 0 | 1;
  [key: string]: any;
}
```

#### `SellersJsonMetadata`

Metadata from sellers.json file:

```typescript
interface SellersJsonMetadata {
  version?: string;
  contact_email?: string;
  contact_address?: string;
  seller_count?: number;
  identifiers?: any[];
}
```

#### `CacheInfo`

Cache information:

```typescript
interface CacheInfo {
  is_cached: boolean;
  last_updated?: string;
  status: 'success' | 'error' | 'stale';
  expires_at?: string;
}
```

#### `ParsedAdsTxtEntry`

Union type for ads.txt entries:

```typescript
type ParsedAdsTxtEntry = ParsedAdsTxtRecord | ParsedAdsTxtVariable;
```

#### `ParsedAdsTxtRecord`

Interface for ads.txt records:

```typescript
interface ParsedAdsTxtRecord {
  line_number: number;
  raw_line: string;
  is_valid: boolean;
  domain: string;
  account_id: string;
  account_type: string;
  certification_authority_id?: string;
  relationship: 'DIRECT' | 'RESELLER';
  error?: string;
  has_warning?: boolean;
  warning?: string;
  validation_key?: string;
  severity?: Severity;
  duplicate_domain?: string;
  validation_results?: CrossCheckValidationResult;
}
```

#### `ParsedAdsTxtVariable`

Interface for ads.txt variables:

```typescript
interface ParsedAdsTxtVariable {
  line_number: number;
  raw_line: string;
  is_valid: boolean;
  variable_type:
    | 'CONTACT'
    | 'SUBDOMAIN'
    | 'INVENTORYPARTNERDOMAIN'
    | 'OWNERDOMAIN'
    | 'MANAGERDOMAIN';
  value: string;
  is_variable: true;
  error?: string;
  has_warning?: boolean;
  warning?: string;
}
```

#### `CrossCheckValidationResult`

Detailed validation results from sellers.json cross-checking:

```typescript
interface CrossCheckValidationResult {
  hasSellerJson: boolean;
  directAccountIdInSellersJson: boolean;
  directDomainMatchesSellerJsonEntry: boolean | null;
  directEntryHasPublisherType: boolean | null;
  directSellerIdIsUnique: boolean | null;
  resellerAccountIdInSellersJson: boolean | null;
  resellerDomainMatchesSellerJsonEntry: boolean | null;
  resellerEntryHasIntermediaryType: boolean | null;
  resellerSellerIdIsUnique: boolean | null;
  sellerData?: SellersJsonSellerRecord | null;
  error?: string;
}
```

#### `Severity`

Validation severity levels:

```typescript
enum Severity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}
```

#### `MessageConfig`

Configuration interface for message system:

```typescript
interface MessageConfig {
  defaultLocale?: 'ja' | 'en';
  baseUrl?: string;
}
```

#### `ValidationMessage`

Complete validation message with localized content:

```typescript
interface ValidationMessage {
  key: string;
  severity: Severity;
  message: string;
  description?: string;
  helpUrl?: string;
  placeholders: string[];
}
```

### Type Guards

#### `isAdsTxtRecord(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtRecord`

Checks if an entry is an ads.txt record.

#### `isAdsTxtVariable(entry: ParsedAdsTxtEntry): entry is ParsedAdsTxtVariable`

Checks if an entry is an ads.txt variable.

## Validation Features

### Basic Validation

- **Format validation**: Ensures proper comma-separated format
- **Required fields**: Validates presence of domain, account_id, account_type
- **Domain validation**: Uses PSL (Public Suffix List) for domain validation
- **Relationship validation**: Ensures valid DIRECT/RESELLER relationships
- **Account ID validation**: Checks for non-empty account IDs

### Advanced Validation (Sellers.json Cross-checking)

The package implements comprehensive sellers.json validation based on IAB standards:

- **Case 11/16**: Checks if advertising system has sellers.json file
- **Case 12**: For DIRECT entries, validates account ID exists in sellers.json
- **Case 13**: For DIRECT entries, validates domain matching against OWNERDOMAIN/MANAGERDOMAIN
- **Case 14**: For DIRECT entries, validates seller_type is PUBLISHER
- **Case 15**: For DIRECT entries, validates seller_id uniqueness
- **Case 17**: For RESELLER entries, validates account ID exists in sellers.json
- **Case 18**: For RESELLER entries, validates domain matching
- **Case 19**: For RESELLER entries, validates seller_type is INTERMEDIARY
- **Case 20**: For RESELLER entries, validates seller_id uniqueness

### Duplicate Detection

- Detects duplicate entries between submitted and existing ads.txt files
- Uses normalized comparison (case-insensitive domains, exact account IDs)
- Marks duplicates with INFO severity warnings

## Performance Optimization

### SellersJsonProvider vs Legacy Approach

The new `SellersJsonProvider` interface offers significant performance improvements over the legacy approach:

| Aspect               | Legacy Approach                    | SellersJsonProvider                |
| -------------------- | ---------------------------------- | ---------------------------------- |
| **Memory Usage**     | Loads entire sellers.json (100MB+) | Loads only needed sellers (few KB) |
| **Network Transfer** | Downloads complete files           | Selective database queries         |
| **Processing Time**  | O(n) linear search                 | O(log n) indexed lookups           |
| **Scalability**      | Poor for large files               | Excellent for any size             |

### Performance Metrics

For a typical sellers.json file with 10,000 sellers:

- **Memory reduction**: 99%+ (100MB → 5KB)
- **Query speed**: 50-100x faster
- **Network bandwidth**: 95%+ reduction

### When to Use Each Approach

**Use SellersJsonProvider when:**

- Working with large sellers.json files (>1MB)
- Performance is critical
- Database/cache infrastructure is available
- Processing multiple ads.txt files

**Use Legacy approach when:**

- Simple one-off validations
- No database infrastructure
- Working with small sellers.json files
- Backward compatibility is required

## Error Handling

The package uses comprehensive error keys for different validation scenarios:

- `MISSING_FIELDS`: Missing required fields
- `INVALID_FORMAT`: Invalid line format
- `INVALID_RELATIONSHIP`: Invalid relationship type
- `INVALID_DOMAIN`: Invalid domain format
- `EMPTY_ACCOUNT_ID`: Empty account ID
- `IMPLIMENTED`: Duplicate entry detected
- `NO_SELLERS_JSON`: Missing sellers.json file
- `DIRECT_ACCOUNT_ID_NOT_IN_SELLERS_JSON`: Direct account not in sellers.json
- `RESELLER_ACCOUNT_ID_NOT_IN_SELLERS_JSON`: Reseller account not in sellers.json
- `DOMAIN_MISMATCH`: Domain mismatch with sellers.json
- `DIRECT_NOT_PUBLISHER`: Direct entry not marked as publisher
- `SELLER_ID_NOT_UNIQUE`: Seller ID appears multiple times
- `RESELLER_NOT_INTERMEDIARY`: Reseller not marked as intermediary

## Examples

### Basic Parsing

```typescript
import { parseAdsTxtContent } from 'adstxt-validator';

const adsTxtContent = `
# Ads.txt file
example.com, pub-1234, DIRECT, f08c47fec0942fa0
reseller.com, reseller-5678, RESELLER
CONTACT=admin@example.com
OWNERDOMAIN=example.com
`;

const parsedEntries = parseAdsTxtContent(adsTxtContent, 'example.com');

// Filter only valid records
const validRecords = parsedEntries.filter((entry) => entry.is_valid).filter(isAdsTxtRecord);

console.log(`Found ${validRecords.length} valid records`);
```

### Cross-checking with Sellers.json

```typescript
import { crossCheckAdsTxtRecords, parseAdsTxtContent } from 'adstxt-validator';

const getSellersJson = async (domain: string) => {
  try {
    const response = await fetch(`https://${domain}/sellers.json`);
    return await response.json();
  } catch (error) {
    return null; // Handle fetch errors
  }
};

const parsedEntries = parseAdsTxtContent(adsTxtContent, 'publisher.com');

const validatedEntries = await crossCheckAdsTxtRecords(
  'publisher.com',
  parsedEntries,
  existingAdsTxtContent,
  getSellersJson
);

// Check validation results
validatedEntries.forEach((entry) => {
  if (entry.has_warning) {
    console.warn(`Warning for ${entry.raw_line}: ${entry.warning}`);
  }
  if (entry.validation_results) {
    console.log('Validation details:', entry.validation_results);
  }
});
```

### Configuring Help URLs for External Applications

When using this package as an external library, you can configure the base URL for help links:

```typescript
import { configureMessages, createValidationMessage } from 'adstxt-validator';

// Configure the message system with your application's base URL
configureMessages({
  defaultLocale: 'ja', // or 'en'
  baseUrl: 'https://your-app.com',
});

// Now validation messages will have complete URLs
const message = createValidationMessage('domainMismatch', ['example.com', 'google.com']);
console.log(message.helpUrl);
// Output: https://your-app.com/help/#domain-mismatch

// For deployment environments, use environment variables
if (process.env.APP_URL) {
  configureMessages({
    defaultLocale: 'ja',
    baseUrl: process.env.APP_URL,
  });
}
```

#### Help URL Generation

The package automatically generates help URLs based on validation keys using the following format:

```
{baseUrl}/help/#{validation-key}
```

**Validation Key to URL Fragment Mapping:**

| Validation Key | URL Fragment | Description |
|----------------|--------------|-------------|
| `missingFields` | `missing-fields` | Missing required fields error |
| `invalidFormat` | `invalid-format` | Invalid line format error |
| `invalidRelationship` | `invalid-relationship` | Invalid relationship type |
| `invalidDomain` | `invalid-domain` | Invalid domain format |
| `emptyAccountId` | `empty-account-id` | Empty account ID error |
| `noValidEntries` | `no-valid-entries` | No valid entries found |
| `whitespaceInFields` | `whitespace-in-fields` | Whitespace in fields error |
| `implimented` | `implimented-entry` | Duplicate entry warning |
| `noSellersJson` | `no-sellers-json` | Missing sellers.json file |
| `directAccountIdNotInSellersJson` | `direct-account-id-not-in-sellers-json` | Direct account not in sellers.json |
| `resellerAccountIdNotInSellersJson` | `reseller-account-id-not-in-sellers-json` | Reseller account not in sellers.json |
| `domainMismatch` | `domain-mismatch` | Domain mismatch with sellers.json |
| `directNotPublisher` | `direct-not-publisher` | Direct entry not marked as publisher |
| `sellerIdNotUnique` | `seller-id-not-unique` | Seller ID not unique |
| `resellerNotIntermediary` | `reseller-not-intermediary` | Reseller not marked as intermediary |

#### Implementing Help Pages

To implement help pages in your application, create a help page that supports URL fragments:

```typescript
// Example React component for help page
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const HelpPage: React.FC = () => {
  const location = useLocation();
  
  useEffect(() => {
    // Highlight section based on URL fragment
    const fragment = location.hash.replace('#', '');
    if (fragment) {
      const element = document.getElementById(fragment);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        // Add highlight effect
        element.classList.add('highlight-section');
        setTimeout(() => {
          element.classList.remove('highlight-section');
        }, 5000);
      }
    }
  }, [location.hash]);

  return (
    <div>
      <h1>Ads.txt Validation Help</h1>
      
      <section id="domain-mismatch">
        <h2>Domain Mismatch</h2>
        <p>This error occurs when the domain in sellers.json doesn't match...</p>
      </section>
      
      <section id="missing-fields">
        <h2>Missing Fields</h2>
        <p>Ads.txt entries require at least three fields...</p>
      </section>
      
      {/* Add more sections for each validation key */}
    </div>
  );
};
```

#### Static Help Page Example

For static HTML applications, you can implement fragment-based navigation:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Ads.txt Validation Help</title>
    <style>
        .highlight-section {
            background-color: rgba(255, 193, 7, 0.3);
            border-radius: 4px;
            padding: 8px;
            margin: -8px;
            transition: all 0.3s ease-in-out;
            animation: highlight-fade 5s ease-out forwards;
        }
        
        @keyframes highlight-fade {
            0% { background-color: rgba(255, 193, 7, 0.4); }
            100% { background-color: transparent; }
        }
    </style>
</head>
<body>
    <h1>Ads.txt Validation Help</h1>
    
    <section>
        <a id="domain-mismatch"></a>
        <h2>Domain Mismatch</h2>
        <p>This error occurs when...</p>
    </section>
    
    <script>
        // Handle fragment highlighting
        function highlightSection() {
            const fragment = window.location.hash.replace('#', '');
            if (fragment) {
                const element = document.getElementById(fragment);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                    
                    // If it's an empty anchor, highlight the next heading
                    let elementToHighlight = element;
                    if (element.tagName === 'A' && !element.textContent.trim()) {
                        const nextHeading = element.nextElementSibling;
                        if (nextHeading && nextHeading.tagName.match(/^H[1-6]$/)) {
                            elementToHighlight = nextHeading;
                        }
                    }
                    
                    elementToHighlight.classList.add('highlight-section');
                    setTimeout(() => {
                        elementToHighlight.classList.remove('highlight-section');
                    }, 5000);
                }
            }
        }
        
        // Highlight on page load and hash change
        window.addEventListener('load', highlightSection);
        window.addEventListener('hashchange', highlightSection);
    </script>
</body>
</html>
```

### Content Optimization

```typescript
import { optimizeAdsTxt } from 'adstxt-validator';

const messyAdsTxtContent = `
# Ads.txt file
example.com, pub-1234, DIRECT
example.com, pub-1234, DIRECT
CONTACT=admin@example.com
reseller.com, reseller-5678, RESELLER
CONTACT=admin@example.com
`;

const optimizedContent = optimizeAdsTxt(messyAdsTxtContent, 'publisher.com');
console.log(optimizedContent);
// Output will have duplicates removed and content organized
```

### Error Handling

```typescript
import { parseAdsTxtContent, isAdsTxtRecord } from 'adstxt-validator';

const parsedEntries = parseAdsTxtContent(adsTxtContent);

parsedEntries.forEach((entry) => {
  if (!entry.is_valid) {
    console.error(`Line ${entry.line_number}: ${entry.error}`);
  }

  if (entry.has_warning) {
    console.warn(`Line ${entry.line_number}: ${entry.warning}`);
  }

  if (isAdsTxtRecord(entry) && entry.validation_results) {
    if (!entry.validation_results.hasSellerJson) {
      console.warn(`No sellers.json found for ${entry.domain}`);
    }
  }
});
```

## Dependencies

- `psl`: Public Suffix List for domain validation

## Development

```bash
# Build the package
npm run build

# Run tests
npm test
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass and follow the existing code style.
