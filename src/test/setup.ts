import { vi } from 'vitest';

// Mock the @atproto/api module
vi.mock('@atproto/api', () => ({
  BskyAgent: vi.fn().mockImplementation(() => ({
    getProfiles: vi.fn(),
    getProfile: vi.fn(),
    getAuthorFeed: vi.fn()
  }))
}));

// Mock wink-sentiment
vi.mock('wink-sentiment', () => ({
  default: vi.fn().mockImplementation((text: string) => {
    // Simple mock sentiment analysis based on keywords
    const positiveWords = ['great', 'amazing', 'love', 'excellent', 'fantastic', 'brilliant'];
    const negativeWords = ['terrible', 'awful', 'hate', 'bad', 'disappointing', 'poor'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return { score: 1 };
    if (negativeCount > positiveCount) return { score: -1 };
    return { score: 0 };
  })
}));

// Mock global fetch
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

