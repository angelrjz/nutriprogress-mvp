export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar OPENAI_API_KEY en Vercel.' });
  }

  try {
    const payload = req.body || {};
    const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

    const prompt = `
Genera una lectura ejecutiva breve para un dashboard de seguimiento corporal.
Reglas:
- Responde en español.
- No diagnostiques ni des indicaciones médicas.
- Usa tono profesional, claro y motivador.
- Compara siempre punto inicial vs fecha activa.
- Devuelve SOLO JSON válido con esta forma: {"insights":["...", "...", "...", "..."]}
- Cada insight debe venir como texto HTML simple y puede usar <b>...</b> para títulos.
- Máximo 6 insights.

Datos:
${JSON.stringify(payload, null, 2)}
`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 900,
        store: false
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `OpenAI error: ${text.slice(0, 500)}` });
    }

    const data = await response.json();
    const text = data.output_text || data.output?.flatMap(item => item.content || []).find(part => part.type === 'output_text')?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      parsed = { insights: [text || 'No se pudo interpretar la respuesta de AI.'] };
    }

    return res.status(200).json({ insights: Array.isArray(parsed.insights) ? parsed.insights : [String(parsed.summary || text)] });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Error generando lectura con AI.' });
  }
}
