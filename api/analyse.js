import ANALYSIS_PROMPT from './_prompt.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Strip non-commercial content and cap size
function preprocessText(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const filtered = []
  let skipMode = false
  const skipPatterns = [/^schedule\s+\d/i, /^annexure\s+[a-z\d]/i, /^appendix\s+[a-z\d]/i]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { filtered.push(line); continue }
    if (skipPatterns.some(p => p.test(trimmed)) && trimmed.length < 80) { skipMode = true; continue }
    if (skipMode && /^(PART|CLAUSE|SECTION|\d+\.)\s+/i.test(trimmed) && trimmed.length < 120) skipMode = false
    if (!skipMode) filtered.push(line)
  }

  const result = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return result.length > 80000
    ? result.slice(0, 80000) + '\n\n[Document truncated — schedules and annexures omitted]'
    : result
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  try {
    const { filePath, fileType, pasteText } = req.body
    let messages

    if (pasteText) {
      // Pasted text — send directly
      messages = [{
        role: 'user',
        content: `Analyse this retail lease or heads of agreement and return a JSON risk report:\n\n${pasteText}`
      }]

    } else if (filePath) {
      const ext = fileType?.toLowerCase()

      if (ext === 'pdf') {
        // Download PDF from Supabase and send as base64
        const { data, error } = await supabase.storage.from('documents').download(filePath)
        if (error) throw new Error('Could not retrieve file: ' + error.message)

        const arrayBuffer = await data.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')

        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Analyse this retail lease or heads of agreement. Focus on all commercial terms, special conditions, and clauses that affect the tenant financially or operationally. Ignore schedules, annexures, plans, and standard boilerplate.' }
          ]
        }]

      } else {
        // DOC/DOCX/TXT — download and extract text server-side with mammoth
        const { data, error } = await supabase.storage.from('documents').download(filePath)
        if (error) throw new Error('Could not retrieve file: ' + error.message)

        const arrayBuffer = await data.arrayBuffer()
        let extractedText = ''

        if (ext === 'docx') {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
          extractedText = result.value
        } else if (ext === 'doc') {
          // Legacy .doc — try mammoth, it handles some .doc files
          try {
            const mammoth = await import('mammoth')
            const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
            extractedText = result.value
          } catch {
            throw new Error('Legacy .doc files are not supported. Please save as .docx or PDF and try again.')
          }
        } else if (ext === 'txt') {
          extractedText = Buffer.from(arrayBuffer).toString('utf8')
        }

        if (!extractedText || extractedText.length < 100) {
          throw new Error('Could not extract text from this document. Please try saving as PDF and uploading again.')
        }

        const processed = preprocessText(extractedText)

        messages = [{
          role: 'user',
          content: `Analyse this retail lease or heads of agreement. Focus on all commercial terms, special conditions, and clauses that affect the tenant financially or operationally. Ignore schedules, annexures, plans, and standard boilerplate.\n\n${processed}`
        }]
      }
    } else {
      return res.status(400).json({ error: 'No file or text provided' })
    }

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
        messages,
      }),
    })

    const data = await response.json()
    return res.status(response.status).json(data)

  } catch (err) {
    console.error('Analyse error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
