// Vercel Serverless Function for Vinted Analysis

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

        // Step 2: Analyze with Gemini
        const analysis = await analyzeWithGemini(listingData);

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
// GEMINI ANALYSIS
// ============================================
async function analyzeWithGemini(listingData) {
    const prompt = buildPrompt(listingData);

    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024
        }
    };

    // If we have images, add the first one for vision analysis
    if (listingData.images.length > 0) {
        try {
            const imageResponse = await fetch(listingData.images[0]);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');
            const mimeType = 'image/webp';

            requestBody.contents[0].parts.unshift({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            });
        } catch (e) {
            console.error('Failed to fetch image for analysis:', e);
        }
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error('AI analysis failed');
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('No analysis generated');
    }

    return parseGeminiResponse(text);
}

function buildPrompt(listing) {
    return `You are an expert at evaluating secondhand clothing deals, particularly on platforms like Vinted.

Analyze this listing and provide:
1. A RATING from 1-5:
   - 5 = Absolute steal (way below market value)
   - 4 = Great deal (notably below market value)
   - 3 = Fair price (normal market value)
   - 2 = Slightly overpriced
   - 1 = Overpriced/poor value

2. A brief ASSESSMENT (2-4 sentences) covering:
   - How the price compares to typical market value for this type of item
   - Authenticity confidence (especially note if this might be a budget/diffusion line being priced as mainline luxury, e.g., Armani Exchange vs Giorgio Armani)
   - Quality indicators based on the brand and description

LISTING DATA:
- Title: ${listing.title || 'Unknown'}
- Brand: ${listing.brand || 'Unknown'}
- Price: ${listing.price || 'Unknown'}
- Description: ${listing.description || 'No description'}
- Condition: ${listing.condition || 'Unknown'}

${listing.images.length > 0 ? 'An image of the item is attached for visual analysis.' : ''}

RESPOND IN THIS EXACT FORMAT:
RATING: [number 1-5]
ASSESSMENT: [your assessment text]`;
}

function parseGeminiResponse(text) {
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
