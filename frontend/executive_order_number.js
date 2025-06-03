// Federal Register API Explorer Script
// This script helps identify the correct field for Executive Order numbers

const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1';

// Function to explore a single document
async function exploreDocument(documentNumber) {
  try {
    const response = await fetch(`${FEDERAL_REGISTER_API}/documents/${documentNumber}.json`);
    const data = await response.json();
    
    console.log('\n=== Document Structure ===');
    console.log('Document Number:', documentNumber);
    console.log('\nAll available fields:');
    console.log(Object.keys(data).sort());
    
    console.log('\n=== Relevant Fields ===');
    console.log('Title:', data.title);
    console.log('Type:', data.type);
    console.log('Document Number:', data.document_number);
    console.log('Executive Order Number:', data.executive_order_number);
    console.log('Presidential Document Number:', data.presidential_document_number);
    console.log('Federal Register Number:', data.federal_register_number);
    console.log('Citation:', data.citation);
    
    console.log('\n=== Full Document Data ===');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
  } catch (error) {
    console.error('Error fetching document:', error);
  }
}

// Function to search for Executive Orders
async function searchExecutiveOrders() {
  try {
    const params = new URLSearchParams({
      conditions: {
        type: ['executive_order']
      }.conditions,
      fields: ['title', 'document_number', 'executive_order_number', 'type', 'abstract'],
      per_page: 5
    });
    
    // Alternative search method
    const searchUrl = `${FEDERAL_REGISTER_API}/documents.json?conditions[type][]=executive_order&per_page=5`;
    
    console.log('\n=== Searching for Executive Orders ===');
    console.log('URL:', searchUrl);
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    console.log('\nFound', data.count, 'executive orders');
    console.log('\nFirst few results:');
    
    data.results.forEach((doc, index) => {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log('Title:', doc.title);
      console.log('Document Number:', doc.document_number);
      console.log('Type:', doc.type);
      console.log('Executive Order Number:', doc.executive_order_number);
      console.log('All fields:', Object.keys(doc));
    });
    
    // Explore the first document in detail
    if (data.results.length > 0) {
      console.log('\n=== Detailed look at first document ===');
      await exploreDocument(data.results[0].document_number);
    }
    
  } catch (error) {
    console.error('Error searching:', error);
  }
}

// Function to test with a known EO document number
async function testKnownEO() {
  // Example: Executive Order 14028 (Improving Cybersecurity)
  // Document number format: YYYY-MM-DD-EO_NUMBER
  console.log('\n=== Testing with a known Executive Order ===');
  
  try {
    // Search for a recent executive order
    const searchUrl = `${FEDERAL_REGISTER_API}/documents.json?conditions[type][]=executive_order&conditions[publication_date][gte]=2024-01-01&per_page=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.results.length > 0) {
      const docNumber = data.results[0].document_number;
      console.log('Found recent EO with document number:', docNumber);
      await exploreDocument(docNumber);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Main execution
async function main() {
  console.log('Federal Register API Explorer');
  console.log('============================\n');
  
  // Search for executive orders
  await searchExecutiveOrders();
  
  // Test with a known EO
  await testKnownEO();
}

// Run the script
main();

// Usage in your frontend:
// Based on the findings, you would use:
// const eoNumber = document.executive_order_number || document.presidential_document_number;