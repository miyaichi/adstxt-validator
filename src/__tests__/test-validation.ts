import { parseAdsTxtLine } from '../index';

// Test cases for domain validation
const testCases = [
  {
    input: 'example.com, pub-123456789, DIRECT, f08c47fec0942fa0',
    description: 'Valid root domain',
  },
  {
    input: 'sub.example.com, pub-123456789, DIRECT, f08c47fec0942fa0',
    description: 'Subdomain (should fail)',
  },
  {
    input: 'www.example.com, pub-123456789, DIRECT, f08c47fec0942fa0',
    description: 'www subdomain (should fail)',
  },
  {
    input: 'ad-generation.jp, 2145, RESELLE, 7f4ea9029ac04e53',
    description: 'Misspelled relationship',
  },
  {
    input: 'example com, 2145, DIRECT, 7f4ea9029ac04e53',
    description: 'Invalid domain format with space',
  },
  {
    input: 'improvedigital.com, 1863, RESELLER # Premium video demand from Outbrain',
    description: 'Valid entry with inline comment',
  },
  {
    input: 'google.com, pub-123, DIRECT, f08c47fec0942fa0 # Google AdSense',
    description: 'Valid entry with inline comment and certification authority',
  },
  {
    input: 'example.com, 456, RESELLER #Comment only',
    description: 'Valid entry with inline comment, no certification authority',
  },
  {
    input: '# This is a full line comment',
    description: 'Full line comment (should be ignored)',
  },
  {
    input: 'domain.com, 789, DIRECT # ',
    description: 'Entry with empty inline comment',
  },
];

console.log('Testing Ads.txt validation for domain formats:');
console.log('================================================');

testCases.forEach((test, index) => {
  console.log(`\nTest ${index + 1}: ${test.description}`);
  console.log(`Input: ${test.input}`);

  const result = parseAdsTxtLine(test.input, index + 1);
  console.log('Valid:', result?.is_valid);
  if (!result?.is_valid) {
    console.log('Error:', result?.error);
  }
  console.log('------------------------------------------------');
});
