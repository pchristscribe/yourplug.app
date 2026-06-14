# DHgate MCP Server - Quick Start Guide

Get your DHgate MCP server running in 5 minutes!

## Step 1: Get Your API Token (5 minutes)

1. Visit [TMAPI.top](https://tmapi.top)
2. Sign up for an account
3. Subscribe to a plan with DHgate API access
4. Go to Console → Account Center
5. Copy your API token

**Pricing**: Check [TMAPI pricing](https://tmapi.top/pricing) for current rates

## Step 2: Configure the Server

```bash
cd mcp-dhgate

# Copy environment template
cp .env.example .env

# Edit .env and add your token
# DHGATE_API_TOKEN=your_token_here
```

## Step 3: Test the Build

```bash
# The server is already built! Verify it:
ls dist/index.js

# If you need to rebuild:
pnpm build
```

## Step 4: Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dhgate": {
      "command": "node",
      "args": [
        "/Users/pscribbler/ProjectXY/mcp-dhgate/dist/index.js"
      ],
      "env": {
        "DHGATE_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Important**: Use the **full absolute path** to index.js!

## Step 5: Restart Claude Desktop

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. Look for the 🔌 icon indicating MCP servers are connected

## Step 6: Test the Server

Try these commands in Claude Desktop:

### Test 1: Basic Search
```
Search DHgate for "wireless headphones" sorted by rating
```

Expected: List of wireless headphones with ratings and prices

### Test 2: With Filters
```
Find "smart watch" products with free shipping and high ratings
```

Expected: Filtered list of highly-rated smart watches with free shipping

### Test 3: Generate Affiliate Link
```
Generate an affiliate link for this DHgate product:
https://www.dhgate.com/product/example/123456.html
```

Expected: Tracked affiliate URL with FTC compliance reminder

## Troubleshooting

### ❌ Server Not Appearing in Claude

**Check**:
1. Is the path in `claude_desktop_config.json` absolute?
2. Does `dist/index.js` exist?
3. Did you restart Claude Desktop?

**Fix**:
```bash
# Verify file exists
ls /Users/pscribbler/ProjectXY/mcp-dhgate/dist/index.js

# Check for typos in JSON config
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### ❌ Authentication Failed

**Error**: `API authentication failed`

**Fix**:
1. Verify token in .env file
2. Verify token in claude_desktop_config.json
3. Check token is valid at TMAPI console
4. Ensure no extra spaces in token

### ❌ No Products Found

**Error**: `No products found`

**Fix**:
- Try different keywords
- Remove filters (free_shipping, high_rating)
- Check DHgate actually has those products

### ❌ Rate Limit Exceeded

**Error**: `Rate limit exceeded`

**Fix**: Wait 60 seconds. The server allows 60 requests/minute.

## Next Steps

### 1. Join DHgate Affiliate Program

To generate working affiliate links:

1. Visit [DHgate Affiliate Program](https://affiliate.dhgate.com/)
2. Sign up and get your affiliate ID
3. Add to .env: `DHGATE_AFFILIATE_ID=your_id_here`

### 2. Test with Your yourplug Use Case

Try realistic queries:
- "Find trending men's fashion accessories under $30"
- "Search for high-rated electronics with free shipping"
- "Compare wireless earbuds by price and rating"

### 3. Run Evaluations

```bash
cd evaluations
cat README.md  # Read evaluation guide
```

### 4. Integrate with Your Frontend

The MCP server can be used by any MCP client. To integrate with your Nuxt frontend:

1. Use the server's tools through Claude Code
2. Copy product data into your frontend
3. Use `generate_affiliate_link` for all product URLs
4. Add FTC disclosures to your site

## Common Workflows

### Workflow 1: Find Products for Review
```
1. Search for products in category
2. Filter by high rating and free shipping
3. Get details for top 3 products
4. Generate affiliate links
5. Use data to write review
```

### Workflow 2: Compare Products
```
1. Search for product type
2. Get details for multiple products
3. Compare prices, ratings, sellers
4. Generate affiliate links for best options
```

### Workflow 3: Seasonal Recommendations
```
1. Search by season keywords ("summer", "winter")
2. Sort by sales to find trending
3. Filter by high ratings
4. Generate affiliate links
5. Create seasonal guide content
```

## Resources

- **Main Documentation**: README.md
- **API Documentation**: src/tools/*.ts (inline comments)
- **Evaluations**: evaluations/README.md
- **MCP Protocol**: https://modelcontextprotocol.io
- **TMAPI Docs**: https://tmapi.top/docs

## Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Review server logs in Claude Desktop
3. Test tools individually to isolate issues
4. Verify your TMAPI subscription is active

## Success Checklist

- [ ] TMAPI account created
- [ ] API token obtained
- [ ] .env file configured
- [ ] Server built successfully
- [ ] claude_desktop_config.json updated
- [ ] Claude Desktop restarted
- [ ] Test search successful
- [ ] DHgate affiliate program joined (optional)
- [ ] Affiliate ID configured (optional)

Once all checks pass, you're ready to use the DHgate MCP server for your yourplug affiliate marketing platform! 🚀
