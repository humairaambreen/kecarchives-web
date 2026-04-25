/**
 * Module-level cache for shared post/profile data in DM bubbles.
 * Keyed by slug (posts) or username (profiles). Never re-fetches after first load.
 */
import type { Post, UserProfile } from "./api";

export const postCache = new Map<string, Post | "loading" | "error">();
export const profileCache = new Map<string, UserProfile | "loading" | "error">();

/** Returns true if content is a plain @username mention (profile share) */
export function isProfileMention(content: string): boolean {
  return /^@[a-zA-Z0-9_]{1,40}$/.test(content.trim());
}

/** Returns true if content is an internal post URL like /username/slug */
export function isPostUrl(content: string): boolean {
  // Matches absolute or relative URLs with exactly two path segments
  const rel = content.trim().replace(/^https?:\/\/[^/]+/, "");
  return /^\/[a-zA-Z0-9_@.-]+\/[a-zA-Z0-9_-]+-\d+$/.test(rel);
}

/** Extract slug and author username from a post URL */
export function parsePostUrl(content: string): { slug: string; authorUsername: string } | null {
  const rel = content.trim().replace(/^https?:\/\/[^/]+/, "");
  const m = rel.match(/^\/([a-zA-Z0-9_@.-]+)\/([a-zA-Z0-9_-]+-\d+)$/);
  if (!m) return null;
  return { authorUsername: m[1], slug: m[2] };
}

/** Human-readable preview shown in conversation list */
export function sharePreview(content: string): string {
  if (isProfileMention(content)) return `Shared profile ${content}`;
  if (isPostUrl(content)) return "Shared a post";
  return content;
}
