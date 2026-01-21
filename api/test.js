// Simple test endpoint to check if env vars are working

export default async function handler(req, res) {
    const hasKey = !!process.env.GROQ_API_KEY;
    const keyLength = process.env.GROQ_API_KEY?.length || 0;

    return res.status(200).json({
        groqKeySet: hasKey,
        keyLength: keyLength,
        message: hasKey ? 'API key is configured' : 'API key is MISSING'
    });
}
