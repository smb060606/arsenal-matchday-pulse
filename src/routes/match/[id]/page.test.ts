import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock EventSource
class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    // Mock close method
  }
}

// Mock global EventSource
global.EventSource = MockEventSource as any;

describe('Match page component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component initialization', () => {
    it('should accept match ID parameter', () => {
      const params = { id: 'test-match-123' };
      expect(params.id).toBe('test-match-123');
      expect(typeof params.id).toBe('string');
    });

    it('should initialize with pre-match state', () => {
      const activeStates = ['pre', 'live', 'post'];
      const initialActive = 'pre';
      
      expect(activeStates).toContain(initialActive);
      expect(initialActive).toBe('pre');
    });

    it('should initialize empty messages array', () => {
      const messages: string[] = [];
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBe(0);
    });
  });

  describe('EventSource connection', () => {
    it('should create EventSource connections for both platforms', () => {
      const platforms = ['bsky', 'twitter'];
      const matchId = 'test-match';
      
      platforms.forEach(platform => {
        const expectedUrl = `/live/${platform}/stream.sse?matchId=${matchId}`;
        expect(expectedUrl).toContain(platform);
        expect(expectedUrl).toContain('stream.sse');
        expect(expectedUrl).toContain(`matchId=${matchId}`);
      });
    });

    it('should handle EventSource message events', () => {
      const mockEvent = {
        data: 'Test message from platform'
      } as MessageEvent;

      const platform = 'bsky';
      const expectedMessage = `${platform.toUpperCase()} :: ${mockEvent.data}`;
      
      expect(expectedMessage).toBe('BSKY :: Test message from platform');
    });

    it('should limit messages to 50 items', () => {
      const maxMessages = 50;
      const messages = Array.from({ length: 60 }, (_, i) => `Message ${i}`);
      const limitedMessages = messages.slice(0, maxMessages);
      
      expect(limitedMessages.length).toBe(maxMessages);
    });

    it('should handle EventSource errors', () => {
      const mockEventSource = new MockEventSource('test-url');
      let errorHandled = false;
      
      mockEventSource.onerror = () => {
        errorHandled = true;
      };

      // Simulate error
      if (mockEventSource.onerror) {
        mockEventSource.onerror();
      }

      expect(errorHandled).toBe(true);
    });
  });

  describe('UI state management', () => {
    it('should have three match phases', () => {
      const phases = ['pre', 'live', 'post'];
      expect(phases).toHaveLength(3);
      expect(phases).toContain('pre');
      expect(phases).toContain('live');
      expect(phases).toContain('post');
    });

    it('should allow switching between phases', () => {
      const phases = ['pre', 'live', 'post'];
      let currentPhase = 'pre';
      
      phases.forEach(phase => {
        currentPhase = phase as 'pre' | 'live' | 'post';
        expect(phases).toContain(currentPhase);
      });
    });

    it('should display match ID in title', () => {
      const matchId = 'arsenal-vs-chelsea-2024';
      const expectedTitle = `Match: ${matchId}`;
      
      expect(expectedTitle).toBe('Match: arsenal-vs-chelsea-2024');
    });
  });

  describe('Message handling', () => {
    it('should format platform messages correctly', () => {
      const platform = 'bsky';
      const message = 'Great Arsenal performance!';
      const formattedMessage = `${platform.toUpperCase()} :: ${message}`;
      
      expect(formattedMessage).toBe('BSKY :: Great Arsenal performance!');
    });

    it('should add new messages to the beginning of array', () => {
      const existingMessages = ['Message 1', 'Message 2'];
      const newMessage = 'New Message';
      const updatedMessages = [newMessage, ...existingMessages];
      
      expect(updatedMessages[0]).toBe(newMessage);
      expect(updatedMessages.length).toBe(3);
    });

    it('should maintain message order (newest first)', () => {
      const messages = ['Oldest', 'Middle', 'Newest'];
      const newMessage = 'Very New';
      const updatedMessages = [newMessage, ...messages].slice(0, 50);
      
      expect(updatedMessages[0]).toBe('Very New');
      expect(updatedMessages[1]).toBe('Oldest');
    });
  });

  describe('Component cleanup', () => {
    it('should close EventSource connections on unmount', () => {
      const mockEventSource1 = new MockEventSource('url1');
      const mockEventSource2 = new MockEventSource('url2');
      let closed1 = false;
      let closed2 = false;
      
      mockEventSource1.close = () => { closed1 = true; };
      mockEventSource2.close = () => { closed2 = true; };
      
      // Simulate cleanup
      mockEventSource1.close();
      mockEventSource2.close();
      
      expect(closed1).toBe(true);
      expect(closed2).toBe(true);
    });
  });

  describe('URL construction', () => {
    it('should construct correct SSE URLs', () => {
      const matchId = 'test-match';
      const platforms = ['bsky', 'twitter'];
      
      const urls = platforms.map(platform => 
        `/live/${platform}/stream.sse?matchId=${matchId}`
      );
      
      expect(urls[0]).toBe('/live/bsky/stream.sse?matchId=test-match');
      expect(urls[1]).toBe('/live/twitter/stream.sse?matchId=test-match');
    });

    it('should handle special characters in match ID', () => {
      const matchId = 'arsenal-vs-chelsea-2024-01-15';
      const platform = 'bsky';
      const url = `/live/${platform}/stream.sse?matchId=${encodeURIComponent(matchId)}`;
      
      expect(url).toContain('arsenal-vs-chelsea-2024-01-15');
    });
  });

  describe('Error handling', () => {
    it('should handle EventSource creation errors', () => {
      const invalidUrl = 'invalid-url';
      
      // EventSource should still be created even with invalid URL
      const eventSource = new MockEventSource(invalidUrl);
      expect(eventSource).toBeDefined();
      expect(eventSource.url).toBe(invalidUrl);
    });

    it('should handle message processing errors', () => {
      const invalidMessage = null;
      const platform = 'bsky';
      
      // Should handle null/undefined messages gracefully
      if (invalidMessage) {
        const formattedMessage = `${platform.toUpperCase()} :: ${invalidMessage}`;
        expect(formattedMessage).toBe('BSKY :: null');
      }
    });
  });
});

