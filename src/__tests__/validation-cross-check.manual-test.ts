/**
 * Manual test for crossCheckAdsTxtRecords
 *
 * This is not a Jest test file, but a simple script to manually test the
 * crossCheckAdsTxtRecords function in a controlled environment.
 *
 * Usage:
 * 1. Build the project: npm run build
 * 2. Run this file: node dist/utils/validation-cross-check.manual-test.js
 */

// Import the module after building the project
import { crossCheckAdsTxtRecords, parseAdsTxtContent } from '../index';

// Format validation results for cleaner output
function formatValidationResult(record: any) {
  return {
    domain: record.domain,
    account_id: record.account_id,
    relationship: record.relationship,
    warning: record.warning,
    warning_params: record.warning_params,
    validation_results: record.validation_results
      ? {
          hasSellerJson: record.validation_results.hasSellerJson,
          accountIdInSellersJson: record.validation_results.accountIdInSellersJson,
          domainMatchesSellerJsonEntry: record.validation_results.domainMatchesSellerJsonEntry,
          directEntryHasPublisherType: record.validation_results.directEntryHasPublisherType,
          sellerIdIsUnique: record.validation_results.sellerIdIsUnique,
          resellerAccountIdInSellersJson: record.validation_results.resellerAccountIdInSellersJson,
          resellerEntryHasIntermediaryType:
            record.validation_results.resellerEntryHasIntermediaryType,
          resellerSellerIdIsUnique: record.validation_results.resellerSellerIdIsUnique,
          ...(record.validation_results.sellerData
            ? {
                sellerData: {
                  seller_id: record.validation_results.sellerData.seller_id,
                  name: record.validation_results.sellerData.name,
                  domain: record.validation_results.sellerData.domain,
                  seller_type: record.validation_results.sellerData.seller_type,
                },
              }
            : {}),
        }
      : null,
  };
}

