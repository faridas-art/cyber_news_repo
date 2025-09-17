# 🛡️ CyberNews Aggregator

A real-time cybersecurity news aggregator that scrapes multiple sources, provides TLDR summaries, and scores news by confidence level based on source overlap.

## ✨ Features

- **Real-time News Scraping**: Monitors 10+ cybersecurity news sources
- **24-Hour Focus**: Shows only news from the past 24 hours
- **TLDR Summaries**: Concise summaries for quick reading
- **Confidence Scoring**: High/Medium/Low based on number of sources
- **Expandable Details**: Full articles with source references
- **Auto-refresh**: Updates every 30 minutes
- **Modern UI**: Dark theme with responsive design
- **Source Attribution**: Direct links to original articles

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cyber_news_repo.git
   cd cyber_news_repo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 📰 News Sources

The aggregator monitors these cybersecurity news sources:

- Krebs on Security
- The Hacker News
- Dark Reading
- Bleeping Computer
- Threatpost
- SecurityWeek
- CSO Online
- InfoSec Magazine
- SC Magazine
- Cybersecurity News

## 🔧 Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Key settings:
- `PORT`: Server port (default: 3000)
- `SCRAPE_INTERVAL_MINUTES`: How often to scrape news (default: 30)
- `MAX_ARTICLES_PER_SOURCE`: Max articles per source (default: 10)

### Adding New Sources

Edit `server.js` and add to the `newsSources` array:

```javascript
{
    name: "Your Source Name",
    url: "https://yoursource.com/feed/",
    type: "rss", // or "web"
    category: "general",
    weight: 1.0
}
```

## 🏗️ Architecture

### Backend (Node.js + Express)
- **server.js**: Main server with API endpoints
- **scraper.js**: News scraping logic
- **RSS Parser**: For RSS feed sources
- **Web Scraper**: For non-RSS sources
- **Deduplication**: Merges similar articles from multiple sources

### Frontend (Vanilla JavaScript)
- **Real-time Updates**: Fetches data from API
- **Responsive Design**: Works on all devices
- **Interactive UI**: Filter by confidence, expand details
- **Auto-refresh**: Keeps content current

## 📊 API Endpoints

- `GET /api/news` - Get all news articles
- `GET /api/news?confidence=high` - Filter by confidence
- `GET /api/stats` - Get statistics
- `POST /api/refresh` - Manually refresh news

## 🎯 Confidence Scoring

- **High**: 5+ sources reporting the same story
- **Medium**: 2-4 sources
- **Low**: 1 source

## 🛠️ Development

### Run in Development Mode
```bash
npm run dev
```

### Manual Scraping
```bash
npm run scrape
```

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## ⚠️ Disclaimer

This tool is for educational and informational purposes. Always verify information from multiple sources and respect website terms of service when scraping.
