import { IncomingForm } from 'formidable'
import fs from 'fs'
import path from 'path'

export const config = {
  api: {
    bodyParser: false,
  },
}

// Strip non-commercial content from extracted text
function preprocessText(text) {
  if (!text) return ''

  const lines = text.split('\n')
  const filtered = []
  let skipMode = false
  let skipPatterns = [
    /^schedule\s+\d/i,
    /^annexure\s+[a-z\d]/i,
    /^appendix\s+[a-z\d]/i,
    /^exhibit\s+[a-z\d]/i,
  ]

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { filtered.push(line); continue }

    const isSkipHeader = skipPatterns.some(p => p.test(trimmed)) && trimmed.length < 80
    if (isSkipHeader) { skipMode = true; continue }

    if (skipMode && /^(PART|CLAUSE|SECTION|\d+\.)\s+/i.test(trimmed) && trimmed.length < 120) {
      skipMode = false
    }

    if (!skipMode) filtered.push(line)
  }

  const result = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()

  // Hard cap at 80,000 chars — well within token limits
  if (result.length > 80000) {
    return result.slice(0, 80000) + '\n\n[Document truncated — schedules and annexures omitted]'
  }

  return result
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const form = new IncomingForm({ maxFileSize: 20 * 1024 * 1024 }) // 20MB

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ fields, files })
      })
    })

    const file = files.file?.[0] || files.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    const ext = path.extname(file.originalFilename || file.name || '').toLowerCase()
    let text = ''

    if (ext === '.txt') {
      text = fs.readFileSync(file.filepath, 'utf8')
    } else if (ext === '.pdf') {
      // For PDF — return null so browser handles it as base64
      return res.status(200).json({ text: null, useBase64: true })
    } else if (ext === '.doc' || ext === '.docx') {
      // Try mammoth for docx
      try {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ path: file.filepath })
        text = result.value
      } catch (e) {
        // Fall back to base64 if mammoth fails
        return res.status(200).json({ text: null, useBase64: true })
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file type' })
    }

    const processed = preprocessText(text)
    return res.status(200).json({ text: processed, chars: processed.length })

  } catch (err) {
    console.error('Extract text error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
