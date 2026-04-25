/**
 * Global feed store — lives outside React so state survives page navigation.
 * The feed component reads from / writes to this store instead of local state.
 */
import type { Post, Subject } from "./api";

interface LikeState { liked: boolean; count: number; }

interface FeedStore {
  activeTab: string;
  postsByTab: Map<string, Post[]>;   // cached posts per tab key
  mySubjects: Subject[];
  subjectsLoaded: boolean;
  batchFilter: number | undefined;
  likeState: Map<number, LikeState>; // postId → live like state
}

// Single module-level singleton — persists for the app session
const store: FeedStore = {
  activeTab: "all",
  postsByTab: new Map(),
  mySubjects: [],
  subjectsLoaded: false,
  batchFilter: undefined,
  likeState: new Map(),
};

export function getFeedStore() {
  return store;
}

export function setFeedActiveTab(tab: string) {
  store.activeTab = tab;
}

export function setFeedBatchFilter(v: number | undefined) {
  store.batchFilter = v;
}

export function setCachedPosts(tabKey: string, posts: Post[]) {
  store.postsByTab.set(tabKey, posts);
}

export function getCachedPosts(tabKey: string): Post[] | undefined {
  return store.postsByTab.get(tabKey);
}

export function setFeedSubjects(subjects: Subject[]) {
  store.mySubjects = subjects;
  store.subjectsLoaded = true;
}

/** Call when user logs out or changes — clears all cached posts and subjects */
export function clearFeedStore() {
  store.activeTab = "all";
  store.postsByTab.clear();
  store.mySubjects = [];
  store.subjectsLoaded = false;
  store.batchFilter = undefined;
  store.likeState.clear();
}

/** Get the live like state for a post (falls back to undefined if never interacted) */
export function getLikeState(postId: number): LikeState | undefined {
  return store.likeState.get(postId);
}

/** Update the live like state for a post */
export function setLikeState(postId: number, liked: boolean, count: number) {
  store.likeState.set(postId, { liked, count });
  // Also patch every tab cache so re-renders get the correct prop values
  store.postsByTab.forEach((posts, key) => {
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx !== -1) {
      const updated = [...posts];
      updated[idx] = { ...updated[idx], user_reacted: liked, reactions_count: count };
      store.postsByTab.set(key, updated);
    }
  });
}

/** Evict a deleted post from every tab cache */
export function evictPost(postId: number) {
  store.postsByTab.forEach((posts, key) => {
    store.postsByTab.set(key, posts.filter((p) => p.id !== postId));
  });
}
