import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ANALYSIS_PROMPT = `You are LeaseLens, an expert retail lease analyst with 10+ years of hands-on retail leasing experience across Australian shopping centres, high streets, and mixed-use precincts. You have deep knowledge of Australian retail tenancy legislation in all states and territories.

Your job is to analyse a Heads of Agreement (HOA) or retail lease document on behalf of a retail tenant, a small business owner who may be signing without professional representation.

WHAT TO ANALYSE — IDENTIFY AND ASSESS ALL OF THE FOLLOWING WHERE PRESENT:
- Rent, rent reviews, and rent escalation mechanisms
- Outgoings, operating expenses, and what the tenant must pay
- Lease term, options to renew, and holding over
- Make-good and fitout obligations
- Assignment and subletting rights
- Permitted use and exclusivity
- Demolition, relocation, and termination rights
- Bank guarantee and security deposit
- Personal guarantee
- Default and dispute resolution
- Incentives and rent-free periods
- Insurance obligations
- Special conditions — analyse EVERY special condition individually
- Any other clause that creates financial exposure or operational risk for the tenant

WHAT TO IGNORE:
- Legal definitions sections (unless a definition materially affects a commercial term)
- Schedules, annexures, plans, and drawings
- Standard boilerplate (governing law, notices, entire agreement clauses)
- Stamp duty and registration provisions
- Body corporate rules and centre management procedures
- Technical building specifications
- Privacy and data provisions

TONE AND APPROACH:
- Be measured, practical and calm, never alarmist or dramatic
- Counter positions should be realistic and proportionate
- Do not omit clauses to keep the response short — completeness matters

DOCUMENT REFERENCING — MANDATORY:
- location: section number, heading and clause number exactly as in the document
- quote: exact wording from the document verbatim

CRITICAL FORMATTING:
- Never use em dash. Use comma, colon, or reword instead.
- Each field 2-3 sentences maximum.
- NEVER use "market standard" — use "not uncommon" or "commonly negotiated".

RISK RATING:
HIGH: significant financial liability, loss of trading rights, forced exit.
MEDIUM: standard but less favourable, mitigable through negotiation.
LOW: standard and appropriate.

FINANCIAL EXTRACTION (numbers only, no symbols):
- base_rent_psm, tenancy_size_sqm, total_annual_rent — null if not found.

OUTPUT — valid JSON only, no preamble, no markdown:
{
  "overall_risk": "HIGH"|"MEDIUM"|"LOW",
  "summary": "2-3 sentences.",
  "base_rent_psm": number|null,
  "tenancy_size_sqm": number|null,
  "total_annual_rent": number|null,
  "clauses": [{
    "name": "string",
    "danger": "HIGH"|"MEDIUM"|"LOW",
    "location": "string",
    "quote": "string",
    "risk": "string",
    "context": "string",
    "legislation": "string|null",
    "counter": "string"
  }],
  "next_steps": ["string"]
}`

function preprocessText(text: string): string {
  if (!text) return ''
  const lines = text.split('\n')
  const filtered: string[] = []
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
  return result.length > 50000
    ? result.slice(0, 50000) + '\n\n[Document truncated — schedules and annexures omitted]'
    : result
}

