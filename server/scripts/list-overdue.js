const apiUrl = process.env.API_URL || 'http://localhost:5000/api/requests/overdue';

try {
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  const requests = await response.json();
  if (requests.length === 0) {
    console.log('No overdue requests.');
  } else {
    for (const request of requests) {
      console.log(`${request.dueDate.slice(0, 10)} | ${request.title} | ${request.clientName} | ${request.assignee}`);
    }
    console.log(`\n${requests.length} overdue request(s), sorted by due date.`);
  }
} catch (error) {
  console.error(`Could not read overdue requests: ${error.message}`);
  console.error('Start the API first with npm run dev.');
  process.exitCode = 1;
}