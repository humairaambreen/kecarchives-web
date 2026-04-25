import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

type FetchOptions = RequestInit & { skipAuth?: boolean };

// ── Token refresh ─────────────────────────────────────────────────────────────
// One in-flight refresh at a time; concurrent 401s all share the same promise.
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async (): Promise<boolean> => {
    const refreshToken = Cookies.get("refresh_token");
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.status === 401 || res.status === 403) {
        // Refresh token is definitively rejected — clear everything.
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        return false;
      }

      if (!res.ok) {
        // Transient failure (server error, cold-start, network blip).
        // Do NOT clear tokens — the refresh token is probably still valid.
        return false;
      }

      const data = await res.json() as { access_token: string; refresh_token: string };
      Cookies.set("access_token", data.access_token, { sameSite: "lax", expires: 365 });
      Cookies.set("refresh_token", data.refresh_token, { sameSite: "lax", expires: 365 });
      return true;
    } catch {
      // Network error — do NOT clear tokens.
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export { tryRefreshToken };

// ── Core fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { skipAuth, ...init } = opts;
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    const token = Cookies.get("access_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Auto-refresh on 401 then retry once
  if (res.status === 401 && !skipAuth) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = Cookies.get("access_token");
      if (newToken) headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else if (!Cookies.get("refresh_token")) {
      // Refresh token is definitively gone (cleared by tryRefreshToken on 401/403).
      // Only NOW signal the app to sign out.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth-expired"));
      }
      // If refresh token still exists but refresh failed transiently, do nothing here —
      // the proactive timer in auth-context will retry before the next expiry.
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Auth ──
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  role: "guest" | "student" | "faculty" | "admin";
  bio?: string | null;
  avatar_base64?: string | null;
  banner_base64?: string | null;
  username?: string | null;
  batch_year?: number | null;
}

export interface UpdateProfilePayload {
  full_name: string;
  bio?: string | null;
  avatar_base64: string | null;
  banner_base64: string | null;
  username?: string | null;
}

export const auth = {
  register(full_name: string, username: string, email: string, password: string) {
    return apiFetch<TokenPair>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, username, email, password }),
      skipAuth: true,
    });
  },

  login(identifier: string, password: string) {
    return apiFetch<TokenPair>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
      skipAuth: true,
    });
  },

  logout() {
    return apiFetch("/api/v1/auth/logout", { method: "POST" });
  },

  sendOtp(email: string, purpose: "verify" | "reset" | "admin" = "verify") {
    return apiFetch("/api/v1/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email, purpose }),
      skipAuth: true,
    });
  },

  verifyOtp(email: string, otp: string) {
    return apiFetch<{ verified: boolean }>("/api/v1/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
      skipAuth: true,
    });
  },

  forgotPassword(email: string) {
    return apiFetch("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  resetPassword(email: string, otp: string, new_password: string) {
    return apiFetch("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password }),
      skipAuth: true,
    });
  },

  me() {
    return apiFetch<UserProfile>("/api/v1/auth/me");
  },

  checkAdmin(email: string) {
    return apiFetch<{ is_admin_email: boolean }>("/api/v1/auth/check-admin", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  adminLogin(email: string, password: string) {
    return apiFetch<{ success: boolean }>("/api/v1/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
  },

  verifyAdminOtp(email: string, otp: string) {
    return apiFetch<TokenPair>("/api/v1/auth/verify-admin-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
      skipAuth: true,
    });
  },

  profile(userId: number) {
    return apiFetch<UserProfile>(`/api/v1/auth/profile/${userId}`);
  },

  searchUsers(query: string) {
    return apiFetch<UserProfile[]>(`/api/v1/auth/search?q=${encodeURIComponent(query)}`);
  },

  updateMe(payload: UpdateProfilePayload) {
    return apiFetch<UserProfile>("/api/v1/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteMe(password: string) {
    return apiFetch<{ message: string }>("/api/v1/auth/me", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  },

  checkUsername(username: string) {
    return apiFetch<{ available: boolean; username: string }>("/api/v1/auth/check-username", {
      method: "POST",
      body: JSON.stringify({ username }),
      skipAuth: true,
    });
  },

  checkEmail(email: string) {
    return apiFetch<{ registered: boolean }>("/api/v1/auth/check-email", {
      method: "POST",
      body: JSON.stringify({ email }),
      skipAuth: true,
    });
  },

  profileByUsername(username: string) {
    return apiFetch<UserProfile>(`/api/v1/auth/profile/by-username/${encodeURIComponent(username)}`, {
      skipAuth: true,
    });
  },
};

// ── Posts ──
export interface PostMedia {
  id: number;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  position: number;
}

export interface Post {
  id: number;
  author_id: number;
  author_name: string;
  author_username: string | null;
  author_avatar_base64?: string | null;
  author_role: string;
  title: string;
  content: string;
  visibility: string;
  target_batch_years: number[];
  tags: string[];
  subject_id?: number | null;
  subject_name?: string | null;
  media: PostMedia[];
  comments_count: number;
  reactions_count: number;
  user_reacted: boolean;
  user_saved?: boolean;
  created_at: string;
  slug: string;
}

export interface PostDetail extends Post {
  comments: Comment[];
}

export interface Comment {
  id: number;
  author_id?: number;
  author_username?: string | null;
  author_avatar_base64?: string | null;
  author_name: string;
  content: string;
  reply_to_comment_id?: number | null;
  created_at: string;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  visibility: string;
  target_batch_years: number[];
  subject_id?: number | null;
  status?: string;
}

export const posts = {
  feed(filter?: string, batchYear?: number, subjectId?: number) {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (batchYear) params.set("batch_year", String(batchYear));
    if (subjectId) params.set("subject_id", String(subjectId));
    const q = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<Post[]>(`/api/v1/posts/feed${q}`);
  },

  search(query: string) {
    return apiFetch<Post[]>(`/api/v1/posts/search?q=${encodeURIComponent(query)}`);
  },

  get(slug: string) {
    return apiFetch<PostDetail | (Post & { comments?: Comment[] })>(`/api/v1/posts/${slug}`).then((post) => ({
      ...post,
      comments: Array.isArray(post.comments) ? post.comments : [],
    }));
  },

  create(data: CreatePostPayload) {
    return apiFetch<Post>("/api/v1/posts", { method: "POST", body: JSON.stringify(data) });
  },

  delete(postId: number) {
    return apiFetch(`/api/v1/posts/${postId}`, { method: "DELETE" });
  },

  byTag(tag: string) {
    return apiFetch<Post[]>(`/api/v1/posts/by-tag/${encodeURIComponent(tag)}`);
  },

  suggestTags(query: string) {
    return apiFetch<string[]>(`/api/v1/posts/tags/suggest?q=${encodeURIComponent(query)}`);
  },

  comment(postId: number, content: string, replyToCommentId?: number | null) {
    return apiFetch(`/api/v1/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content, reply_to_comment_id: replyToCommentId ?? null }),
    });
  },

  react(postId: number, type: string) {
    return apiFetch<{ message: string; active: boolean; count: number }>(`/api/v1/posts/${postId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ type }),
    });
  },

  byUser(userId: number) {
    return apiFetch<Post[]>(`/api/v1/posts/by-user/${userId}`);
  },

  save(postId: number) {
    return apiFetch<{ saved: boolean }>(`/api/v1/posts/${postId}/save`, { method: "POST" });
  },

  unsave(postId: number) {
    return apiFetch<{ saved: boolean }>(`/api/v1/posts/${postId}/save`, { method: "DELETE" });
  },

  savedList() {
    return apiFetch<Post[]>("/api/v1/posts/saved/list");
  },

  uploadMedia(postId: number, file: File, position: number = 0) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("position", String(position));
    return apiFetch<PostMedia>(`/api/v1/posts/${postId}/upload`, {
      method: "POST",
      body: formData,
    });
  },
};

