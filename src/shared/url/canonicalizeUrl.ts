const TRACKING_PARAM_NAMES = new Set(['fbclid', 'gclid', 'ref', 'source']);

const shouldStripTrackingParam = (paramName: string): boolean => {
  const normalizedName = paramName.toLowerCase();

  return normalizedName.startsWith('utm_') || TRACKING_PARAM_NAMES.has(normalizedName);
};

const shouldPreserveHash = (hash: string): boolean => hash.startsWith('#/') || hash.startsWith('#!/');

export const canonicalizeUrl = (input: string | URL): string => {
  const url = input instanceof URL ? new URL(input.toString()) : new URL(input);

  Array.from(url.searchParams.keys()).forEach((paramName) => {
    if (shouldStripTrackingParam(paramName)) {
      url.searchParams.delete(paramName);
    }
  });

  if (!shouldPreserveHash(url.hash)) {
    url.hash = '';
  }

  return url.toString();
};
