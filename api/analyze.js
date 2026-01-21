// Vercel Serverless Function for Vinted Analysis (using Groq)

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Step 1: Fetch and parse Vinted listing
        const listingData = await fetchVintedListing(url);

        // Step 2: Analyze with Groq
        const analysis = await analyzeWithGroq(listingData);

        // Step 3: Return results
        return res.status(200).json({
            rating: analysis.rating,
            assessment: analysis.assessment,
            item: {
                title: listingData.title,
                brand: listingData.brand,
                price: listingData.price,
                image: listingData.images[0] || null
            }
        });

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to analyze listing'
        });
    }
}

// ============================================
// FETCH VINTED LISTING
// ============================================
async function fetchVintedListing(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch Vinted listing');
    }

    const html = await response.text();

    // Extract JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let jsonLdData = null;

    if (jsonLdMatch) {
        try {
            jsonLdData = JSON.parse(jsonLdMatch[1]);
        } catch (e) {
            console.error('Failed to parse JSON-LD:', e);
        }
    }

    // Extract from JSON-LD or fallback to regex patterns
    const data = {
        title: extractTitle(html, jsonLdData),
        brand: extractBrand(html, jsonLdData),
        price: extractPrice(html, jsonLdData),
        description: extractDescription(html, jsonLdData),
        condition: extractCondition(html, jsonLdData),
        images: extractImages(html),
        url: url
    };

    if (!data.title && !data.price) {
        throw new Error('Could not extract listing data. The listing may be unavailable.');
    }

    return data;
}

function extractTitle(html, jsonLd) {
    if (jsonLd?.name) return jsonLd.name;
    const match = html.match(/<meta property="og:title" content="([^"]+)"/);
    return match ? match[1] : null;
}

function extractBrand(html, jsonLd) {
    if (jsonLd?.brand?.name) return jsonLd.brand.name;
    const match = html.match(/"brand":\s*{\s*"name":\s*"([^"]+)"/);
    return match ? match[1] : null;
}

function extractPrice(html, jsonLd) {
    if (jsonLd?.offers?.price) {
        const currency = jsonLd.offers.priceCurrency || '€';
        return `${currency === 'EUR' ? '€' : currency}${jsonLd.offers.price}`;
    }
    const match = html.match(/"price":\s*"?(\d+(?:\.\d+)?)"?/);
    return match ? `€${match[1]}` : null;
}

function extractDescription(html, jsonLd) {
    if (jsonLd?.description) return jsonLd.description;
    const match = html.match(/<meta property="og:description" content="([^"]+)"/);
    return match ? match[1] : null;
}

function extractCondition(html, jsonLd) {
    if (jsonLd?.itemCondition) {
        return jsonLd.itemCondition.replace('https://schema.org/', '');
    }
    return null;
}

function extractImages(html) {
    const images = [];
    const regex = /https:\/\/images1\.vinted\.net\/t\/[^"'\s]+/g;
    const matches = html.match(regex);
    if (matches) {
        // Deduplicate and get first 5
        const unique = [...new Set(matches)];
        images.push(...unique.slice(0, 5));
    }
    return images;
}

// ============================================
// GROQ ANALYSIS
// ============================================
async function analyzeWithGroq(listingData) {
    if (!GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY environment variable not set');
    }

    const prompt = buildPrompt(listingData);

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at evaluating secondhand clothing deals. Be concise and helpful.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Groq API error:', errorText);
        throw new Error(`AI analysis failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content;

    if (!text) {
        throw new Error('No analysis generated');
    }

    return parseAIResponse(text);
}

function buildPrompt(listing) {
    return `Analyze this Vinted listing and provide a deal rating.

LISTING:
- Title: ${listing.title || 'Unknown'}
- Brand: ${listing.brand || 'Unknown'}
- Price: ${listing.price || 'Unknown'}
- Description: ${listing.description || 'No description'}
- Condition: ${listing.condition || 'Unknown'}

Provide:
1. RATING (1-5):
   5 = Absolute steal
   4 = Great deal
   3 = Fair price
   2 = Slightly overpriced
   1 = Overpriced

2. ASSESSMENT (2-3 sentences): Compare to market value. Note if it's a budget/diffusion line (e.g., Armani Exchange vs Giorgio Armani). Mention quality indicators.

IMPORTANT: Watch for budget lines being priced as luxury (Armani Exchange, DKNY, Marc by Marc Jacobs, etc.)

Format your response EXACTLY like this:
RATING: [number]
ASSESSMENT: [your text]`;
}

function parseAIResponse(text) {
    // Extract rating
    const ratingMatch = text.match(/RATING:\s*(\d)/i);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;

    // Extract assessment
    const assessmentMatch = text.match(/ASSESSMENT:\s*([\s\S]+)/i);
    let assessment = assessmentMatch
        ? assessmentMatch[1].trim()
        : text.replace(/RATING:\s*\d/i, '').trim();

    // Clean up assessment
    assessment = assessment.replace(/^\s*[-:]\s*/, '');

    return {
        rating: Math.min(5, Math.max(1, rating)),
        assessment: assessment
    };
}