// Manual tests for each case
async function runTests() {
  // Using asahi.com as a publisher domain for testing
  const publisherDomain = 'asahi.com';

  // -----------------------------------------------
  // Case 11: Does the advertising system have a sellers.json file?
  // -----------------------------------------------
  console.log('\n=== Case 1: Testing for existence of sellers.json ===');

  // Test with a domain that should have sellers.json
  const case1TestData1 = `openx.com, 541058490, DIRECT`;
  const case1Records1 = parseAdsTxtContent(case1TestData1);
  const case1Result1 = await crossCheckAdsTxtRecords(publisherDomain, case1Records1);

  console.log('1a. Domain with sellers.json (openx.com):');
  console.log(formatValidationResult(case1Result1[0]));

  // Test with a domain that likely doesn't have sellers.json
  const case1TestData2 = `nonexistent-domain.com, 12345, DIRECT`;
  const case1Records2 = parseAdsTxtContent(case1TestData2);
  const case1Result2 = await crossCheckAdsTxtRecords(publisherDomain, case1Records2);

  console.log('\n1b. Domain without sellers.json:');
  console.log(formatValidationResult(case1Result2[0]));

  // -----------------------------------------------
  // Case 12: For DIRECT entries - Does the sellers.json have the publisher account ID?
  // -----------------------------------------------
  console.log('\n=== Case 12: Testing DIRECT entry publisher account ID in sellers.json ===');

  // Test with a DIRECT entry that should be in sellers.json
  const case2TestData1 = `openx.com, 541058490, DIRECT`;
  const case2Records1 = parseAdsTxtContent(case2TestData1);
  const case2Result1 = await crossCheckAdsTxtRecords(publisherDomain, case2Records1);

  console.log('2a. DIRECT entry with ID in sellers.json:');
  console.log(formatValidationResult(case2Result1[0]));

  // Test with a DIRECT entry that shouldn't be in sellers.json
  const case2TestData2 = `openx.com, 999999999, DIRECT`;
  const case2Records2 = parseAdsTxtContent(case2TestData2);
  const case2Result2 = await crossCheckAdsTxtRecords(publisherDomain, case2Records2);

  console.log('\n2b. DIRECT entry with ID not in sellers.json:');
  console.log(formatValidationResult(case2Result2[0]));

  // -----------------------------------------------
  // Case 13: For DIRECT entries - Does the sellers.json entry domain match?
  // -----------------------------------------------
  console.log('\n=== Case 13: Testing DIRECT entry domain match in sellers.json ===');

  // Test with a DIRECT entry that has mismatched domain
  const case3TestData = `openx.com, 541058490, DIRECT`; // seller_id 541058490 has domain corp.fluct.jp
  const case3Records = parseAdsTxtContent(case3TestData);
  const case3Result = await crossCheckAdsTxtRecords(publisherDomain, case3Records);

  console.log('3. DIRECT entry with domain mismatch:');
  console.log(formatValidationResult(case3Result[0]));

  // -----------------------------------------------
  // Case 14: For DIRECT entries - Is seller_type PUBLISHER?
  // -----------------------------------------------
  console.log('\n=== Case 14: Testing DIRECT entry with correct seller_type ===');

  // Test with DIRECT entry where seller_type is INTERMEDIARY (should be PUBLISHER)
  const case4TestData = `openx.com, 541058490, DIRECT`; // seller_id 541058490 has type INTERMEDIARY
  const case4Records = parseAdsTxtContent(case4TestData);
  const case4Result = await crossCheckAdsTxtRecords(publisherDomain, case4Records);

  console.log('4. DIRECT entry with incorrect seller_type:');
  console.log(formatValidationResult(case4Result[0]));

  // -----------------------------------------------
  // Case 15: For DIRECT entries - Is the seller_id unique?
  // -----------------------------------------------
  console.log('\n=== Case 15: Testing DIRECT entry seller_id uniqueness ===');

  // Test with DIRECT entry where seller_id should be unique
  const case5TestData1 = `openx.com, 541058490, DIRECT`; // Known to be unique
  const case5Records1 = parseAdsTxtContent(case5TestData1);
  const case5Result1 = await crossCheckAdsTxtRecords(publisherDomain, case5Records1);

  console.log('5. DIRECT entry with unique seller_id:');
  console.log(formatValidationResult(case5Result1[0]));

  // Note: To properly test non-unique seller_id, we would need to know a seller_id
  // that appears multiple times in a sellers.json file

  // -----------------------------------------------
  // Case 17: For RESELLER entries - Does the sellers.json have the publisher account ID?
  // -----------------------------------------------
  console.log('\n=== Case 17: Testing RESELLER entry publisher account ID in sellers.json ===');

  // Test with a RESELLER entry that should be in sellers.json
  const case6TestData1 = `openx.com, 541058490, RESELLER`;
  const case6Records1 = parseAdsTxtContent(case6TestData1);
  const case6Result1 = await crossCheckAdsTxtRecords(publisherDomain, case6Records1);

  console.log('6a. RESELLER entry with ID in sellers.json:');
  console.log(formatValidationResult(case6Result1[0]));

  // Test with a RESELLER entry that shouldn't be in sellers.json
  const case6TestData2 = `openx.com, 999999999, RESELLER`;
  const case6Records2 = parseAdsTxtContent(case6TestData2);
  const case6Result2 = await crossCheckAdsTxtRecords(publisherDomain, case6Records2);

  console.log('\n6b. RESELLER entry with ID not in sellers.json:');
  console.log(formatValidationResult(case6Result2[0]));

  // -----------------------------------------------
  // Case 19: For RESELLER entries - Is seller_type INTERMEDIARY?
  // -----------------------------------------------
  console.log('\n=== Case 19: Testing RESELLER entry with correct seller_type ===');

  // Test with RESELLER entry where seller_type is INTERMEDIARY (correct)
  const case7TestData1 = `openx.com, 541058490, RESELLER`; // seller_id 541058490 has type INTERMEDIARY
  const case7Records1 = parseAdsTxtContent(case7TestData1);
  const case7Result1 = await crossCheckAdsTxtRecords(publisherDomain, case7Records1);

  console.log('7a. RESELLER entry with correct seller_type (INTERMEDIARY):');
  console.log(formatValidationResult(case7Result1[0]));

  // Test with RESELLER entry where seller_type is PUBLISHER (should be INTERMEDIARY)
  const case7TestData2 = `openx.com, 544015448, RESELLER`; // seller_id 544015448 has type PUBLISHER
  const case7Records2 = parseAdsTxtContent(case7TestData2);
  const case7Result2 = await crossCheckAdsTxtRecords(publisherDomain, case7Records2);

  console.log('\n7b. RESELLER entry with incorrect seller_type:');
  console.log(formatValidationResult(case7Result2[0]));

  // -----------------------------------------------
  // Case 20: For RESELLER entries - Is the seller_id unique?
  // -----------------------------------------------
  console.log('\n=== Case 20: Testing RESELLER entry seller_id uniqueness ===');

  // Test with RESELLER entry where seller_id should be unique
  const case8TestData1 = `openx.com, 541058490, RESELLER`; // Known to be unique
  const case8Records1 = parseAdsTxtContent(case8TestData1);
  const case8Result1 = await crossCheckAdsTxtRecords(publisherDomain, case8Records1);

  console.log('8. RESELLER entry with unique seller_id:');
  console.log(formatValidationResult(case8Result1[0]));

  // Note: To properly test non-unique seller_id, we would need to know a seller_id
  // that appears multiple times in a sellers.json file
}

// Run the tests
runTests().catch((err) => {
  console.error('Error running tests:', err);
});
