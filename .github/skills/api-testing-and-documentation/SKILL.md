---
name: api-testing-and-documentation
description: 'Check all APIs are working and generate comprehensive API documentation. Use for verifying endpoint functionality and creating docs for all modules including auth, restaurants, tables, menu, orders, payments, inventory, reports, and integrations like Zomato and WhatsApp.'
argument-hint: 'Optional: specify modules to test (e.g., auth,menu) or "docs-only" to skip testing'
---

# API Testing and Documentation

## When to Use

- To verify all API endpoints are functioning correctly across all modules
- To generate or update API documentation for the entire system
- After code changes to ensure APIs still work
- Before deployment to validate system health

## Procedure

1. **Start the server** (if not running)

   ```bash
   npm run dev
   ```

2. **Run API tests**

   Choose one of the testing methods:

   - **Automated (Recommended)**: `node test-api-utility.js`
   - **Bash**: `bash test-api.sh`
   - **PowerShell**: Run individual module tests `./test-*.ps1`
   - **Postman**: Import `AuraOS-API.postman_collection.json` and run collection

3. **Review test results**

   - Check for any failed tests
   - Verify all modules: auth, restaurants, tables, menu, orders, payments, inventory, reports
   - Test integrations: Zomato, WhatsApp
   - Check Socket.io events

4. **Generate/Update Documentation**

   - Update [API-TESTING-GUIDE.md](API-TESTING-GUIDE.md) with any new endpoints
   - Update [SOCKET-IO-TESTING.md](SOCKET-IO-TESTING.md) for real-time events
   - Export Postman collection if modified
   - Consider generating OpenAPI spec from Zod schemas (future enhancement)

5. **Performance Testing** (optional)

   - Run load tests using [PERFORMANCE-TESTING.md](PERFORMANCE-TESTING.md)

## Quality Checks

- All tests pass with 100% success rate
- No 4xx/5xx errors in logs
- Socket.io events fire correctly
- Documentation matches actual API behavior
- All modules and integrations tested

## References

- [API Testing Guide](../API-TESTING-GUIDE.md)
- [Socket.io Testing](../SOCKET-IO-TESTING.md)
- [Performance Testing](../PERFORMANCE-TESTING.md)
- [Postman Collection](../AuraOS-API.postman_collection.json)