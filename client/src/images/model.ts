// Mirrors server/src/config/constants.ts IMAGE_QUOTA_BYTES — kept as a
// separate constant (not shared/imported) since client and server are
// separate deployables here. Used only for the client-side pre-check
// described in the README; the server enforces its own copy atomically.
export const IMAGE_QUOTA_BYTES = 25 * 1024 * 1024;

export type LocalImage = {
  id: string;
  blob: Blob;
  bytes: number;
  createdAt: number;
  // Set once the background upload to the server succeeds. Never
  // retried automatically — matches the rest of sync being explicit.
  remoteId: string | null;
};

const LOCAL_IMAGE_PREFIX = "local-image:";

export const localImageHref = (id: string) => `${LOCAL_IMAGE_PREFIX}${id}`;

export const parseLocalImageHref = (href: string): string | null =>
  href.startsWith(LOCAL_IMAGE_PREFIX)
    ? href.slice(LOCAL_IMAGE_PREFIX.length)
    : null;

// Matches a local-image ref wherever it appears in raw markdown source
// (inside the parens of ![alt](local-image:<id>)) — id runs up to the
// closing paren or whitespace, same boundary a real URL would use.
const LOCAL_IMAGE_REF = new RegExp(`${LOCAL_IMAGE_PREFIX}([^)\\s]+)`, "g");

export const findLocalImageIds = (content: string): string[] =>
  Array.from(content.matchAll(LOCAL_IMAGE_REF), (match) => match[1]);

export const rewriteLocalImageRefs = (
  content: string,
  resolve: (id: string) => string,
): string => content.replace(LOCAL_IMAGE_REF, (_match, id: string) => resolve(id));
