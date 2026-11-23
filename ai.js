import { getSystemSettings, logAiUsage } from './db.js';
// System instructions for the cold outreach persona
const SYSTEM_PROMPT = `
## Persona and Primary Function
You are a Career Strategist and Corporate Writer. Your mission is to act on behalf of the candidate, analyzing their resume and the profile of a target company to draft a concise, professional, and impactful cold outreach email, with the goal of initiating a professional relationship and exploring future employment opportunities.

## Core Logic and Writing Workflow

**Step 1: Dual Analysis - Profile and Target.**
Your first action is a deep analysis of the two information sources:
1. Analyze the Candidate's Resume: Dissect the resume to extract their Unique Value Proposition. Identify their primary area of expertise (e.g., "Senior Brand Designer"), and two to three of the most impactful and quantifiable results or skills.
2. Analyze the Target Company: Use the company's name and website to understand its business. Infer its industry/sector (e.g., "B2B Technology," "Legal Consulting," "Fashion E-commerce").

**Step 2: Building the Relevance Bridge.**
Connect the candidate's profile to the company's reality. Formulate a hypothesis on how their skills can provide value to THEM.

**Step 3: Structuring and Drafting the Email.**
With the hypothesis defined, construct the email piece by piece.
1. Subject: Must be professional and informative. Choose one of these formats:
   - "Proactive Inquiry | [Candidate's Name] - [Primary Area of Expertise]"
   - "Value Proposition in [Primary Area of Expertise] for [Company Name]"
   - "Potential Collaboration | Profile Submission for [Company Name]"
2. Body: Maximum of 3 paragraphs.
   - Paragraph 1 (Opening and Connection): Briefly introduce yourself and establish relevance immediately.
     Example: "Dear [Company Name] Team, my name is [Candidate's Name]. I've been following the excellent work you do in the [Inferred Company Sector] sector, and given my specialization in [Primary Area of Expertise], I wanted to introduce myself."
   - Paragraph 2 (The Value Proposition): Present 2-3 key strengths from the resume, framing them as solutions for the company.
     Example: "With a career focused on [Skill/Experience 1] and a track record of success in [Quantifiable Result 2], I am confident that my skills could bring significant value to your current or future projects."
   - Paragraph 3 (The Ask and The Forward): Acknowledge that this is cold outreach and ask to submit the resume for future consideration, or request to forward to the recruitment department.
3. Closing: Use a professional closing and provide contact information (Name, Email, Phone). Do NOT include links to Behance or LinkedIn in the text.

## Output Format
Your output MUST be a single, valid JSON object, with no additional text, explanation, or markdown blocks before or after it. The email body must be formatted in plain text, using escaped newlines (\\n) for line breaks. Do NOT use actual line breaks in the string.

Expected JSON Structure:
{
  "subject": "The email subject line here",
  "body": "The email body here using \\n for newlines"
}
`;

// Helper to strip markdown JSON blocks if returned by the LLM
function sanitizeJsonString(str) {
  let cleaned = str.trim();
  // Strip ```json ... ``` blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/i, '');
  }
  return cleaned.trim();
}

async function callGemini(apiKey, prompt, targetLanguage = 'Portuguese') {
  const model = 'gemini-2.0-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

  console.log('[AI Engine] Calling Google Gemini 2.0 Flash API (OpenAI compatibility)...');

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `## Target Language\nYou MUST write the entire email in: ${targetLanguage}\n\nCandidate CV JSON:\n${prompt.cv}\n\nTarget Company:\nName: ${prompt.companyName}\nWebsite: ${prompt.companyWebsite}\n\nWrite the B2B outreach email according to the instructions and output ONLY the JSON.`
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini API Error] Raw:', errorText);
    throw new Error(`Gemini API Error: Status ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    console.error('[Gemini API Error] Empty response. Full data:', JSON.stringify(data, null, 2));
    throw new Error('Gemini API returned an empty response. Verifique os logs do servidor.');
  }

  return JSON.parse(sanitizeJsonString(text));
}

// Call Groq API
async function callGroq(apiKey, prompt, targetLanguage = 'Portuguese') {
  const model = 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  console.log('[AI Engine] Calling Groq (Llama 3.3) API...');

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `## Target Language\nYou MUST write the entire email in: ${targetLanguage}\n\nCandidate CV JSON:\n${prompt.cv}\n\nTarget Company:\nName: ${prompt.companyName}\nWebsite: ${prompt.companyWebsite}\n\nWrite the B2B outreach email according to the instructions and output ONLY the JSON.`
      }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: Status ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API returned an empty response.');
  }

  return JSON.parse(sanitizeJsonString(text));
}

