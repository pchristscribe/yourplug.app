import { z } from 'zod'
import { CONFIG } from '../config.js'

export const GenerateAffiliateLinkSchema = z.object({
  product_url: z.string()
    .url('Must be a valid URL')
    .describe('DHgate product URL to convert into an affiliate link. Example: "https://www.dhgate.com/product/..."'),
  campaign_name: z.string()
    .max(50)
    .optional()
    .describe('Optional campaign name for tracking purposes. Example: "summer-sale-2025", "blog-post-wireless-headphones"')
}).strict()

export type GenerateAffiliateLinkInput = z.infer<typeof GenerateAffiliateLinkSchema>

export async function generateAffiliateLink(input: GenerateAffiliateLinkInput): Promise<string> {
  const { product_url, campaign_name } = input

  if (!product_url.includes('dhgate.com')) {
    return `Error: The provided URL does not appear to be a DHgate product URL.

Expected format: https://www.dhgate.com/product/...
Received: ${product_url}

Please provide a valid DHgate product URL from search results or product details.`
  }

  if (!CONFIG.affiliateId) {
    return `Warning: DHGATE_AFFILIATE_ID is not configured in your environment variables.

To generate tracked affiliate links:
1. Join the DHgate affiliate program at https://affiliate.dhgate.com/
2. Get your affiliate ID from your account dashboard
3. Set DHGATE_AFFILIATE_ID in your .env file

For now, here's the original product URL: ${product_url}`
  }

  const url = new URL(product_url)
  url.searchParams.set('aff_id', CONFIG.affiliateId)

  if (campaign_name) {
    url.searchParams.set('utm_campaign', campaign_name)
    url.searchParams.set('utm_source', 'yourplug')
    url.searchParams.set('utm_medium', 'affiliate')
  }

  const affiliateUrl = url.toString()

  let response = `✅ Affiliate link generated successfully!\n\n`
  response += `🔗 Affiliate URL: ${affiliateUrl}\n\n`

  if (campaign_name) {
    response += `📊 Campaign: ${campaign_name}\n`
  }

  response += `\n⚠️ FTC Compliance Reminder:\n`
  response += `You must disclose this is an affiliate link and that you receive compensation from sales. Example disclosure:\n\n`
  response += `"As an Amazon Associate and DHgate affiliate, we earn from qualifying purchases. ` +
              `This means if you click a link and make a purchase, we may receive a commission at no extra cost to you."\n\n`
  response += `💡 Tip: Track this link's performance in your DHgate affiliate dashboard.`

  return response
}

export const generateAffiliateLinkMetadata = {
  name: 'generate_affiliate_link',
  description: `Convert a DHgate product URL into a tracked affiliate link with FTC-compliant disclosure reminders.

This is the final step in the monetization workflow. Takes a DHgate product URL and adds your affiliate tracking parameters.

Use this tool when:
- User wants to promote a product and needs an affiliate link
- Creating content with product recommendations
- Setting up affiliate links for a blog post or review
- Need tracking URLs for campaign analytics

The tool automatically:
- Adds your affiliate ID to track commissions
- Includes optional campaign tracking parameters
- Provides FTC compliance reminders for legal disclosure requirements
- Validates the URL is a valid DHgate link

IMPORTANT: Always remind users to include FTC-compliant disclosures when using affiliate links.`,
  inputSchema: {
    type: 'object',
    properties: {
      product_url: {
        type: 'string',
        description: 'DHgate product URL to convert into an affiliate link. Example: "https://www.dhgate.com/product/..."'
      },
      campaign_name: {
        type: 'string',
        description: 'Optional campaign name for tracking purposes. Example: "summer-sale-2025", "blog-post-wireless-headphones"'
      }
    },
    required: ['product_url']
  }
} as const