async function extractDocxText(data: Uint8Array): Promise<string> {
  const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1')
  const zip = await JSZip.loadAsync(data)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) throw new Error('Could not read document XML')

  return docXml
    .replace(/<w:br[^>]*\/>/gi, '\n')
    .replace(/<w:p[ >][^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}


// Attempt to repair truncated JSON by extracting valid clauses
function repairTruncatedJson(raw: string): any {
  // First try normal parse
  try {
    return JSON.parse(raw)
  } catch {}

  // Try to extract what we can
  try {
    // Get overall_risk
    const riskMatch = raw.match(/"overall_risk"\s*:\s*"(HIGH|MEDIUM|LOW)"/)
    const overall_risk = riskMatch ? riskMatch[1] : 'MEDIUM'

    // Get summary
    const summaryMatch = raw.match(/"summary"\s*:\s*"([^"]*)"/)
    const summary = summaryMatch ? summaryMatch[1] : 'Analysis incomplete — document may be too large.'

    // Extract complete clause objects
    const clauses: any[] = []
    const clauseRegex = /\{[^{}]*"name"[^{}]*"danger"[^{}]*"location"[^{}]*\}/g
    const matches = raw.match(clauseRegex) || []
    for (const match of matches) {
      try {
        clauses.push(JSON.parse(match))
      } catch {}
    }

    return {
      overall_risk,
      summary: summary + (clauses.length < 3 ? ' Some clauses may be missing due to document length.' : ''),
      base_rent_psm: null,
      tenancy_size_sqm: null,
      total_annual_rent: null,
      clauses,
      next_steps: ['Review the full document carefully with a qualified solicitor given its length and complexity.']
    }
  } catch (e) {
    throw new Error('Could not parse analysis response: ' + e.message)
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SB_URL')!,
    Deno.env.get('SB_SERVICE_ROLE_KEY')!
  )

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!

  try {
    const { jobId } = await req.json()
    if (!jobId) return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400, headers: corsHeaders })

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: corsHeaders })
    }

    await supabase.from('jobs').update({ status: 'processing' }).eq('id', jobId)

    let messages: any[]

    if (job.paste_text) {
      messages = [{
        role: 'user',
        content: `Analyse this retail lease or heads of agreement:\n\n${job.paste_text}`
      }]
    } else if (job.file_path) {
      const ext = job.file_type?.toLowerCase()

      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(job.file_path)

      if (fileError) throw new Error('Could not download file: ' + fileError.message)

      const arrayBuffer = await fileData.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      if (ext === 'pdf') {
        const base64 = btoa(String.fromCharCode(...uint8Array))
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: 'Analyse this retail lease. Focus on all commercial terms and special conditions. Ignore schedules, annexures, and boilerplate.' }
          ]
        }]
      } else if (ext === 'docx') {
        const rawText = await extractDocxText(uint8Array)
        const processed = preprocessText(rawText)
        const isLarge = processed.length > 40000
        messages = [{
          role: 'user',
          content: `Analyse this retail lease. Focus on all commercial terms and special conditions. Ignore schedules, annexures, and boilerplate.${isLarge ? ' Be concise — 2 sentences max per field.' : ''}\n\n${processed}`
        }]
      } else if (ext === 'txt') {
        const text = new TextDecoder().decode(uint8Array)
        messages = [{ role: 'user', content: `Analyse this retail lease:\n\n${text}` }]
      } else {
        throw new Error('Unsupported file type: ' + ext)
      }
    } else {
      throw new Error('No file or text provided')
    }

    const isLargeDoc = typeof messages[0]?.content === 'string' && messages[0].content.length > 30000
    const maxTokens = isLargeDoc ? 12000 : 16000
    // Use Haiku for large docs — 3x faster, still high quality
    const model = isLargeDoc ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-5'

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system: ANALYSIS_PROMPT,
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      throw new Error('Claude API error: ' + err)
    }

    const claudeData = await claudeRes.json()
    const raw = claudeData.content[0].text.trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')

    const parsed = repairTruncatedJson(raw)

    await supabase.from('jobs').update({
      status: 'complete',
      report_json: parsed,
    }).eq('id', jobId)

    if (job.negotiation_id && job.user_id) {
      const { data: countData } = await supabase
        .from('documents')
        .select('id')
        .eq('negotiation_id', job.negotiation_id)

      const versionNumber = (countData?.length || 0) + 1

      let permanentPath = job.file_path
      if (job.file_path?.startsWith('temp/')) {
        const filename = job.file_path.split('/').pop()
        permanentPath = `${job.user_id}/${job.negotiation_id}/${Date.now()}_${filename}`
        await supabase.storage.from('documents').move(job.file_path, permanentPath)
      }

      const { data: docData } = await supabase.from('documents').insert({
        negotiation_id: job.negotiation_id,
        user_id: job.user_id,
        filename: job.file_path?.split('/').pop() || 'document',
        file_path: permanentPath,
        version_number: versionNumber,
        overall_risk: parsed.overall_risk,
        base_rent_psm: parsed.base_rent_psm || null,
        tenancy_size_sqm: parsed.tenancy_size_sqm || null,
        total_annual_rent: parsed.total_annual_rent || null,
      }).select().single()

      if (docData) {
        await supabase.from('reports').insert({
          document_id: docData.id,
          user_id: job.user_id,
          report_json: parsed,
        })
        await supabase.from('jobs').update({ document_id: docData.id }).eq('id', jobId)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (err) {
    console.error('Job error:', err.message)

    try {
      const { jobId } = await req.clone().json()
      if (jobId) {
        await supabase.from('jobs').update({
          status: 'failed',
          error: err.message,
        }).eq('id', jobId)
      }
    } catch {}

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders
    })
  }
})
