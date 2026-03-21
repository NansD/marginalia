import { canonicalizeUrl } from '@/shared/url/canonicalizeUrl';

describe('canonicalizeUrl', () => {
  it('strips tracking query params and ordinary hash anchors', () => {
    expect(
      canonicalizeUrl('https://example.com/article?utm_source=newsletter&foo=bar&fbclid=abc123#section-2'),
    ).toBe('https://example.com/article?foo=bar');
  });

  it('preserves hash-router URLs', () => {
    expect(canonicalizeUrl('https://example.com/app?source=rss#/notes/123')).toBe(
      'https://example.com/app#/notes/123',
    );
    expect(canonicalizeUrl('https://example.com/app#!/workspace?utm_campaign=launch')).toBe(
      'https://example.com/app#!/workspace?utm_campaign=launch',
    );
  });

  it('keeps non-tracking query params intact', () => {
    expect(canonicalizeUrl('https://example.com/search?q=annotations&page=2')).toBe(
      'https://example.com/search?q=annotations&page=2',
    );
  });
});
