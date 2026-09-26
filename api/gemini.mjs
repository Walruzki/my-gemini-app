export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { history, image, pin } = await req.json();

    // 1. PIN Check
    const requiredPin = process.env.APP_PIN;
    if (requiredPin && pin !== requiredPin) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid PIN" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!history || !Array.isArray(history) || history.length === 0) {
      return new Response(JSON.stringify({ error: "Conversation history required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured in Vercel" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Prepare contents array
    const contents = history.map(item => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: String(item.parts[0]?.text || "") }]
    }));

    // If an image was attached to this request, append it to the last user message
    if (image && image.data && image.mimeType) {
      contents[contents.length - 1].parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data
        }
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

    const apiRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are a direct, concise assistant. Lead directly with facts. When analyzing food or nutrition, extract key macronutrients (calories, protein, carbs, fats) cleanly." }]
        },
        contents: contents
      })
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "Gemini API error" }), {
        status: apiRes.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    return new Response(JSON.stringify({ text: reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
