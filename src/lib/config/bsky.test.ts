import { describe, it, expect } from 'vitest';
import {
  BSKY_APPVIEW_BASE,
  BSKY_MIN_FOLLOWERS,
  BSKY_MIN_ACCOUNT_MONTHS,
  BSKY_MAX_ACCOUNTS,
  BSKY_KEYWORDS,
  BSKY_ALLOWLIST,
  DEFAULT_RECENCY_MINUTES,
  DEFAULT_TICK_INTERVAL_SEC
} from './bsky';

describe('bsky config', () => {
  describe('API Configuration', () => {
    it('should have correct appview base URL', () => {
      expect(BSKY_APPVIEW_BASE).toBe('https://public.api.bsky.app/xrpc');
    });
  });

  describe('Eligibility Configuration', () => {
    it('should have reasonable minimum followers threshold', () => {
      expect(BSKY_MIN_FOLLOWERS).toBe(500);
      expect(typeof BSKY_MIN_FOLLOWERS).toBe('number');
      expect(BSKY_MIN_FOLLOWERS).toBeGreaterThan(0);
    });

    it('should have reasonable minimum account age', () => {
      expect(BSKY_MIN_ACCOUNT_MONTHS).toBe(6);
      expect(typeof BSKY_MIN_ACCOUNT_MONTHS).toBe('number');
      expect(BSKY_MIN_ACCOUNT_MONTHS).toBeGreaterThan(0);
    });

    it('should have reasonable maximum accounts limit', () => {
      expect(BSKY_MAX_ACCOUNTS).toBe(40);
      expect(typeof BSKY_MAX_ACCOUNTS).toBe('number');
      expect(BSKY_MAX_ACCOUNTS).toBeGreaterThan(0);
      expect(BSKY_MAX_ACCOUNTS).toBeLessThanOrEqual(100); // Reasonable upper bound
    });
  });

  describe('Keywords Configuration', () => {
    it('should contain Arsenal-related keywords', () => {
      expect(BSKY_KEYWORDS).toContain('Arsenal');
      expect(BSKY_KEYWORDS).toContain('AFC');
      expect(BSKY_KEYWORDS).toContain('COYG');
    });

    it('should contain player names', () => {
      expect(BSKY_KEYWORDS).toContain('Arteta');
      expect(BSKY_KEYWORDS).toContain('Saka');
      expect(BSKY_KEYWORDS).toContain('Odegaard');
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(BSKY_KEYWORDS)).toBe(true);
      expect(BSKY_KEYWORDS.every(keyword => typeof keyword === 'string')).toBe(true);
    });

    it('should not contain empty strings', () => {
      expect(BSKY_KEYWORDS.every(keyword => keyword.length > 0)).toBe(true);
    });
  });

  describe('Allowlist Configuration', () => {
    it('should contain valid Bluesky handles', () => {
      expect(Array.isArray(BSKY_ALLOWLIST)).toBe(true);
      expect(BSKY_ALLOWLIST.length).toBeGreaterThan(0);
    });

    it('should contain expected Arsenal-related handles', () => {
      expect(BSKY_ALLOWLIST).toContain('arseblog.com');
      expect(BSKY_ALLOWLIST).toContain('gunnerblog.bsky.social');
      expect(BSKY_ALLOWLIST).toContain('ltarsenal.bsky.social');
      expect(BSKY_ALLOWLIST).toContain('afcstuff.bsky.social');
      expect(BSKY_ALLOWLIST).toContain('goonertalk.bsky.social');
    });

    it('should have valid handle formats', () => {
      const handlePattern = /^[a-zA-Z0-9.-]+(\.bsky\.social|\.com)$/;
      expect(BSKY_ALLOWLIST.every(handle => handlePattern.test(handle))).toBe(true);
    });
  });

  describe('Time Configuration', () => {
    it('should have reasonable default recency minutes', () => {
      expect(DEFAULT_RECENCY_MINUTES).toBe(10);
      expect(typeof DEFAULT_RECENCY_MINUTES).toBe('number');
      expect(DEFAULT_RECENCY_MINUTES).toBeGreaterThan(0);
      expect(DEFAULT_RECENCY_MINUTES).toBeLessThanOrEqual(60); // Not too long
    });

    it('should have reasonable default tick interval', () => {
      expect(DEFAULT_TICK_INTERVAL_SEC).toBe(10);
      expect(typeof DEFAULT_TICK_INTERVAL_SEC).toBe('number');
      expect(DEFAULT_TICK_INTERVAL_SEC).toBeGreaterThan(0);
      expect(DEFAULT_TICK_INTERVAL_SEC).toBeLessThanOrEqual(60); // Not too frequent
    });
  });

  describe('Configuration Validation', () => {
    it('should have consistent configuration values', () => {
      // Max accounts should be reasonable for rate limiting
      expect(BSKY_MAX_ACCOUNTS).toBeLessThanOrEqual(50);
      
      // Tick interval should allow for reasonable data collection
      expect(DEFAULT_TICK_INTERVAL_SEC).toBeGreaterThanOrEqual(5);
      
      // Recency window should be reasonable for live updates
      expect(DEFAULT_RECENCY_MINUTES).toBeGreaterThanOrEqual(5);
      expect(DEFAULT_RECENCY_MINUTES).toBeLessThanOrEqual(30);
    });

    it('should have non-empty allowlist', () => {
      expect(BSKY_ALLOWLIST.length).toBeGreaterThan(0);
    });

    it('should have non-empty keywords list', () => {
      expect(BSKY_KEYWORDS.length).toBeGreaterThan(0);
    });
  });
});