// ── Subjects ──
export interface Subject {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  created_by: number;
  created_at: string;
  member_count: number;
  faculty_count: number;
}

export interface SubjectEnrollment {
  id: number;
  user_id: number;
  full_name: string;
  username?: string | null;
  email: string;
  role: "faculty" | "student";
  subject_id: number;
}

export interface UserSubject {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  enrollment_role: "faculty" | "student";
}

export const subjects = {
  /** My enrolled subjects (faculty or student) */
  my() {
    return apiFetch<Subject[]>("/api/v1/subjects/my");
  },

  /** All subjects — admin sees all, others see only enrolled */
  list() {
    return apiFetch<Subject[]>("/api/v1/subjects");
  },

  /** Admin: all subjects with counts */
  listAll() {
    return apiFetch<Subject[]>("/api/v1/subjects/all");
  },

  /** Admin: create a new subject */
  create(name: string, code: string, description?: string) {
    return apiFetch<Subject>("/api/v1/subjects", {
      method: "POST",
      body: JSON.stringify({ name, code, description }),
    });
  },

  /** Admin: delete a subject */
  delete(subjectId: number) {
    return apiFetch(`/api/v1/subjects/${subjectId}`, { method: "DELETE" });
  },

  /** Admin: assign a faculty member to a subject */
  assignFaculty(subjectId: number, userId: number) {
    return apiFetch<SubjectEnrollment>(`/api/v1/subjects/${subjectId}/assign-faculty`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  /** Faculty or Admin: assign a student to a subject */
  assignStudent(subjectId: number, userId: number) {
    return apiFetch<SubjectEnrollment>(`/api/v1/subjects/${subjectId}/assign-student`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  },

  /** Admin or Faculty: remove a member from a subject */
  removeMember(subjectId: number, userId: number) {
    return apiFetch(`/api/v1/subjects/${subjectId}/members/${userId}`, { method: "DELETE" });
  },

  /** Admin or Faculty: list all members of a subject */
  members(subjectId: number) {
    return apiFetch<SubjectEnrollment[]>(`/api/v1/subjects/${subjectId}/members`);
  },

  /** Get subjects a specific user is enrolled in (with their role per subject). Public. */
  userSubjects(userId: number) {
    return apiFetch<UserSubject[]>(`/api/v1/subjects/user/${userId}`, { skipAuth: false });
  },
};

// ── Users (Admin) ──
export interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  role: "guest" | "student" | "faculty" | "admin";
  is_banned: boolean;
  avatar_base64?: string | null;
  banner_base64?: string | null;
  created_at?: string | null;
  username?: string | null;
  batch_year?: number | null;
}

export interface AdminStats {
  total_users: number;
  students: number;
  faculty: number;
  guests: number;
  banned: number;
  total_posts: number;
}

export const admin = {
  stats() {
    return apiFetch<AdminStats>("/api/v1/admin/stats");
  },

  users() {
    return apiFetch<AdminUser[]>("/api/v1/admin/users");
  },

  updateRole(userId: number, role: string) {
    return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  banUser(userId: number, is_banned: boolean) {
    return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ is_banned }),
    });
  },

  deleteUser(userId: number) {
    return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}`, {
      method: "DELETE",
    });
  },

  updateBatchYear(userId: number, batchYear: number | null) {
    return apiFetch<{ message: string }>(`/api/v1/admin/users/${userId}/batch-year`, {
      method: "PATCH",
      body: JSON.stringify({ batch_year: batchYear }),
    });
  },

  deletePost(postId: number) {
    return apiFetch<{ message: string }>(`/api/v1/posts/${postId}`, {
      method: "DELETE",
    });
  },
};

export const users = {
  list() {
    return admin.users();
  },

  updateRole(userId: number, role: string) {
    return admin.updateRole(userId, role);
  },
};

// ── Messages ──
export interface MessageRequest {
  id: number;
  from_user: { id: number; full_name: string; username?: string | null; avatar_base64?: string | null };
  to_user: { id: number; full_name: string; username?: string | null; avatar_base64?: string | null };
  context: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface Conversation {
  id: number;
  participant: { id: number; full_name: string; username?: string | null; avatar_base64?: string | null };
  last_message: string;
  last_message_at: string;
  unread: number;
  partner_is_typing?: boolean;
  partner_last_read_msg_id?: number | null;
}

export interface Message {
  id: number;
  sender_id: number;
  content: string;
  created_at: string;
  is_deleted?: boolean;
  is_edited?: boolean;
  reply_to_id?: number | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
}

export const messages = {
  requests() {
    return apiFetch<MessageRequest[]>("/api/v1/messages/requests");
  },

  respondToRequest(id: number, accept: boolean) {
    return apiFetch(`/api/v1/messages/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: accept ? "accepted" : "rejected" }),
    });
  },

  conversations() {
    return apiFetch<Conversation[]>("/api/v1/conversations");
  },

  getMessages(conversationId: number) {
    return apiFetch<Message[]>(`/api/v1/conversations/${conversationId}/messages`);
  },

  send(conversationId: number, content: string, replyToId?: number | null) {
    return apiFetch(`/api/v1/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, reply_to_id: replyToId || null }),
    });
  },

  sendRequest(toUserId: number, context: string) {
    return apiFetch("/api/v1/messages/requests", {
      method: "POST",
      body: JSON.stringify({ to_user_id: toUserId, context }),
    });
  },

  deleteMessage(conversationId: number, messageId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
      method: "DELETE",
    });
  },

  deleteConversation(conversationId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}`, {
      method: "DELETE",
    });
  },

  editMessage(conversationId: number, messageId: number, content: string) {
    return apiFetch(`/api/v1/conversations/${conversationId}/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  },

  typing(conversationId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}/typing`, { method: "POST" });
  },

  markRead(conversationId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}/read`, { method: "POST" });
  },

  conversationInfo(conversationId: number) {
    return apiFetch<{ partner_is_typing: boolean; partner_last_read_msg_id: number | null }>(
      `/api/v1/conversations/${conversationId}/info`
    );
  },

  searchMessages(conversationId: number, query: string) {
    return apiFetch<Message[]>(`/api/v1/conversations/${conversationId}/messages/search?q=${encodeURIComponent(query)}`);
  },

  uploadFile(conversationId: number, file: File, replyToId?: number | null) {
    const formData = new FormData();
    formData.append("file", file);
    if (replyToId) formData.append("reply_to_id", String(replyToId));
    return apiFetch<Message>(`/api/v1/conversations/${conversationId}/upload`, {
      method: "POST",
      body: formData,
    });
  },

  forwardMessage(sourceConversationId: number, messageId: number, targetConversationId: number) {
    return apiFetch<Message>(`/api/v1/conversations/${sourceConversationId}/forward`, {
      method: "POST",
      body: JSON.stringify({ message_id: messageId, target_conversation_id: targetConversationId }),
    });
  },

  // Call signaling
  startCall(conversationId: number, callerPeerId: string) {
    return apiFetch<{ call_id: number; status: string }>(`/api/v1/conversations/${conversationId}/call/start`, {
      method: "POST",
      body: JSON.stringify({ call_type: "audio", caller_peer_id: callerPeerId }),
    });
  },

  answerCall(conversationId: number, callId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}/call/${callId}/answer`, {
      method: "POST",
    });
  },

  endCall(conversationId: number, callId: number) {
    return apiFetch(`/api/v1/conversations/${conversationId}/call/${callId}/end`, {
      method: "POST",
    });
  },

  getActiveCall(conversationId: number) {
    return apiFetch<{
      active: boolean;
      call_id?: number;
      call_type?: string;
      status?: string;
      is_caller?: boolean;
      caller_peer_id?: string;
      caller_id?: number;
      callee_id?: number;
    }>(`/api/v1/conversations/${conversationId}/call/active`);
  },
};

