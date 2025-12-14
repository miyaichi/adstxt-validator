import { crossCheckAdsTxtRecords, parseAdsTxtLine, isAdsTxtRecord } from '../index';

// Test function to validate a fixed record
async function testFixedValidation() {
  // Create a test record
  const record1 = parseAdsTxtLine('openx.com,540838151,RESELLER,6a698e2ec38604c6', 1);

  console.log('Testing with publisher domain: nikkei.com');
  console.log('Testing record:', record1);

  if (record1) {
    // Perform validation
    const validatedRecords = await crossCheckAdsTxtRecords('nikkei.com', [record1]);

    // Display the validation results
    console.log('\n=== Validation Results ===');
    console.log(`Has warning: ${validatedRecords[0].has_warning}`);
    console.log(`Warning: ${validatedRecords[0].warning}`);

    // Check if this is a record (not a variable) and has validation results
    if (isAdsTxtRecord(validatedRecords[0]) && validatedRecords[0].validation_results) {
      console.log('\nDetailed validation results:');
      console.log(`- hasSellerJson: ${validatedRecords[0].validation_results.hasSellerJson}`);
      console.log(
        `- directAccountIdInSellersJson: ${validatedRecords[0].validation_results.directAccountIdInSellersJson}`
      );
      console.log(
        `- resellerAccountIdInSellersJson: ${validatedRecords[0].validation_results.resellerAccountIdInSellersJson}`
      );
      console.log(
        `- resellerEntryHasIntermediaryType: ${validatedRecords[0].validation_results.resellerEntryHasIntermediaryType}`
      );
      console.log(
        `- resellerSellerIdIsUnique: ${validatedRecords[0].validation_results.resellerSellerIdIsUnique}`
      );
    }

    // Display warning list if available
    if (validatedRecords[0].all_warnings) {
      console.log('\nAll warnings:');
      validatedRecords[0].all_warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning.key}`);
        if (warning.params) {
          console.log(`   Parameters: ${JSON.stringify(warning.params)}`);
        }
      });
    }
  }
}

// Execute the test
testFixedValidation().catch(console.error);
