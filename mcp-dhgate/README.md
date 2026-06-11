# MCP DHgate Server

A Model Context Protocol (MCP) server that enables LLMs to search DHgate products and generate affiliate links for the yourplug affiliate marketing platform.

## Features

- **Product Search**: Search DHgate's product catalog with keyword filtering, sorting, and pagination
- **Product Details**: Get comprehensive information about specific products
- **Affiliate Link Generation**: Convert product URLs to tracked affiliate links with FTC compliance reminders
- **Rate Limiting**: Built-in request throttling (60 requests/minute)
- **Dual Response Formats**: Concise (human-readable) and detailed (JSON) output modes
- **Error Handling**: Actionable error messages that guide users toward resolution

## Installation

```bash
cd mcp-dhgate
pnpm install
pnpm build
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Set your TMAPI token:
```env
DHGATE_API_TOKEN=your_api_token_here
```

Get your token from [TMAPI Console](https://tmapi.top/console)

3. (Optional) Set your DHgate affiliate ID:
```env
DHGATE_AFFILIATE_ID=your_affiliate_id_here
```

Get your affiliate ID from [DHgate Affiliate Program](https://affiliate.dhgate.com/)

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "dhgate": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-dhgate/dist/index.js"
      ],
      "env": {
        "DHGATE_API_TOKEN": "your_api_token_here",
        "DHGATE_AFFILIATE_ID": "your_affiliate_id_here"
      }
    }
  }
}
```

## Available Tools

### 1. search_products

Search DHgate products by keywords with filtering and sorting.

**Parameters:**
- `keywords` (required): Search terms
- `page` (optional): Page number (default: 1)
- `sort` (optional): sales | price_up | price_down | newest | rating
- `free_shipping` (optional): Filter for free shipping
- `high_rating` (optional): Filter for 4+ star products
- `response_format` (optional): concise | detailed

**Example:**
```typescript
{
  "keywords": "wireless headphones",
  "sort": "rating",
  "free_shipping": true,
  "response_format": "concise"
}
```

### 2. get_product_details

Get comprehensive details for a specific product.

**Parameters:**
- `product_id` (required): DHgate product ID
- `response_format` (optional): concise | detailed

**Example:**
```typescript
{
  "product_id": "ff8080817c9a8b89017ca0e5c8c71234",
  "response_format": "concise"
}
```

### 3. generate_affiliate_link

Convert DHgate product URL to tracked affiliate link.

**Parameters:**
- `product_url` (required): DHgate product URL
- `campaign_name` (optional): Campaign tracking name

**Example:**
```typescript
{
  "product_url": "https://www.dhgate.com/product/...",
  "campaign_name": "summer-sale-2025"
}
```

## Typical Workflow

1. **Search for products**:
   ```
   search_products → keywords="smart watch", sort="rating"
   ```

2. **Get detailed information**:
   ```
   get_product_details → product_id="12345678"
   ```

3. **Generate affiliate link**:
   ```
   generate_affiliate_link → product_url="https://dhgate.com/product/..."
   ```

## Architecture

```
src/
├── index.ts           # MCP server entry point
├── config.ts          # Environment configuration
├── types.ts           # TypeScript interfaces
├── api/
│   └── client.ts      # API request handler with rate limiting
├── tools/
│   ├── search.ts      # Product search tool
│   ├── product.ts     # Product details tool
│   └── affiliate.ts   # Affiliate link generator
└── utils/
    ├── errors.ts      # Error handling
    └── formatters.ts  # Response formatting (concise/detailed)
```

## Error Handling

All errors include:
1. **What went wrong**: Clear explanation
2. **Why it happened**: Context about the cause
3. **How to fix**: Specific next steps
4. **Example**: Correct usage pattern

## Rate Limiting

- **Limit**: 60 requests per minute
- **Automatic throttling**: Built-in
- **Exceeding limit**: Returns actionable error with wait time

## FTC Compliance

The `generate_affiliate_link` tool automatically includes FTC compliance reminders. Always disclose affiliate relationships:

> "As an Amazon Associate and DHgate affiliate, we earn from qualifying purchases. This means if you click a link and make a purchase, we may receive a commission at no extra cost to you."

## Development

```bash
# Build
pnpm build

# Watch mode
pnpm dev

# Type checking
pnpm typecheck
```

## License

MIT
