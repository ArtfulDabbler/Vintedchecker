# Vinted Value Checker

## Project Description
Web tool that evaluates Vinted listings using AI (Google Gemini Flash) to determine if items are good deals. Paste a URL → get a deal rating (1-5) and written assessment.

## Core Features (MVP)
- URL input for Vinted listings
- Scrape: title, price, description, images
- AI analysis via Gemini Flash
- Deal rating 1-5 + written assessment
- Mobile-first design

## Evaluation Criteria
1. **Market price comparison** (primary)
2. **Authenticity assessment** (flag budget lines priced as luxury)
3. **Quality indicators** (materials, construction)

## Tech Stack
- Frontend: HTML/CSS/vanilla JS
- AI: Google Gemini Flash API (free: 1,500 req/day)
- Scraping: TBD (Vinted may block scrapers)
- Deployment: Vercel via GitHub

## Development Phases
1. **Phase 1 (MVP)**: Basic UI, Vinted scraping, Gemini integration, coats only
2. **Phase 2**: History, bookmarks, PWA for iOS share sheet
3. **Phase 3**: Public release, rate limiting, multi-platform

## Progress
- [x] Set up project structure
- [x] Create UI (mobile-first)
- [x] Build Vinted scraper (JSON-LD extraction)
- [x] Integrate Gemini Flash API
- [ ] Deploy to Vercel
- [ ] Test with real listings

## API Keys Needed
- Google Gemini Flash (via Google AI Studio)

## Notes
- Vinted scraping may be challenging (anti-bot protection)
- Focus on coats first
- Keep it simple for MVP
