export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    const { history, image, pin } = body;

    // 1. PIN Validation
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
      return new Response(JSON.stringify({ error: "API key not set in environment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Format text history
    const formattedContents = history.map(item => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: String(item.parts[0]?.text || "") }]
    }));

    // If an image is attached to the current user prompt, append it as inline_data
    if (image && image.data && image.mimeType) {
      const lastIndex = formattedContents.length - 1;
      formattedContents[lastIndex].parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data
        }
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const apiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "You are a concise, direct executive assistant. Follow the MECE principle. Lead directly with the answer in sentence one." }]
        },
        contents: formattedContents
      })
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "Gemini API error" }), {
        status: apiResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    return new Response(JSON.stringify({ text: replyText }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
