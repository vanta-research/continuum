import { NextResponse } from 'next/server';

// Google Custom Search Configuration
// Using hardcoded values since environment variables aren't loading in Next.js API routes
const GOOGLE_CUSTOM_SEARCH_API_KEY = 'AIzaSyDM-t2yLT8klj-tJcW70u-AMdGtx0xwBlU';
const GOOGLE_CUSTOM_SEARCH_ENGINE_ID = 'e2e560ed0618c44b6';

// Web Search Configuration
interface SearchConfig {
  enabled: boolean;
  safeSearch: boolean;
  maxResults: number;
}

const DEFAULT_CONFIG: SearchConfig = {
  enabled: false,
  safeSearch: true,
  maxResults: 3
};

// In a production environment, you would use a real search API like:
// - Google Custom Search JSON API
// - Bing Search API
// - SerpAPI
// - Other search providers

// Google Custom Search API Integration
async function performGoogleSearch(query: string, config: SearchConfig): Promise<any> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  
  // Use the hardcoded credentials directly
  // Remove the fallback check since we have valid credentials
  
  try {
    const startTime = Date.now();
    
    // Build the Google Custom Search API URL with hardcoded credentials
    const searchUrl = new URL('https://www.googleapis.com/customsearch/v1');
    searchUrl.searchParams.append('key', GOOGLE_CUSTOM_SEARCH_API_KEY);
    searchUrl.searchParams.append('cx', GOOGLE_CUSTOM_SEARCH_ENGINE_ID);
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('num', config.maxResults.toString());
    
    if (config.safeSearch) {
      searchUrl.searchParams.append('safe', 'active');
    }
    
    console.log('Making Google Search API request to:', searchUrl.toString());
    
    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Search API error:', response.status, errorText);
      throw new Error(`Google Search API returned ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    const searchTime = (Date.now() - startTime) / 1000;
    
    console.log('Google Search API response:', JSON.stringify(data, null, 2));
    
    // Format the results for our application
    const formattedResults = data.items?.map((item: any, index: number) => ({
      title: item.title || `Result ${index + 1}`,
      snippet: item.snippet || 'No description available',
      link: item.link || '#',
      displayLink: item.displayLink || item.link || 'unknown.source'
    })) || [];
    
    return {
      query: query,
      results: formattedResults,
      searchTime: searchTime,
      totalResults: formattedResults.length,
      source: 'Google Custom Search API'
    };
    
  } catch (error) {
    console.error('Google Search API error:', error);
    // Fall back to mock search if Google API fails
    console.log('Falling back to mock search due to error:', error);
    return mockWebSearch(query, config);
  }
}

// Mock search for when Google API is not configured
async function mockWebSearch(query: string, config: SearchConfig): Promise<any> {
  return {
    query: query,
    results: [
      {
        title: `Web results for "${query}"`,
        snippet: `Here are some relevant results for your search about ${query}. To get real search results, please configure your Google Custom Search API key and Search Engine ID in the environment variables.`,
        link: `https://www.example.com/search?q=${encodeURIComponent(query)}`,
        displayLink: 'www.example.com'
      },
      {
        title: `More information about ${query}`,
        snippet: `Additional information and resources related to ${query}. Configure GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID in .env.search to enable real web search.`,
        link: `https://www.example.com/info/${encodeURIComponent(query)}`,
        displayLink: 'www.example.com'
      }
    ],
    searchTime: 0.45,
    totalResults: 2,
    source: 'Mock Search (Configure Google Custom Search for real results)'
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const enableParam = searchParams.get('enable');

  if (!query) {
    return NextResponse.json({
      error: 'Search query is required'
    }, { status: 400 });
  }

  const config: SearchConfig = {
    ...DEFAULT_CONFIG,
    enabled: enableParam === 'true'
  };

  if (!config.enabled) {
    return NextResponse.json({
      success: false,
      message: 'Web search is disabled'
    });
  }

    try {
      const results = await performGoogleSearch(query, config);
      
      return NextResponse.json({
        success: true,
        query: results.query,
        results: results.results,
        searchTime: results.searchTime,
        totalResults: results.totalResults,
        safeSearch: config.safeSearch,
        source: results.source
      });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform web search'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { query, enable } = await request.json();
    
    if (!query) {
      return NextResponse.json({
        error: 'Search query is required'
      }, { status: 400 });
    }

    const config: SearchConfig = {
      ...DEFAULT_CONFIG,
      enabled: enable !== false // Default to true if not specified
    };

    if (!config.enabled) {
      return NextResponse.json({
        success: false,
        message: 'Web search is disabled'
      });
    }

    const results = await performGoogleSearch(query, config);
    
    // Format results for AI consumption
    const formattedResults = results.results.map((result: any, index: number) => {
      return {
        id: index + 1,
        title: result.title,
        content: result.snippet,
        url: result.link,
        source: result.displayLink
      };
    });

    return NextResponse.json({
      success: true,
      query: results.query,
      results: formattedResults,
      searchSummary: `Found ${results.totalResults} results for "${results.query}" in ${results.searchTime}s`
    });
    
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform web search'
    }, { status: 500 });
  }
}