/**
 * Lightweight group data cache — lets the settings page render instantly
 * using data already fetched by the messages page.
 */
import type { GroupOut, GroupMember } from "./api";

interface GroupCacheEntry {
  group: GroupOut;
  members: GroupMember[];
}

const _cache = new Map<number, GroupCacheEntry>();

export function setGroupCache(id: number, group: GroupOut, members: GroupMember[]) {
  _cache.set(id, { group, members });
}

export function getGroupCache(id: number): GroupCacheEntry | undefined {
  return _cache.get(id);
}