// Priority list of active free models on OpenRouter with automatic fallback cascade
const FREE_OPENROUTER_MODELS = [
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'openrouter/auto'
];

// Call OpenRouter API with dynamic model rotation
async function callOpenRouter(apiKey, prompt, targetLanguage = 'Portuguese', userId = null) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  let lastError = null;

  for (const model of FREE_OPENROUTER_MODELS) {
    try {
      console.log(`[AI Engine] Calling OpenRouter model: ${model}...`);

      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `## Target Language\nYou MUST write the entire email in: ${targetLanguage}\n\nCandidate CV JSON:\n${prompt.cv}\n\nTarget Company:\nName: ${prompt.companyName}\nWebsite: ${prompt.companyWebsite}\n\nWrite the B2B outreach email according to the instructions and output ONLY the JSON.`
          }
        ],
        temperature: 0.3
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'Bunker Outreach'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        if (response.status === 429 && userId) {
           await logAiUsage(userId, model, 0, true);
        }
        const errorText = await response.text();
        throw new Error(`OpenRouter Error: Status ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;

      if (!text || text.trim().length === 0) {
        throw new Error(`Model ${model} returned empty response.`);
      }

      const parsed = JSON.parse(sanitizeJsonString(text));

      // Log AI Usage tokens
      if (userId && data.usage?.total_tokens) {
        await logAiUsage(userId, model, data.usage.total_tokens, false);
      }

      console.log(`[AI Engine] Successfully generated email with OpenRouter model: ${model}`);
      return parsed;
    } catch (err) {
      console.warn(`[AI Engine] OpenRouter model '${model}' failed (${err.message}). Trying next free model...`);
      lastError = err;
    }
  }

  throw new Error(`Todos os modelos gratuitos do OpenRouter falharam. Último erro: ${lastError?.message || 'Indisponível'}`);
}

// Main generation coordinator
export async function generateColdEmail(companyName, companyWebsite, userCvJson, settings, userId = null) {
  if (process.env.DEMO_MODE === 'true') return {subject: 'Fictional demonstration', body: 'Hello Example Team. This is generated locally; no AI request was made.'};
  const targetLanguage = settings.target_language || 'Portuguese';
  const prompt = {
    companyName,
    companyWebsite: companyWebsite || 'N/A',
    cv: typeof userCvJson === 'string' ? userCvJson : JSON.stringify(userCvJson, null, 2)
  };

  const sysSettings = await getSystemSettings();
  const globalOpenRouterKey = sysSettings.global_openrouter_key || process.env.OPENROUTER_GLOBAL_KEY;

  if (!globalOpenRouterKey) {
    throw new Error('Nenhuma chave global do OpenRouter configurada. Adicione-a nas configurações do sistema.');
  }

  try {
    return await callOpenRouter(globalOpenRouterKey, prompt, targetLanguage, userId);
  } catch (error) {
    console.error('[AI Engine Error]', error.message);
    throw new Error('Ocorreu um erro ao gerar o e-mail (os modelos gratuitos podem estar instáveis). Erro: ' + error.message);
  }
}

// ----------------- CV Parsing Module -----------------

const CV_PARSING_SYSTEM_PROMPT = `
You are an expert AI Resume Parsing Engine.
Your task is to analyze the raw, unstructured text extracted from a candidate's CV/Resume PDF and convert it into a highly structured, valid JSON object.

The output JSON MUST strictly follow this schema structure:
{
  "personal_info": {
    "name": "Full Name",
    "title": "Professional Title / Role",
    "location": "City, Country or Country",
    "phone": "Phone Number",
    "email": "Email Address",
    "links": {
      "linkedin": "LinkedIn profile URL (or null/empty string if not found)",
      "behance": "Behance portfolio URL (or null/empty string if not found)",
      "github": "GitHub profile URL (or null/empty string if not found)",
      "portfolio": "Personal portfolio URL (or null/empty string if not found)"
    }
  },
  "professional_summary": "A brief summary of their professional background, goals, and key value propositions (1-2 paragraphs).",
  "core_competencies": {
    "brand_strategy_identity": [
      "Key skill 1",
      "Key skill 2"
    ],
    "visual_design": [
      "Visual skill 1"
    ],
    "tools_software": [
      "Software 1",
      "Software 2"
    ],
    "leadership_collaboration": [
      "Soft skill 1",
      "Soft skill 2"
    ]
  },
  "professional_experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "start_date": "MM/YYYY or Year",
      "end_date": "MM/YYYY or PRESENT",
      "responsibilities": [
        "Responsibility or achievement 1 with details",
        "Responsibility or achievement 2 with details"
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree/Diploma/Certificate Name",
      "institution": "Institution Name",
      "start_date": "MM/YYYY or Year",
      "end_date": "MM/YYYY or Year",
      "location": "Location (City, Country)",
      "notes": [
        "Specialization, honors, or key achievements"
      ]
    }
  ],
  "languages": [
    {
      "language": "Language Name",
      "proficiency": "Proficiency Level (e.g., Native, Fluent, Intermediate)"
    }
  ]
}

