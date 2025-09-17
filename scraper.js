const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const parser = new Parser();

class NewsScraper {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.timeout = 10000; // 10 seconds
    }

    // Main method to scrape all sources
    async scrapeAllSources(sources) {
        const allNews = [];
        const promises = sources.map(source => this.scrapeSource(source));
        
        try {
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allNews.push(...result.value);
                    console.log(`✅ Scraped ${result.value.length} articles from ${sources[index].name}`);
                } else {
                    console.error(`❌ Failed to scrape ${sources[index].name}:`, result.reason.message);
                }
            });
            
            return allNews;
        } catch (error) {
            console.error('Error in scrapeAllSources:', error);
            return [];
        }
    }

    // Scrape individual source
    async scrapeSource(source) {
        try {
            if (source.type === 'rss') {
                return await this.scrapeRSS(source);
            } else {
                return await this.scrapeWebPage(source);
            }
        } catch (error) {
            console.error(`Error scraping ${source.name}:`, error.message);
            return [];
        }
    }

    // Scrape RSS feeds
    async scrapeRSS(source) {
        try {
            console.log(`Scraping RSS feed: ${source.name} - ${source.url}`);
            const feed = await parser.parseURL(source.url);
            const articles = [];

            console.log(`Found ${feed.items.length} items in ${source.name}`);

            for (const item of feed.items.slice(0, 10)) { // Limit to 10 most recent
                // Check if article is from last 24 hours
                const pubDate = new Date(item.pubDate || item.isoDate);
                const now = new Date();
                const hoursDiff = (now - pubDate) / (1000 * 60 * 60);

                // For testing, let's be more lenient with time (last 7 days)
                if (hoursDiff <= 168) { // 7 days instead of 24 hours for testing
                    const article = {
                        title: this.cleanText(item.title),
                        content: this.cleanText(item.contentSnippet || item.content || ''),
                        url: item.link,
                        timestamp: pubDate.toISOString(),
                        source: source.name,
                        category: source.category
                    };

                    // Try to get full content if snippet is too short
                    if (article.content.length < 100) {
                        try {
                            const fullContent = await this.scrapeArticleContent(item.link);
                            if (fullContent) {
                                article.content = fullContent;
                            }
                        } catch (error) {
                            console.log(`Could not scrape full content for ${item.title}`);
                        }
                    }

                    articles.push(article);
                    console.log(`Added article: ${article.title.substring(0, 50)}...`);
                }
            }

            console.log(`Scraped ${articles.length} articles from ${source.name}`);
            return articles;
        } catch (error) {
            console.error(`RSS parsing error for ${source.name}:`, error.message);
            return [];
        }
    }

    // Scrape web pages (for sources without RSS)
    async scrapeWebPage(source) {
        try {
            const response = await axios.get(source.url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            const $ = cheerio.load(response.data);
            const articles = [];

            // Common selectors for news articles
            const selectors = [
                'article',
                '.article',
                '.news-item',
                '.post',
                '.entry',
                '[class*="article"]',
                '[class*="news"]'
            ];

            let foundArticles = false;

            for (const selector of selectors) {
                const elements = $(selector);
                if (elements.length > 0) {
                    foundArticles = true;
                    
                    elements.slice(0, 10).each((index, element) => {
                        const $el = $(element);
                        const title = this.cleanText($el.find('h1, h2, h3, .title, .headline').first().text());
                        const link = $el.find('a').first().attr('href');
                        const content = this.cleanText($el.find('p, .content, .excerpt').first().text());
                        const dateText = $el.find('.date, .published, time').first().text();

                        if (title && link) {
                            const pubDate = this.parseDate(dateText) || new Date();
                            const hoursDiff = (new Date() - pubDate) / (1000 * 60 * 60);

                            if (hoursDiff <= 24) {
                                articles.push({
                                    title,
                                    content: content || '',
                                    url: this.resolveUrl(link, source.url),
                                    timestamp: pubDate.toISOString(),
                                    source: source.name,
                                    category: source.category
                                });
                            }
                        }
                    });
                    break;
                }
            }

            if (!foundArticles) {
                console.log(`No articles found for ${source.name} with standard selectors`);
            }

            return articles;
        } catch (error) {
            console.error(`Web scraping error for ${source.name}:`, error.message);
            return [];
        }
    }

    // Scrape full article content
    async scrapeArticleContent(url) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: this.timeout
            });

            const $ = cheerio.load(response.data);
            
            // Remove unwanted elements
            $('script, style, nav, header, footer, .advertisement, .ads').remove();
            
            // Try to find main content
            const contentSelectors = [
                '.article-content',
                '.post-content',
                '.entry-content',
                '.content',
                'article p',
                '.article p',
                'main p'
            ];

            for (const selector of contentSelectors) {
                const content = $(selector).text();
                if (content && content.length > 200) {
                    return this.cleanText(content);
                }
            }

            return null;
        } catch (error) {
            console.log(`Could not scrape content from ${url}:`, error.message);
            return null;
        }
    }

    // Clean and normalize text
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ' ')
            .trim()
            .substring(0, 2000); // Limit length
    }

    // Parse date from various formats
    parseDate(dateString) {
        if (!dateString) return null;
        
        try {
            // Try different date formats
            const formats = [
                /(\d{4}-\d{2}-\d{2})/,
                /(\d{1,2}\/\d{1,2}\/\d{4})/,
                /(\d{1,2}-\d{1,2}-\d{4})/,
                /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/
            ];

            for (const format of formats) {
                const match = dateString.match(format);
                if (match) {
                    const date = new Date(match[0]);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }
            }

            return new Date(dateString);
        } catch (error) {
            return null;
        }
    }

    // Resolve relative URLs
    resolveUrl(url, baseUrl) {
        try {
            if (url.startsWith('http')) {
                return url;
            }
            
            const base = new URL(baseUrl);
            return new URL(url, base.origin).href;
        } catch (error) {
            return url;
        }
    }
}

module.exports = NewsScraper;
