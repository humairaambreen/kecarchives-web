"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, AtSign, Hash, Send, ImagePlus,
  X, FileText, Film, Music, Globe, Users,
  GraduationCap, Lock, BookOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { auth, posts as postsApi, subjects as subjectsApi, type UserProfile, type Subject } from "@/lib/api";
import AIPostHelper from "@/components/ai-post-helper";

type Visibility = "public" | "students_only" | "batch_only" | "faculties_only" | "subject_only";

const VIS_OPTIONS: { value: Visibility; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: "public",        icon: <Globe size={13} />,         label: "Public",         sub: "Visible to everyone" },
  { value: "students_only", icon: <GraduationCap size={13} />, label: "Students Only",  sub: "All students" },
  { value: "batch_only",    icon: <Users size={13} />,         label: "Batch Only",     sub: "Specific batch years" },
  { value: "faculties_only",icon: <Lock size={13} />,          label: "Faculty Only",   sub: "Faculty members" },
  { value: "subject_only",  icon: <BookOpen size={13} />,      label: "Subject",        sub: "Enrolled members only" },
];

export default function CreatePostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [targetBatchYears, setTargetBatchYears] = useState<number[]>([]);
  const [batchInput, setBatchInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeToken, setActiveToken] = useState<{ type: "mention" | "tag"; query: string; start: number; end: number } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ file: File; url: string; type: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // Subject picker state
  const [mySubjects, setMySubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canCreate = !!user && (user.role === "faculty" || user.role === "admin");
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Load subjects when visibility is switched to subject_only
  useEffect(() => {
    if (visibility !== "subject_only" || mySubjects.length > 0) return;
    setSubjectsLoading(true);
    subjectsApi.my()
      .then((data) => setMySubjects(data))
      .catch(() => setMySubjects([]))
      .finally(() => setSubjectsLoading(false));
  }, [visibility, mySubjects.length]);

  // Reset subject selection when visibility changes away
  useEffect(() => {
    if (visibility !== "subject_only") setSelectedSubjectId(null);
  }, [visibility]);

  function handleUseAIContent(aiContent: string) {
    setContent(aiContent);
    setTimeout(() => contentRef.current?.focus(), 80);
  }

  function handleUseAIImage(file: File) {
    addMediaFiles([file]);
  }


  function addMediaFiles(files: FileList | File[]) {
    const newFiles = Array.from(files).filter((f) => f.size <= MAX_FILE_SIZE);
    if (!newFiles.length) return;
    setMediaFiles((prev) => [...prev, ...newFiles]);
    setMediaPreviews((prev) => [...prev, ...newFiles.map((f) => ({
      file: f, type: f.type,
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
    }))]);
  }

  function removeMediaFile(idx: number) {
    if (mediaPreviews[idx]?.url) URL.revokeObjectURL(mediaPreviews[idx].url);
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function addBatchYear() {
    const year = parseInt(batchInput, 10);
    if (!year || batchInput.length !== 4 || targetBatchYears.includes(year)) return;
    setTargetBatchYears((prev) => [...prev, year]);
    setBatchInput("");
  }

  const tokenRegex = /(^|\s)([@#])([a-zA-Z0-9_]*)$/;
  function refreshSuggestions(nextText: string, caretPos: number) {
    const before = nextText.slice(0, caretPos);
    const match = before.match(tokenRegex);
    if (!match) { setActiveToken(null); setShowSuggestions(false); return; }
    const marker = match[2];
    const query = (match[3] || "").toLowerCase();
    const start = before.length - (match[3] || "").length - 1;
    setActiveToken({ type: marker === "@" ? "mention" : "tag", query, start, end: caretPos });
    setShowSuggestions(true);
  }

  useEffect(() => {
    if (!activeToken || !showSuggestions) { setMentionSuggestions([]); setTagSuggestions([]); return; }
    let cancelled = false;
    if (activeToken.type === "mention") {
      auth.searchUsers(activeToken.query).then((u) => { if (!cancelled) setMentionSuggestions(u.filter((x) => !!x.username).slice(0, 8)); }).catch(() => {});
    } else {
      postsApi.suggestTags(activeToken.query).then((t) => { if (!cancelled) setTagSuggestions(t.slice(0, 8)); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [activeToken, showSuggestions]);

  const hasSuggestions = useMemo(() => {
    if (!activeToken || !showSuggestions) return false;
    return activeToken.type === "mention" ? mentionSuggestions.length > 0 : tagSuggestions.length > 0;
  }, [activeToken, mentionSuggestions.length, tagSuggestions.length, showSuggestions]);

  function applySuggestion(value: string) {
    if (!activeToken || !contentRef.current) return;
    const marker = activeToken.type === "mention" ? "@" : "#";
    const replacement = `${marker}${value}`;
    const next = `${content.slice(0, activeToken.start)}${replacement}${content.slice(activeToken.end)}`;
    setContent(next);
    setShowSuggestions(false);
    const nextCaret = activeToken.start + replacement.length;
    requestAnimationFrame(() => { contentRef.current?.focus(); contentRef.current?.setSelectionRange(nextCaret, nextCaret); });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (visibility === "batch_only" && targetBatchYears.length === 0) {
      setError("Select at least one target batch year."); return;
    }
    if (visibility === "subject_only" && !selectedSubjectId) {
      setError("Select a subject for this post."); return;
    }
    setError(""); setSubmitting(true);
    try {
      const created = await postsApi.create({
        title: title.trim(),
        content: content.trim(),
        visibility,
        target_batch_years: targetBatchYears,
        subject_id: visibility === "subject_only" ? selectedSubjectId : null,
      });
      if (mediaFiles.length > 0) {
        setUploadProgress({ current: 0, total: mediaFiles.length });
        for (let i = 0; i < mediaFiles.length; i++) {
          setUploadProgress({ current: i + 1, total: mediaFiles.length });
          try { await postsApi.uploadMedia(created.id, mediaFiles[i], i); } catch { /* skip */ }
        }
        setUploadProgress(null);
      }
      router.push(`/${user?.username || "post"}/${created.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
      setUploadProgress(null);
    } finally { setSubmitting(false); }
  }

  if (!canCreate || !user) {
    return (
      <div className="py-20 text-center">
        <p className="text-[13px] text-neutral-400">Only faculty and admins can create posts.</p>
        <Link href="/feed" className="mt-3 inline-block text-[13px] font-semibold text-neutral-900 hover:underline underline-offset-2">
          Back to Feed
        </Link>
      </div>
    );
  }

  const selectedVis = VIS_OPTIONS.find((o) => o.value === visibility)!;

  return (
    <>
      <style>{`
        .create-root { font-family: 'Geist', ui-sans-serif, system-ui, sans-serif; }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.22s ease forwards; }
        .field-input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid #e5e5e5;
          padding: 11px 14px;
          font-size: 13.5px;
          font-family: inherit;
          background: #fafafa;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          color: #171717;
        }
        .field-input:focus {
          border-color: #a3a3a3;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.04);
        }
        .field-input::placeholder { color: #a3a3a3; }
        .field-select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
      `}</style>

      <div className="create-root pb-28 fade-up">

        {/* Back link */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to Feed
        </Link>

        {/* Author strip */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-neutral-900 text-white grid place-items-center text-[13px] font-semibold overflow-hidden shrink-0">
            {user.avatar_base64
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.avatar_base64} alt="" className="h-full w-full object-cover" />
              : user.full_name[0]}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-neutral-900 leading-tight">{user.full_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10.5px] font-medium text-neutral-500">
                {selectedVis.icon} {selectedVis.label}
              </span>
              <span className="text-neutral-300 text-[11px]">·</span>
              <span className="text-[12px] text-neutral-400 capitalize">{user.role}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Title */}
          <div>
            <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">Title</label>
            <input
              className="field-input"
              placeholder="What's this announcement about?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Visibility + Batch/Subject */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">Visibility</label>
              <select
                className="field-input field-select"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as Visibility)}
              >
                {VIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label} — {opt.sub}</option>
                ))}
              </select>
            </div>

            {visibility === "batch_only" && (
              <div>
                <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">Batch Years</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="field-input flex-1"
                    placeholder="e.g. 2025"
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBatchYear(); } }}
                  />
                  <button
                    type="button"
                    onClick={addBatchYear}
                    disabled={batchInput.length !== 4}
                    className="rounded-full bg-neutral-900 px-4 text-[13px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-30 shrink-0"
                  >
                    Add
                  </button>
                </div>
                {targetBatchYears.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {targetBatchYears.map((year) => (
                      <span key={year} className="inline-flex items-center gap-1 rounded-full bg-neutral-900 text-white px-3 py-1 text-[12px] font-medium">
                        {year}
                        <button type="button" onClick={() => setTargetBatchYears((p) => p.filter((y) => y !== year))} className="text-neutral-400 hover:text-white transition-colors ml-0.5">
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subject picker */}
            {visibility === "subject_only" && (
              <div>
                <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">Subject</label>
                {subjectsLoading ? (
                  <div className="field-input text-neutral-400 text-[13px]">Loading subjects…</div>
                ) : mySubjects.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-[12.5px] text-neutral-400">
                    You are not assigned to any subjects yet. Ask your admin to assign you.
                  </div>
                ) : (
                  <select
                    className="field-input field-select"
                    value={selectedSubjectId ?? ""}
                    onChange={(e) => setSelectedSubjectId(e.target.value ? Number(e.target.value) : null)}
                    required={visibility === "subject_only"}
                  >
                    <option value="">Select a subject…</option>
                    {mySubjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                )}
                {selectedSubjectId && (
                  <p className="mt-1.5 text-[11.5px] text-neutral-400">
                    Only enrolled members of this subject will see the post.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-100" />

          {/* Content */}
          <div>
            <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">Content</label>
            <div className="relative">
              <textarea
                ref={contentRef}
                className="field-input min-h-[180px] resize-y leading-relaxed"
                placeholder={"Write your announcement…\n\nUse #hashtags and @mentions to tag users"}
                value={content}
                onChange={(e) => { const v = e.target.value; setContent(v); refreshSuggestions(v, e.target.selectionStart ?? v.length); }}
                onKeyUp={(e) => refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                onClick={(e) => refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
                required
              />

              {/* Mention/tag suggestions */}
              {hasSuggestions && activeToken && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5 rounded-2xl border border-neutral-100 bg-white shadow-xl overflow-hidden">
                  {activeToken.type === "mention" && mentionSuggestions.map((u) => (
                    <button key={u.id} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(u.username || "")}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <AtSign size={13} className="text-neutral-400 shrink-0" />
                      <span className="text-[13px] font-semibold text-neutral-900">{u.username}</span>
                      <span className="text-[12px] text-neutral-400">{u.full_name}</span>
                    </button>
                  ))}
                  {activeToken.type === "tag" && tagSuggestions.map((tag) => (
                    <button key={tag} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(tag)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <Hash size={13} className="text-neutral-400 shrink-0" />
                      <span className="text-[13px] font-semibold text-neutral-900">{tag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11.5px] text-neutral-300">Use #tags and @mentions in your content</p>
          </div>

          {/* AI Post Assistant */}
          <AIPostHelper
            topic={content || title}
            onUseContent={handleUseAIContent}
            onUseImage={handleUseAIImage}
          />

          {/* Media */}
          <div>
            <label className="block text-[12px] font-semibold text-neutral-500 tracking-wide uppercase mb-2">
              Attachments <span className="normal-case font-normal text-neutral-300 ml-1">optional</span>
            </label>

            {mediaPreviews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {mediaPreviews.map((p, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-50 aspect-square">
                    {p.type.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt={p.file.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 px-2 text-neutral-400">
                        {p.type.startsWith("video/") ? <Film size={18} />
                          : p.type.startsWith("audio/") ? <Music size={18} />
                          : <FileText size={18} />}
                        <span className="text-[10px] text-center truncate w-full text-neutral-400">{p.file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMediaFile(idx)}
                      className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-neutral-900/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) addMediaFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-4 py-3 text-[13px] text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-all"
            >
              <ImagePlus size={15} />
              {mediaFiles.length > 0
                ? `Add more files · ${mediaFiles.length} attached`
                : "Add images, videos or files"}
            </button>
            <p className="mt-1.5 text-[11px] text-neutral-300">Max 50 MB per file</p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600 flex items-start justify-between gap-3">
              <span>{error}</span>
              <button onClick={() => setError("")} className="text-red-400 hover:text-red-600 text-[11px] underline shrink-0">Dismiss</button>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1 border-t border-neutral-100">
            <button
              type="submit"
              disabled={!title.trim() || !content.trim() || submitting}
              className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-2.5 text-[13.5px] font-medium text-white hover:bg-neutral-700 transition-colors disabled:opacity-30"
            >
              <Send size={14} />
              {uploadProgress
                ? `Uploading ${uploadProgress.current}/${uploadProgress.total}…`
                : submitting ? "Publishing…" : "Publish Post"}
            </button>
            <Link
              href="/feed"
              className="text-[13px] text-neutral-400 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </>
  );
}