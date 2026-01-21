// ============================================
// DOM ELEMENTS
// ============================================
const inputSection = document.getElementById('inputSection');
const loading = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const error = document.getElementById('error');

const urlInput = document.getElementById('urlInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resetBtn = document.getElementById('resetBtn');
const retryBtn = document.getElementById('retryBtn');

const rating = document.getElementById('rating');
const ratingLabel = document.getElementById('ratingLabel');
const itemImage = document.getElementById('itemImage');
const itemTitle = document.getElementById('itemTitle');
const itemBrand = document.getElementById('itemBrand');
const itemPrice = document.getElementById('itemPrice');
const assessmentText = document.getElementById('assessmentText');
const errorMessage = document.getElementById('errorMessage');

// ============================================
// STATE MANAGEMENT
// ============================================
function showSection(section) {
    inputSection.classList.add('hidden');
    loading.classList.add('hidden');
    resultsSection.classList.add('hidden');
    error.classList.add('hidden');

    section.classList.remove('hidden');
}

// ============================================
// RATING LABELS
// ============================================
const ratingLabels = {
    5: 'Absolute Steal!',
    4: 'Great Deal',
    3: 'Fair Price',
    2: 'Slightly Overpriced',
    1: 'Overpriced'
};

// ============================================
// API CALL
// ============================================
async function analyzeUrl(url) {
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze listing');
    }

    return response.json();
}

// ============================================
// DISPLAY RESULTS
// ============================================
function displayResults(data) {
    // Set rating
    rating.textContent = data.rating;
    rating.className = 'rating rating-' + data.rating;
    ratingLabel.textContent = ratingLabels[data.rating] || 'Unknown';

    // Set item info
    itemTitle.textContent = data.item.title || 'Unknown Item';
    itemBrand.textContent = data.item.brand || '';
    itemPrice.textContent = data.item.price || '';

    if (data.item.image) {
        itemImage.src = data.item.image;
        itemImage.style.display = 'block';
    } else {
        itemImage.style.display = 'none';
    }

    // Set assessment
    assessmentText.textContent = data.assessment;

    showSection(resultsSection);
}

function displayError(message) {
    errorMessage.textContent = message;
    showSection(error);
}

function reset() {
    urlInput.value = '';
    showSection(inputSection);
    urlInput.focus();
}

// ============================================
// EVENT HANDLERS
// ============================================
async function handleAnalyze() {
    const url = urlInput.value.trim();

    if (!url) {
        urlInput.focus();
        return;
    }

    // Basic URL validation
    if (!url.includes('vinted.')) {
        displayError('Please enter a valid Vinted URL');
        return;
    }

    showSection(loading);
    analyzeBtn.disabled = true;

    try {
        const result = await analyzeUrl(url);
        displayResults(result);
    } catch (err) {
        displayError(err.message);
    } finally {
        analyzeBtn.disabled = false;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
analyzeBtn.addEventListener('click', handleAnalyze);

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleAnalyze();
    }
});

resetBtn.addEventListener('click', reset);
retryBtn.addEventListener('click', reset);

// Focus input on load
urlInput.focus();
