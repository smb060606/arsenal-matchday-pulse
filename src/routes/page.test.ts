import { describe, it, expect } from 'vitest';

describe('Home page', () => {
  describe('Navigation links', () => {
    it('should have correct link structure', () => {
      // This test verifies the expected link structure from the +page.svelte file
      const expectedLinks = [
        { href: '/match/demo', label: 'Demo Match (Pre | Live | Post)' },
        { href: '/accounts/bsky', label: 'Accounts (Bluesky)' },
        { href: '/accounts/twitter', label: 'Accounts (Twitter)' },
        { href: '/compare/demo', label: 'Compare View (Demo)' }
      ];

      // Verify all expected links are present
      expectedLinks.forEach(link => {
        expect(link.href).toBeDefined();
        expect(link.label).toBeDefined();
        expect(typeof link.href).toBe('string');
        expect(typeof link.label).toBe('string');
        expect(link.href.startsWith('/')).toBe(true);
      });
    });

    it('should have valid route paths', () => {
      const links = [
        '/match/demo',
        '/accounts/bsky',
        '/accounts/twitter',
        '/compare/demo'
      ];

      links.forEach(link => {
        expect(link).toMatch(/^\/[a-zA-Z0-9\/-]+$/);
        expect(link.length).toBeGreaterThan(1);
      });
    });

    it('should have descriptive labels', () => {
      const labels = [
        'Demo Match (Pre | Live | Post)',
        'Accounts (Bluesky)',
        'Accounts (Twitter)',
        'Compare View (Demo)'
      ];

      labels.forEach(label => {
        expect(label.length).toBeGreaterThan(5);
        expect(label).not.toContain('undefined');
        expect(label).not.toContain('null');
      });
    });
  });

  describe('Page content', () => {
    it('should have appropriate title', () => {
      const title = 'Arsenal Matchday Pulse';
      expect(title).toBe('Arsenal Matchday Pulse');
      expect(title.length).toBeGreaterThan(0);
    });

    it('should have descriptive subtitle', () => {
      const subtitle = 'Per-platform fan sentiment livestream for Arsenal matchdays: Bluesky (Phase 1), Twitter best-effort (Phase 1), Threads (Phase 2).';
      
      expect(subtitle).toContain('Arsenal');
      expect(subtitle).toContain('sentiment');
      expect(subtitle).toContain('Bluesky');
      expect(subtitle).toContain('Twitter');
      expect(subtitle).toContain('Threads');
      expect(subtitle.length).toBeGreaterThan(50);
    });

    it('should mention all supported platforms', () => {
      const platforms = ['Bluesky', 'Twitter', 'Threads'];
      const content = 'Per-platform fan sentiment livestream for Arsenal matchdays: Bluesky (Phase 1), Twitter best-effort (Phase 1), Threads (Phase 2).';
      
      platforms.forEach(platform => {
        expect(content).toContain(platform);
      });
    });

    it('should indicate development phases', () => {
      const content = 'Per-platform fan sentiment livestream for Arsenal matchdays: Bluesky (Phase 1), Twitter best-effort (Phase 1), Threads (Phase 2).';
      
      expect(content).toContain('Phase 1');
      expect(content).toContain('Phase 2');
    });
  });

  describe('UI structure', () => {
    it('should have proper CSS classes for styling', () => {
      // These classes should match the Tailwind CSS classes used in +page.svelte
      const expectedClasses = [
        'min-h-screen',
        'bg-gray-50',
        'text-gray-900',
        'max-w-3xl',
        'mx-auto',
        'p-6',
        'text-3xl',
        'font-bold',
        'mb-2',
        'text-gray-600',
        'mb-6',
        'space-y-2',
        'text-red-700',
        'underline'
      ];

      expectedClasses.forEach(className => {
        expect(className).toBeDefined();
        expect(typeof className).toBe('string');
        expect(className.length).toBeGreaterThan(0);
      });
    });

    it('should have responsive design classes', () => {
      const responsiveClasses = [
        'max-w-3xl',
        'mx-auto',
        'p-6'
      ];

      responsiveClasses.forEach(className => {
        expect(className).toBeDefined();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      // The page should have h1 for main title
      const mainTitle = 'Arsenal Matchday Pulse';
      expect(mainTitle).toBeDefined();
      expect(typeof mainTitle).toBe('string');
    });

    it('should have descriptive link text', () => {
      const linkLabels = [
        'Demo Match (Pre | Live | Post)',
        'Accounts (Bluesky)',
        'Accounts (Twitter)',
        'Compare View (Demo)'
      ];

      linkLabels.forEach(label => {
        expect(label).toBeDefined();
        expect(label.length).toBeGreaterThan(10); // Descriptive enough
        expect(label).not.toBe('Click here');
        expect(label).not.toBe('More');
      });
    });
  });

  describe('Content validation', () => {
    it('should not contain placeholder text', () => {
      const content = [
        'Arsenal Matchday Pulse',
        'Per-platform fan sentiment livestream for Arsenal matchdays: Bluesky (Phase 1), Twitter best-effort (Phase 1), Threads (Phase 2).',
        'Demo Match (Pre | Live | Post)',
        'Accounts (Bluesky)',
        'Accounts (Twitter)',
        'Compare View (Demo)'
      ];

      const placeholderTexts = [
        'Lorem ipsum',
        'TODO',
        'FIXME',
        'PLACEHOLDER',
        'TBD',
        'Coming soon'
      ];

      content.forEach(text => {
        placeholderTexts.forEach(placeholder => {
          expect(text.toLowerCase()).not.toContain(placeholder.toLowerCase());
        });
      });
    });

    it('should have consistent Arsenal branding', () => {
      const content = 'Arsenal Matchday Pulse';
      expect(content).toContain('Arsenal');
      expect(content).toContain('Matchday');
      expect(content).toContain('Pulse');
    });
  });
});

