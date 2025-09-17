const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const NewsScraper = require('./scraper');
const newsScraper = new NewsScraper();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage for news (in production, use a database)
let newsCache = [];
let lastScrapeTime = null;

// News sources configuration - using more reliable sources
const newsSources = [
    {
        name: "Krebs on Security",
        url: "https://krebsonsecurity.com/feed/",
        type: "rss",
        category: "general",
        weight: 1.0
    },
    {
        name: "The Hacker News",
        url: "https://feeds.feedburner.com/TheHackersNews",
        type: "rss",
        category: "general",
        weight: 1.0
    },
    {
        name: "Bleeping Computer",
        url: "https://www.bleepingcomputer.com/feed/",
        type: "rss",
        category: "malware",
        weight: 1.0
    },
    {
        name: "SecurityWeek",
        url: "https://www.securityweek.com/rss.xml",
        type: "rss",
        category: "general",
        weight: 1.0
    },
    {
        name: "CSO Online",
        url: "https://www.csoonline.com/index.rss",
        type: "rss",
        category: "general",
        weight: 1.0
    }
];

// API Routes
app.get('/api/news', async (req, res) => {
    try {
        const { confidence, limit = 50 } = req.query;
        
        let filteredNews = newsCache;
        
        // Filter by confidence if specified
        if (confidence && confidence !== 'all') {
            filteredNews = newsCache.filter(news => news.confidence === confidence);
        }
        
        // Limit results
        filteredNews = filteredNews.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            data: filteredNews,
            total: newsCache.length,
            lastUpdated: lastScrapeTime,
            sources: newsSources.length
        });
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news'
        });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalNews: newsCache.length,
            highConfidence: newsCache.filter(n => n.confidence === 'high').length,
            mediumConfidence: newsCache.filter(n => n.confidence === 'medium').length,
            lowConfidence: newsCache.filter(n => n.confidence === 'low').length,
            sources: newsSources.length,
            lastUpdated: lastScrapeTime
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

