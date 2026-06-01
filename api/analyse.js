import ANALYSIS_PROMPT from './_prompt.js'

// Sections to strip from large documents before sending to Claude
const SKIP_PATTERNS = [
  /schedule\s+\d/gi,
  /annexure\s+[a-z\d]/gi,
  /appendix\s+[a-z\d]/gi,
  /exhibit\s+[a-z\d]/gi,
  /plan\s+\d/gi,
  /body\s+corporate\s+rules/gi,
  /centre\s+management\s+procedures/gi,
  /stamp\s+duty/gi,
]

// Strip obviously non-commercial boilerplate from text content
function preprocessText(text) {
  if (!text || text.length < 50000) return text // Only preprocess large docs

  const lines = text.split('\n')
  const filtered = []
  let skipMode = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check if we're entering a skip section
    const isSkipHeader = SKIP_PATTERNS.some(p => p.test(trimmed))
    if (isSkipHeader && trimmed.length < 80) {
      skipMode = true
      continue
    }

    // Exit skip mode when we hit a new major section (numbered heading)
    if (skipMode && /^(PART|CLAUSE|SECTION)\s+\d/i.test(trimmed)) {
      skipMode = false
    }

    if (!skipMode) filtered.push(line)
  }

  const result = filtered.join('\n')

  // If still very large, truncate to first 80000 chars (commercial terms are usually early)
  if (result.length > 80000) {
    return result.slice(0, 80000) + '\n\n[Document truncated for analysis — schedules and annexures omitted]'
  }

  return result
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const { messages } = req.body

    // Pre-process text messages to reduce token count
    const processedMessages = messages.map(msg => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map(block => {
            if (block.type === 'text') {
              return { ...block, text: preprocessText(block.text) }
            }
            return block
          })
        }
      }
      if (typeof msg.content === 'string') {
        return { ...msg, content: preprocessText(msg.content) }
      }
      return msg
    })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 16000,
        temperature: 0,
        system: ANALYSIS_PROMPT,
        messages: processedMessages,
      }),
    })

    const data = await response.json()
    return res.status(response.status).json(data)
  } catch (err) {
    console.error('Analyse error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
