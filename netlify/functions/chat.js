const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Resend } = require('resend');

// --- API KEYS FROM NETLIFY ENVIRONMENT ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CALENDLY_EVENT_LINK = process.env.CALENDLY_EVENT_LINK;

if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set.");
if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set.");
if (!CALENDLY_EVENT_LINK) throw new Error("CALENDLY_EVENT_LINK not set.");

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const resend = new Resend(RESEND_API_KEY);

// ⚡ Get the correct Gemini model name dynamically
async function getModel() {
  try {
    const models = await genAI.listModels();
    console.log("Available Gemini Models:", models);
    const model = models.find(m => m.name.includes("gemini-1.5"));
    if (!model) throw new Error("Gemini model not found.");
    return model.name;
  } catch (error) {
    console.error("Error fetching Gemini models:", error);
    throw error;
  }
}

async function captureLead(message) {
  const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const foundEmail = message.match(emailRegex);
  const foundPhone = message.match(phoneRegex);

  if (foundEmail || foundPhone) {
    const contactInfo = foundEmail ? `Email: ${foundEmail[0]}` : `Phone: ${foundPhone[0]}`;
    const subject = `New Lead Captured from Portfolio Bot!`;
    const body = `<p>Hi Ehsan,</p><p>Your AI assistant captured a new lead.</p><p><strong>Contact Info:</strong> ${contactInfo}</p><p><strong>Message:</strong> "${message}"</p>`;

    try {
      await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: 'ehsanmohajer066@gmail.com',
        subject,
        html: body
      });
      console.log("Lead capture email sent successfully.");
    } catch (error) {
      console.error("Error sending lead capture email:", error);
    }
  }
}

exports.handler = async function(event, context) {
  const headers = { 
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Headers': 'Content-Type', 
    'Content-Type': 'application/json' 
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { message } = JSON.parse(event.body);
    if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };

    await captureLead(message);

    const modelName = await getModel();
    const model = genAI.getGenerativeModel({ model: modelName });

    const knowledgeBase = `
      You are a friendly AI assistant for Ehsan (Sani) Mohajer.
      ...
      [Your existing knowledge base here, unchanged]
    `;

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: knowledgeBase }] },
        { role: "model", parts: [{ text: "Understood. I will answer questions based on my knowledge base." }] }
      ]
    });

    const result = await chat.sendMessage(message);
    const text = result.response.text();

    return { statusCode: 200, headers, body: JSON.stringify({ reply: text }) };

  } catch (error) {
    console.error("Error in Netlify function:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
