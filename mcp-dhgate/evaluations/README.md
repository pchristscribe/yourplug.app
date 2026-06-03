# DHgate MCP Server Evaluations

This directory contains evaluation questions to test the effectiveness of the DHgate MCP server.

## Purpose

These evaluations test whether LLMs can effectively use the MCP server's tools to answer realistic, complex questions about DHgate products. Each question requires:

- Multiple tool calls
- Data analysis and aggregation
- Complex filtering and comparison
- Real-world affiliate marketing scenarios

## Prerequisites

Before running evaluations, you must:

1. **Get TMAPI API Token**
   - Sign up at [https://tmapi.top](https://tmapi.top)
   - Subscribe to a plan (DHgate API access)
   - Get your API token from the console

2. **Configure Environment**
   ```bash
   cd mcp-dhgate
   cp .env.example .env
   # Edit .env and add your DHGATE_API_TOKEN
   ```

3. **Build the Server**
   ```bash
   pnpm build
   ```

## Running Evaluations

### Method 1: Manual Testing with Claude Desktop

1. Configure the server in Claude Desktop (see main README.md)
2. Ask Claude each question from `dhgate-eval.xml`
3. Record the answers
4. Verify answers by running the tool calls yourself

### Method 2: Automated Testing (Advanced)

If you want to create an automated evaluation harness:

```typescript
// Example evaluation runner (to be implemented)
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// 1. Start the MCP server
// 2. Connect a client
// 3. Send tool calls based on evaluation questions
// 4. Verify results match expected answers
```

## Evaluation Questions

The `dhgate-eval.xml` file contains 10 evaluation questions covering:

1. **Filtering & Sorting**: Find products matching multiple criteria
2. **Data Aggregation**: Calculate averages, medians, percentages
3. **Multi-step Workflows**: Search → Get Details → Analyze
4. **Seller Analysis**: Compare seller ratings and statistics
5. **Price Analysis**: Find price differences, ranges, distributions
6. **Review Analysis**: Count and aggregate review data

## Updating Answers

Since DHgate's product catalog changes frequently, evaluation answers need to be updated:

1. Run each question through the MCP server
2. Record the actual answer you get
3. Update the `<answer>` field in `dhgate-eval.xml`
4. Add today's date in the `<notes>` section

Example:
```xml
<qa_pair>
  <question>Search for "wireless bluetooth headphones"...</question>
  <answer>Premium Wireless Bluetooth 5.0 Headphones</answer>
  <notes>
    Verified: 2025-12-09
    Tool calls: search_products with keywords="wireless bluetooth headphones", sort="rating", free_shipping=true
  </notes>
</qa_pair>
```

## Common Issues

### Issue: API Token Invalid
**Error**: `API authentication failed`
**Solution**: Verify DHGATE_API_TOKEN in .env file is correct

### Issue: No Results
**Error**: `No products found`
**Solution**: Try different keywords or remove filters

### Issue: Rate Limit Exceeded
**Error**: `Rate limit exceeded`
**Solution**: Wait 60 seconds between evaluation runs

## Question Design Principles

Each evaluation question follows these principles:

1. **Independent**: Doesn't depend on other questions
2. **Read-only**: Only uses search and get details tools
3. **Complex**: Requires 2+ tool calls or significant data analysis
4. **Realistic**: Based on actual affiliate marketing workflows
5. **Verifiable**: Has a single, clear answer
6. **Stable**: Answer won't change dramatically over time

## Contributing New Questions

To add new evaluation questions:

1. Test the question manually with the MCP server
2. Verify it can be answered reliably
3. Document the tool calls needed
4. Add to `dhgate-eval.xml` with proper notes
5. Include verification steps in notes

## Performance Metrics

Track these metrics when running evaluations:

- **Success Rate**: % of questions answered correctly
- **Average Tool Calls**: Number of tool calls per question
- **Response Time**: Time to answer each question
- **Error Rate**: % of questions that cause errors

## Next Steps

1. **Get API Access**: Sign up for TMAPI and get your token
2. **Run Evaluations**: Test each question manually
3. **Record Answers**: Update the XML file with real answers
4. **Iterate**: If questions are too easy/hard, adjust them
5. **Monitor**: Re-run monthly to ensure continued effectiveness