// ── Notifications ──
export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  target_url?: string | null;
  created_at: string;
}

export const notifications = {
  list() {
    return apiFetch<Notification[]>("/api/v1/notifications");
  },

  markRead(id: number) {
    return apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
  },

  markAllRead() {
    return apiFetch("/api/v1/notifications/read-all", { method: "POST" });
  },

  remove(id: number) {
    return apiFetch(`/api/v1/notifications/${id}`, { method: "DELETE" });
  },
};

// ── Groups ──
export interface GroupMember {
  user_id: number;
  full_name: string;
  username?: string | null;
  avatar_base64?: string | null;
  role: "admin" | "member";
}

export interface GroupOut {
  id: number;
  name: string;
  description?: string | null;
  avatar_base64?: string | null;
  invite_token: string;
  invite_enabled: boolean;
  auto_approve: boolean;
  member_count: number;
  my_role: "admin" | "member" | null;
  last_message: string;
  last_message_at: string;
  created_at: string;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  sender_name: string;
  sender_username?: string | null;
  sender_avatar?: string | null;
  content: string;
  is_deleted: boolean;
  is_edited: boolean;
  reply_to_id?: number | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  created_at: string;
}

export interface GroupInviteInfo {
  id: number;
  name: string;
  description?: string | null;
  avatar_base64?: string | null;
  member_count: number;
  already_member: boolean;
  pending_approval: boolean;
}

