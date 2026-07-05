import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

let _client = null
function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required')
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

async function logModeration(sql, { listingId, imageId = null, checkType, modelUsed, inputTokens, outputTokens, result, passed, reason }) {
  await sql`
    insert into consignment_moderation_logs
      (listing_id, image_id, check_type, model_used, input_tokens, output_tokens, result, passed, reason)
    values
      (${listingId}, ${imageId}, ${checkType}, ${modelUsed}, ${inputTokens}, ${outputTokens}, ${sql.json(result)}, ${passed}, ${reason})
  `
}

export async function moderateListingText(sql, listing) {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a content moderator for a gay community consignment marketplace called Plug Market.

Allowed content: used or new gay-coded humor apparel, intimate wear (underwear, jockstraps, harnesses), accessories, toys, and similar adult lifestyle items. These are legitimate items that mainstream platforms refuse to host. Adult-oriented descriptions are acceptable.

Disallowed content: items involving minors in any way, illegal items (drugs, weapons), counterfeit branded goods, misleading or fraudulent descriptions, items that appear designed to facilitate harm.

Respond with a JSON object only, no other text:
{
  "decision": "APPROVED" | "REJECTED" | "FLAGGED",
  "reason": "brief explanation",
  "flags": ["flag1", "flag2"]
}

Use APPROVED for clearly acceptable items. Use REJECTED for clearly disallowed items. Use FLAGGED for borderline cases requiring human review.`,
    messages: [
      {
        role: 'user',
        content: `Please moderate this listing:\n\nTitle: ${listing.title}\n\nDescription: ${listing.description || '(none)'}\n\nCategory: ${listing.category}\nCondition: ${listing.condition}\nAsking price: $${listing.askingPrice}`,
      },
    ],
  })

  const text = response.content[0].text
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { decision: 'FLAGGED', reason: 'Moderation response parse error', flags: [] }
  }

  await logModeration(sql, {
    listingId: listing.id,
    checkType: 'TEXT',
    modelUsed: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    result: parsed,
    passed: parsed.decision === 'APPROVED',
    reason: parsed.reason,
  })

  return parsed
}

export async function moderateImage(sql, image, listingContext) {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a content moderator for a gay community consignment marketplace. You review product photos.

Check:
1. Is this an original photo (not stock photography or AI-generated)?
2. Does it show the actual item described?
3. Does it comply with marketplace rules (no explicit nudity, no minors, legal items only)?

Respond with a JSON object only, no other text:
{
  "decision": "APPROVED" | "REJECTED" | "FLAGGED",
  "reason": "brief explanation",
  "isStockPhoto": true | false,
  "matchesDescription": true | false
}`,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: image.publicUrl },
          },
          {
            type: 'text',
            text: `Listing title: ${listingContext.title}\nCategory: ${listingContext.category}`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].text
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { decision: 'FLAGGED', reason: 'Moderation response parse error', isStockPhoto: false, matchesDescription: false }
  }

  await logModeration(sql, {
    listingId: image.listingId,
    imageId: image.id,
    checkType: 'IMAGE',
    modelUsed: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    result: parsed,
    passed: parsed.decision === 'APPROVED',
    reason: parsed.reason,
  })

  await sql`
    update consignment_images
    set moderation_passed = ${parsed.decision === 'APPROVED'}
    where id = ${image.id}
  `

  return parsed
}

export async function runFullModeration(sql, listingId) {
  const [listing] = await sql`
    select id, title, description, category, condition, asking_price as "askingPrice"
    from consignment_listings
    where id = ${listingId}
  `
  if (!listing) throw new Error(`Listing ${listingId} not found`)

  const images = await sql`
    select id, listing_id as "listingId", public_url as "publicUrl"
    from consignment_images
    where listing_id = ${listingId}
  `

  const textResult = await moderateListingText(sql, listing)

  const imageResults = []
  for (const image of images) {
    const result = await moderateImage(sql, image, listing)
    imageResults.push(result)
  }

  const allResults = [textResult, ...imageResults]
  let finalDecision = 'APPROVED'
  let finalReason = 'All checks passed'

  if (allResults.some(r => r.decision === 'REJECTED')) {
    finalDecision = 'REJECTED'
    finalReason = allResults.find(r => r.decision === 'REJECTED').reason
  } else if (allResults.some(r => r.decision === 'FLAGGED')) {
    finalDecision = 'FLAGGED'
    finalReason = allResults.find(r => r.decision === 'FLAGGED').reason
  }

  const dbStatus = finalDecision === 'APPROVED' ? 'APPROVED' : finalDecision === 'REJECTED' ? 'REJECTED' : 'PENDING_MODERATION'
  const listingStatus = finalDecision === 'APPROVED' ? 'APPROVED' : finalDecision === 'REJECTED' ? 'REJECTED' : 'PENDING_MODERATION'

  await sql`
    update consignment_listings
    set
      moderation_status = ${finalDecision}::moderation_decision,
      moderation_reason = ${finalReason},
      moderation_at = now(),
      status = ${listingStatus}::listing_status
    where id = ${listingId}
  `

  return { decision: finalDecision, reason: finalReason }
}