Ensure all fields are filled as accurately as possible based on the provided CV text. If some information is not present, use logical inference or default to an empty string, empty array, or null where appropriate. Do not make up fake experiences or false information.

Your output MUST be a single, valid JSON object, with no additional text, explanation, or markdown blocks before or after it.
`;

/// Helper for Gemini Parsing
async function parseWithGemini(apiKey, promptText) {
  const model = 'gemini-2.0-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  console.log('[AI Engine] Calling Google Gemini API for CV parsing (OpenAI compat)...');

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: CV_PARSING_SYSTEM_PROMPT },
      { role: 'user', content: promptText }
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Parsing Error: Status ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Gemini Parsing returned an empty response.');
  }

  return JSON.parse(sanitizeJsonString(text));
}

// Helper for Groq Parsing
async function parseWithGroq(apiKey, promptText) {
  const model = 'llama-3.3-70b-versatile';
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  console.log('[AI Engine] Calling Groq (Llama 3.3) API for CV parsing...');

  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: CV_PARSING_SYSTEM_PROMPT },
      { role: 'user', content: promptText }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API Error: Status ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Groq API returned an empty response.');
  }
  return JSON.parse(sanitizeJsonString(text));
}

// Helper for OpenRouter Parsing with model rotation
async function parseWithOpenRouter(apiKey, promptText) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  let lastError = null;

  for (const model of FREE_OPENROUTER_MODELS) {
    try {
      console.log(`[AI Engine] Calling OpenRouter model for CV parsing: ${model}...`);

      const requestBody = {
        model: model,
        messages: [
          { role: 'system', content: CV_PARSING_SYSTEM_PROMPT },
          { role: 'user', content: promptText }
        ],
        temperature: 0.2
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://localhost',
          'X-Title': 'Bunker.Outrch'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[AI Engine] OpenRouter parsing model '${model}' returned ${response.status}. Rotating...`);
        lastError = new Error(`Model ${model} failed with status ${response.status}: ${errorText.slice(0, 120)}`);
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text || text.trim().length === 0) {
        lastError = new Error(`Model ${model} returned empty response.`);
        continue;
      }

      const parsed = JSON.parse(sanitizeJsonString(text));
      console.log(`[AI Engine] Successfully parsed CV with OpenRouter model: ${model}`);
      return parsed;
    } catch (err) {
      console.warn(`[AI Engine] OpenRouter CV parsing model '${model}' error: ${err.message}. Rotating...`);
      lastError = err;
    }
  }

  throw new Error(`Todos os modelos gratuitos do OpenRouter falharam na análise do currículo. Último erro: ${lastError?.message || 'Indisponível'}`);
}

export async function parseCVToJSON(pdfText, settings) {
  if (process.env.DEMO_MODE === 'true') return {personal_info: {name: 'Demo Operator', email: 'operator@example.com'}};
  const sysSettings = await getSystemSettings();
  const globalOpenRouterKey = sysSettings.global_openrouter_key || process.env.OPENROUTER_GLOBAL_KEY;

  if (!globalOpenRouterKey) {
    throw new Error('Nenhuma chave global do OpenRouter configurada. Adicione-a nas configurações do sistema.');
  }

  const promptText = `Here is the raw text extracted from the candidate's CV/Resume PDF:\n\n${pdfText}\n\nParse it into the structured JSON schema specified in the system instructions and output ONLY the JSON.`;

  try {
    return await parseWithOpenRouter(globalOpenRouterKey, promptText);
  } catch (error) {
    console.error('[AI Engine CV Parsing Error]', error.message);
    throw error;
  }
}