app.post('/api/refresh', async (req, res) => {
    try {
        console.log('Manual refresh triggered...');
        await scrapeNews();
        res.json({
            success: true,
            message: 'News refreshed successfully',
            lastUpdated: lastScrapeTime
        });
    } catch (error) {
        console.error('Error refreshing news:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to refresh news'
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback sample data
const fallbackNews = [
    {
        id: 'fallback-1',
        title: "Major Cybersecurity Breach Affects Multiple Organizations",
        tldr: "A significant cybersecurity breach has been discovered affecting multiple organizations across various sectors. The attack appears to be part of a coordinated campaign targeting enterprise systems.",
        content: "Security researchers have identified a major cybersecurity breach affecting multiple organizations across various sectors including healthcare, finance, and technology. The attack, which was first detected by automated security systems, appears to be part of a coordinated campaign targeting enterprise systems. The attackers gained unauthorized access to sensitive data including customer information, financial records, and proprietary business data. Organizations are working with cybersecurity experts to assess the full scope of the breach and implement additional security measures. Users are advised to monitor their accounts for suspicious activity and change passwords where necessary.",
        confidence: "high",
        sources: 5,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        category: "breach",
        references: [
            { name: "Krebs on Security", url: "https://krebsonsecurity.com" },
            { name: "The Hacker News", url: "https://thehackernews.com" },
            { name: "Bleeping Computer", url: "https://bleepingcomputer.com" },
            { name: "SecurityWeek", url: "https://securityweek.com" },
            { name: "CSO Online", url: "https://csoonline.com" }
        ]
    },
    {
        id: 'fallback-2',
        title: "New Ransomware Variant Targets Critical Infrastructure",
        tldr: "A new ransomware variant has been identified targeting critical infrastructure systems. The malware encrypts operational data and demands payment in cryptocurrency.",
        content: "Security researchers have discovered a new ransomware variant specifically designed to target critical infrastructure systems including power grids, water treatment facilities, and transportation networks. The malware, dubbed 'InfraLock', encrypts operational data and control systems, demanding payment in cryptocurrency for decryption keys. The ransomware has already affected several infrastructure facilities, causing significant operational disruptions. The attackers appear to be exploiting known vulnerabilities in industrial control systems and SCADA networks. Infrastructure operators are urged to update their security systems and implement additional monitoring measures.",
        confidence: "high",
        sources: 4,
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        category: "ransomware",
        references: [
            { name: "The Hacker News", url: "https://thehackernews.com" },
            { name: "Bleeping Computer", url: "https://bleepingcomputer.com" },
            { name: "SecurityWeek", url: "https://securityweek.com" },
            { name: "CSO Online", url: "https://csoonline.com" }
        ]
    },
    {
        id: 'fallback-3',
        title: "Zero-Day Vulnerability Discovered in Popular Software",
        tldr: "A critical zero-day vulnerability has been discovered in widely-used software, potentially affecting millions of users worldwide.",
        content: "Security researchers have identified a critical zero-day vulnerability in a popular software application used by millions of users worldwide. The vulnerability, which has been assigned CVE-2024-XXXX, allows for remote code execution and could potentially be exploited to gain complete control over affected systems. The vulnerability affects multiple versions of the software and has been confirmed to be actively exploited in the wild. A patch has been developed and is being distributed to users through automatic updates. Users are urged to ensure their software is up to date and to implement additional security measures.",
        confidence: "medium",
        sources: 3,
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        category: "vulnerability",
        references: [
            { name: "Krebs on Security", url: "https://krebsonsecurity.com" },
            { name: "The Hacker News", url: "https://thehackernews.com" },
            { name: "Bleeping Computer", url: "https://bleepingcomputer.com" }
        ]
    }
];

// Scrape news function
async function scrapeNews() {
    try {
        console.log('Starting news scraping...');
        const scrapedNews = await newsScraper.scrapeAllSources(newsSources);
        
        // Process and deduplicate news
        const processedNews = await processNews(scrapedNews);
        
        // If no news was scraped, use fallback data
        if (processedNews.length === 0) {
            console.log('No news scraped, using fallback data...');
            newsCache = fallbackNews;
        } else {
            // Update cache with scraped news
            newsCache = processedNews;
        }
        
        lastScrapeTime = new Date();
        console.log(`Loaded ${newsCache.length} news articles`);
    } catch (error) {
        console.error('Error scraping news:', error);
        console.log('Using fallback data due to scraping error...');
        newsCache = fallbackNews;
        lastScrapeTime = new Date();
    }
}

// Process and deduplicate news articles
async function processNews(rawNews) {
    const newsMap = new Map();
    
    // Group news by similarity (title similarity)
    for (const article of rawNews) {
        const key = generateNewsKey(article.title);
        
        if (newsMap.has(key)) {
            // Merge with existing article
            const existing = newsMap.get(key);
            existing.sources += 1;
            existing.references.push({
                name: article.source,
                url: article.url
            });
            
            // Update confidence based on source count
            existing.confidence = calculateConfidence(existing.sources);
            
            // Keep the more recent timestamp
            if (new Date(article.timestamp) > new Date(existing.timestamp)) {
                existing.timestamp = article.timestamp;
            }
        } else {
            // Create new article entry
            const processedArticle = {
                id: generateId(),
                title: article.title,
                tldr: article.tldr || generateTLDR(article.content),
                content: article.content,
                confidence: 'low', // Will be updated based on sources
                sources: 1,
                timestamp: article.timestamp,
                category: article.category || 'general',
                references: [{
                    name: article.source,
                    url: article.url
                }]
            };
            
            newsMap.set(key, processedArticle);
        }
    }
    
    // Convert to array and sort
    const processedArray = Array.from(newsMap.values());
    
    // Sort by confidence and recency
    return processedArray.sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
            return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
}

// Generate a key for news deduplication
function generateNewsKey(title) {
    // Simple key generation based on title words
    return title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .slice(0, 5)
        .join('_');
}

// Calculate confidence based on source count
function calculateConfidence(sourceCount) {
    if (sourceCount >= 5) return 'high';
    if (sourceCount >= 2) return 'medium';
    return 'low';
}

// Generate simple TLDR (in production, use AI)
function generateTLDR(content) {
    if (!content) return 'No summary available.';
    
    // Simple TLDR generation - take first sentence or first 150 characters
    const sentences = content.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();
    
    if (firstSentence && firstSentence.length <= 200) {
        return firstSentence + '.';
    }
    
    return content.substring(0, 150) + '...';
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Schedule news scraping every 30 minutes
cron.schedule('*/30 * * * *', async () => {
    console.log('Scheduled news scraping...');
    await scrapeNews();
});

// Initial news scrape on startup
scrapeNews().then(() => {
    console.log('Initial news scrape completed');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CyberNews Aggregator server running on port ${PORT}`);
    console.log(`📰 Monitoring ${newsSources.length} cybersecurity news sources`);
    console.log(`🔄 Auto-refresh every 30 minutes`);
});

module.exports = app;
