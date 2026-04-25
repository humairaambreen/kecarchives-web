"use client";

import { useState, useCallback } from "react";
import Cookies from "js-cookie";
import {
  Sparkles, RefreshCw, ImageIcon, Copy, Check,
  ChevronDown, ChevronUp, Download, Wand2, AlertCircle,
  X, Pencil, PlusCircle, ImagePlus,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

interface AIPostHelperProps {
  topic: string;
  onUseContent: (content: string) => void;
  onUseImage?: (file: File) => void;
}

type Status = "idle" | "loading" | "done" | "error";

interface GeneratedImage {
  id: number;
  dataUrl: string;
  prompt: string;
}

export default function AIPostHelper({ topic, onUseContent, onUseImage }: AIPostHelperProps) {
  const [expanded, setExpanded] = useState(false);
  const [textStatus, setTextStatus] = useState<Status>("idle");
  const [generatedText, setGeneratedText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  // Image state
  const [imgStatus, setImgStatus] = useState<Status>("idle");
  const [imgErrorMsg, setImgErrorMsg] = useState("");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [nextId, setNextId] = useState(1);

  // Editable prompt state
  const [customPrompt, setCustomPrompt] = useState("");
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptReady, setPromptReady] = useState(false);   // true once Groq wrote a prompt
  const [promptLoading, setPromptLoading] = useState(false);

  // "used in post" tracking per image id
  const [usedImageIds, setUsedImageIds] = useState<Set<number>>(new Set());

  async function callBackend<T>(path: string, body: object): Promise<T> {
    const token = Cookies.get("access_token");
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Request failed");
    return data as T;
  }

  // ── Text generation ────────────────────────────────────────────────────────

  const runEnhance = useCallback(async (isRewrite = false) => {
    const input = topic.trim();
    if (!input) return;
    if (!isRewrite) setExpanded(true);
    setTextStatus("loading");
    setErrorMsg("");
    if (!isRewrite) {
      setGeneratedText("");
      setImages([]);
      setImgStatus("idle");
      setCustomPrompt("");
      setPromptReady(false);
    }
    try {
      const data = await callBackend<{ content: string }>("/api/v1/ai/enhance-post", { topic: input });
      setGeneratedText(data.content ?? "");
      setTextStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "AI generation failed.");
      setTextStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const copy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Prompt generation (step 1 of image flow) ──────────────────────────────

  const _fetchPrompt = useCallback(async () => {
    const content = generatedText || topic;
    if (!content.trim()) return;
    setPromptLoading(true);
    setImgErrorMsg("");
    try {
      const data = await callBackend<{ image_prompt: string }>("/api/v1/ai/image-prompt", {
        post_content: content,
      });
      const p = data.image_prompt || "engineering college students, campus celebration, professional photography";
      setCustomPrompt(p);
      setPromptReady(true);
    } catch {
      const fallback = "engineering college students, campus celebration, professional photography";
      setCustomPrompt(fallback);
      setPromptReady(true);
    }
    setPromptLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generatedText, topic]);

  // ── Image generation (step 2) ─────────────────────────────────────────────

  const generateImage = useCallback(async (promptOverride?: string) => {
    const prompt = (promptOverride ?? customPrompt).trim();
    if (!prompt) return;
    setImgStatus("loading");
    setImgErrorMsg("");
    setEditingPrompt(false);
    try {
      const imgData = await callBackend<{ image_base64: string }>("/api/v1/ai/generate-image", { prompt });
      if (!imgData.image_base64) throw new Error("Backend returned empty image.");
      const id = nextId;
      setNextId((n) => n + 1);
      setImages((prev) => [...prev, { id, dataUrl: imgData.image_base64, prompt }]);
      setImgStatus("done");
    } catch (err) {
      setImgErrorMsg(err instanceof Error ? err.message : "Image generation failed.");
      setImgStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPrompt, nextId]);

  // Called when user clicks "Generate Image" for the first time
  const handleGenerateFirst = useCallback(async () => {
    if (promptReady) {
      // Prompt already fetched — go straight to generation
      await generateImage();
    } else {
      // Need to fetch prompt first, then generate
      setPromptLoading(true);
      setImgErrorMsg("");
      const content = generatedText || topic;
      let prompt = "engineering college students, campus celebration, professional photography";
      try {
        const data = await callBackend<{ image_prompt: string }>("/api/v1/ai/image-prompt", {
          post_content: content.trim(),
        });
        prompt = data.image_prompt || prompt;
      } catch { /* use fallback */ }
      setCustomPrompt(prompt);
      setPromptReady(true);
      setPromptLoading(false);
      setImgStatus("loading");
      setImgErrorMsg("");
      try {
        const imgData = await callBackend<{ image_base64: string }>("/api/v1/ai/generate-image", { prompt });
        if (!imgData.image_base64) throw new Error("Backend returned empty image.");
        const id = nextId;
        setNextId((n) => n + 1);
        setImages((prev) => [...prev, { id, dataUrl: imgData.image_base64, prompt }]);
        setImgStatus("done");
      } catch (err) {
        setImgErrorMsg(err instanceof Error ? err.message : "Image generation failed.");
        setImgStatus("error");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptReady, generateImage, generatedText, topic, nextId]);

  // Download a specific image
  const downloadImage = (dataUrl: string, idx: number) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `kec-post-image-${idx + 1}.jpg`;
    a.click();
  };

  // Convert base64 dataURL → File and pass to parent
  const handleUseImage = (img: GeneratedImage) => {
    if (!onUseImage) return;
    const [header, b64] = img.dataUrl.split(",");
    const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const file = new File([blob], `ai-image-${img.id}.jpg`, { type: mime });
    onUseImage(file);
    setUsedImageIds((prev) => new Set(prev).add(img.id));
  };

  const canAct = topic.trim().length > 0;
  const hasText = textStatus === "done" && generatedText;
  const isTextLoading = textStatus === "loading";
  const hasImages = images.length > 0;
  const isImgLoading = imgStatus === "loading"; // extracted to prevent TS2367 narrowing error

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-neutral-700" />
          <span className="text-[13px] font-semibold text-neutral-800">AI Post Assistant</span>
          <span className="text-[11px] text-neutral-400">Groq · HuggingFace FLUX</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runEnhance(false)}
            disabled={!canAct || isTextLoading}
            title={!canAct ? "Type something in the content field first" : "Generate a professional KEC post"}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5
              text-[12.5px] font-medium text-white hover:bg-neutral-700 transition-colors
              disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isTextLoading ? <RefreshCw size={11} className="animate-spin" /> : <Wand2 size={11} />}
            {isTextLoading ? "Writing…" : "AI Enhance"}
          </button>
          {(hasText || isTextLoading || textStatus === "error") && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div className="px-4 py-4 space-y-4">

          {/* Loading skeleton */}
          {isTextLoading && (
            <div className="space-y-2.5 py-1">
              {[100, 92, 85, 95, 78].map((w, i) => (
                <div key={i} className="h-3 bg-neutral-200 rounded-full animate-pulse" style={{ width: `${w}%` }} />
              ))}
              <p className="text-[11.5px] text-neutral-400 text-center pt-1">Crafting your KEC Bhilai post…</p>
            </div>
          )}

          {/* Text error */}
          {textStatus === "error" && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-red-700 mb-0.5">AI Error</p>
                <p className="text-[12px] text-red-600">{errorMsg}</p>
                {errorMsg.includes("GROQ_API_KEY") && (
                  <p className="text-[11.5px] text-red-500 mt-1">
                    Get a free key at{" "}
                    <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">console.groq.com</a>
                    {" "}and add <code className="bg-red-100 px-1 rounded text-[11px]">GROQ_API_KEY=...</code> to your <code className="bg-red-100 px-1 rounded text-[11px]">.env</code>
                  </p>
                )}
              </div>
              <button type="button" onClick={() => { setTextStatus("idle"); setExpanded(false); }} className="text-red-400 hover:text-red-600 shrink-0">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Generated text */}
          {hasText && (
            <>
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                <p className="text-[13.5px] text-neutral-800 leading-relaxed whitespace-pre-wrap">{generatedText}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => onUseContent(generatedText)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-neutral-700 transition-colors">
                  <Check size={11} /> Use This
                </button>
                <button type="button" onClick={() => runEnhance(true)} disabled={isTextLoading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors disabled:opacity-40">
                  <RefreshCw size={11} /> Rewrite
                </button>
                <button type="button" onClick={copy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors">
                  {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                {/* Generate Image button — only shown before any image is generated */}
                {!hasImages && !isImgLoading && (
                  <button type="button" onClick={handleGenerateFirst} disabled={isImgLoading || promptLoading}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors disabled:opacity-40">
                    {promptLoading ? <RefreshCw size={11} className="animate-spin" /> : <ImageIcon size={11} />}
                    {promptLoading ? "Preparing prompt…" : "Generate Image"}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Image section ── */}
          {(hasImages || isImgLoading || imgStatus === "error" || promptReady) && (
            <div className="space-y-3">

              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  AI Images {hasImages ? `(${images.length})` : ""}
                </span>
                <span className="text-[10.5px] text-neutral-400">HuggingFace · FLUX.1-schnell</span>
              </div>

              {/* Editable prompt row */}
              {promptReady && (
                <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
                    <Pencil size={11} className="text-neutral-400 shrink-0" />
                    <span className="text-[11px] text-neutral-500 font-medium">Image prompt</span>
                    {!editingPrompt && (
                      <button
                        type="button"
                        onClick={() => setEditingPrompt(true)}
                        className="ml-auto text-[11px] text-neutral-400 hover:text-neutral-700 underline underline-offset-2 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {editingPrompt && (
                      <button
                        type="button"
                        onClick={() => setEditingPrompt(false)}
                        className="ml-auto text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {editingPrompt ? (
                    <div className="p-2 space-y-2">
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-[12.5px] text-neutral-800 bg-neutral-50 outline-none focus:border-neutral-400 focus:bg-white resize-none transition-colors"
                        placeholder="Describe the image you want…"
                      />
                      <button
                        type="button"
                        onClick={() => generateImage(customPrompt)}
                        disabled={!customPrompt.trim() || isImgLoading}
                        className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-[12px] font-medium text-white hover:bg-neutral-700 disabled:opacity-30 transition-colors"
                      >
                        <ImageIcon size={11} /> Generate with this prompt
                      </button>
                    </div>
                  ) : (
                    <p className="px-3 py-2 text-[12px] text-neutral-600 italic leading-relaxed">&ldquo;{customPrompt}&rdquo;</p>
                  )}
                </div>
              )}

              {/* Loading shimmer */}
              {isImgLoading && (
                <div className="w-full h-52 rounded-2xl border border-neutral-200 bg-neutral-100 animate-pulse flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={16} className="text-neutral-400 animate-spin" />
                  <p className="text-[12px] text-neutral-400">Generating image…</p>
                  <p className="text-[11px] text-neutral-300">Usually 5–15 seconds</p>
                </div>
              )}

              {/* Generated images grid */}
              {hasImages && (
                <div className="space-y-3">
                  {images.map((img, idx) => {
                    const used = usedImageIds.has(img.id);
                    return (
                      <div key={img.id} className="rounded-2xl overflow-hidden border border-neutral-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.dataUrl}
                          alt={`AI generated image ${idx + 1}`}
                          className="w-full max-h-72 object-cover"
                        />
                        {/* Action row below each image */}
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-t border-neutral-100 flex-wrap">
                          {onUseImage && (
                            <button
                              type="button"
                              onClick={() => handleUseImage(img)}
                              disabled={used}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
                                used
                                  ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
                                  : "bg-neutral-900 text-white hover:bg-neutral-700"
                              }`}
                            >
                              {used ? <><Check size={11} /> Added to post</> : <><ImagePlus size={11} /> Use in Post</>}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => generateImage(img.prompt)}
                            disabled={isImgLoading}
                            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
                          >
                            <RefreshCw size={11} /> Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadImage(img.dataUrl, idx)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                          >
                            <Download size={11} /> Download
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Generate another image */}
                  {!isImgLoading && (
                    <button
                      type="button"
                      onClick={() => generateImage()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-3 text-[12.5px] font-medium text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-all"
                    >
                      <PlusCircle size={13} /> Generate another variation
                    </button>
                  )}
                </div>
              )}

              {/* Image error */}
              {imgStatus === "error" && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-red-700 mb-0.5">Image Error</p>
                    <p className="text-[12px] text-red-600">{imgErrorMsg}</p>
                    {imgErrorMsg.includes("HF_TOKEN") && (
                      <p className="text-[11.5px] text-red-500 mt-1">
                        Get a free token at{" "}
                        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">
                          huggingface.co/settings/tokens
                        </a>
                        {" "}and add <code className="bg-red-100 px-1 rounded text-[11px]">HF_TOKEN=hf_...</code> to your <code className="bg-red-100 px-1 rounded text-[11px]">.env</code>
                      </p>
                    )}
                    <button type="button" onClick={() => generateImage()} className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-red-600 underline underline-offset-2">
                      <RefreshCw size={11} /> Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}