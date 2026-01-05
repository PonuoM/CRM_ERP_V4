// Debug code to paste in browser console
// This will show the current state of customers and users

console.log('=== DEBUG CUSTOMERS PAGE ===');
console.log('Active Page:', window.location.search);

// Try to access React DevTools to get component state
// Or check localStorage
const sessionUser = localStorage.getItem('sessionUser');
console.log('Session User:', sessionUser ? JSON.parse(sessionUser) : 'Not found');

// Check if we can access the App component
console.log('\n=== Instructions ===');
console.log('1. Open React DevTools');
console.log('2. Find the App component');
console.log('3. Check the following state:');
console.log('   - activePage (should be "Customers")');
console.log('   - customers (should have array of customers)');
console.log('   - users (should have array of users)');
console.log('   - currentUser (should be user object)');
console.log('\n4. If customers array is empty:');
console.log('   - Check Network tab for api/customers call');
console.log('   - Look for any failed requests');
console.log('   - Check the query parameters sent');

// Also check what page parameter is in URL
const urlParams = new URLSearchParams(window.location.search);
console.log('\nURL Parameters:');
urlParams.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
});

console.log('\n=== END DEBUG ===');