export interface JoinRequest {
  id: number;
  user_id: number;
  full_name: string;
  username?: string | null;
  avatar_base64?: string | null;
  created_at: string;
}

export const groups = {
  create(name: string, description?: string) {
    return apiFetch<GroupOut>("/api/v1/groups", { method: "POST", body: JSON.stringify({ name, description }) });
  },
  list() {
    return apiFetch<GroupOut[]>("/api/v1/groups");
  },
  get(id: number) {
    return apiFetch<GroupOut>(`/api/v1/groups/${id}`);
  },
  update(id: number, payload: { name?: string; description?: string; invite_enabled?: boolean; auto_approve?: boolean }) {
    return apiFetch<GroupOut>(`/api/v1/groups/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  updateAvatar(id: number, avatar_base64: string) {
    const fd = new FormData(); fd.append("avatar_base64", avatar_base64);
    return apiFetch<GroupOut>(`/api/v1/groups/${id}/avatar`, { method: "POST", body: fd });
  },
  resetInvite(id: number) {
    return apiFetch<GroupOut>(`/api/v1/groups/${id}/reset-invite`, { method: "POST" });
  },
  delete(id: number) {
    return apiFetch(`/api/v1/groups/${id}`, { method: "DELETE" });
  },

  // Members
  members(id: number) {
    return apiFetch<GroupMember[]>(`/api/v1/groups/${id}/members`);
  },
  addMember(id: number, user_id: number) {
    return apiFetch(`/api/v1/groups/${id}/members`, { method: "POST", body: JSON.stringify({ user_id }) });
  },
  updateMemberRole(id: number, user_id: number, role: "admin" | "member") {
    return apiFetch(`/api/v1/groups/${id}/members/${user_id}`, { method: "PATCH", body: JSON.stringify({ role }) });
  },
  removeMember(id: number, user_id: number) {
    return apiFetch(`/api/v1/groups/${id}/members/${user_id}`, { method: "DELETE" });
  },

  // Invite link
  getByInvite(token: string) {
    return apiFetch<GroupInviteInfo>(`/api/v1/groups/invite/${token}`, { skipAuth: false });
  },
  joinViaInvite(token: string) {
    return apiFetch<{ status: string; group_id: number }>(`/api/v1/groups/invite/${token}/join`, { method: "POST" });
  },

  // Join requests
  joinRequests(id: number) {
    return apiFetch<JoinRequest[]>(`/api/v1/groups/${id}/requests`);
  },
  respondToRequest(id: number, request_id: number, action: "approve" | "reject") {
    return apiFetch(`/api/v1/groups/${id}/requests/${request_id}`, { method: "POST", body: JSON.stringify({ action }) });
  },

  // Messages
  messages(id: number, limit = 100, before_id?: number) {
    const p = new URLSearchParams({ limit: String(limit) });
    if (before_id) p.set("before_id", String(before_id));
    return apiFetch<GroupMessage[]>(`/api/v1/groups/${id}/messages?${p}`);
  },
  sendMessage(id: number, content: string, reply_to_id?: number | null) {
    return apiFetch<GroupMessage>(`/api/v1/groups/${id}/messages`, { method: "POST", body: JSON.stringify({ content, reply_to_id: reply_to_id ?? null }) });
  },
  deleteMessage(id: number, msg_id: number) {
    return apiFetch(`/api/v1/groups/${id}/messages/${msg_id}`, { method: "DELETE" });
  },
  editMessage(id: number, msg_id: number, content: string) {
    return apiFetch<GroupMessage>(`/api/v1/groups/${id}/messages/${msg_id}`, { method: "PATCH", body: JSON.stringify({ content }) });
  },
};
