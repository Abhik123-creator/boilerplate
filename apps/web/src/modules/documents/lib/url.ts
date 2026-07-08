import type { DocumentPage } from '../api';

const ID_SUFFIX_LENGTH = 8;

/** Builds the URL segment for a page: a readable slug with a short id suffix so links stay stable across title/slug changes. */
export function pageUrlSegment(page: Pick<DocumentPage, 'slug' | 'id'>): string {
  return `${page.slug}-${page.id.slice(0, ID_SUFFIX_LENGTH)}`;
}

/** Resolves a page from a URL segment, supporting slug+id, bare id, and legacy bare-slug links. */
export function resolvePageFromSegment(pages: DocumentPage[], segment?: string): DocumentPage | undefined {
  if (!segment) return undefined;

  const byId = pages.find((p) => p.id === segment);
  if (byId) return byId;

  const suffixMatch = segment.match(/-([0-9a-f]{8})$/i);
  if (suffixMatch) {
    const byIdPrefix = pages.find((p) => p.id.startsWith(suffixMatch[1]));
    if (byIdPrefix) return byIdPrefix;
  }

  return pages.find((p) => p.slug === segment);
}
