export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

const MODEL = 'gemini-2.0-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY environment variable is not set on the server.' } });
  }

  try {
    const { imageBase64, mediaType, prompt } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: prompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 8192 },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const msg = data.error?.message || `Gemini API error ${response.status}`;
      return res.status(response.status).json({ error: { message: msg } });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    res.status(200).json({ text });
  } catch (err) {
    res.status(502).json({ error: { message: err.message } });
  }
}
