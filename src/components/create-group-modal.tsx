"use client";

import { useState } from "react";
import { X, Users } from "lucide-react";
import { groups as groupsApi, type GroupOut } from "@/lib/api";

export default function CreateGroupModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (g: GroupOut) => void;
}) {
  const [name, setName]   = useState("");
  const [desc, setDesc]   = useState("");
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const g = await groupsApi.create(name.trim(), desc.trim() || undefined);
      onCreated(g);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create group");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold flex items-center gap-2">
            <Users size={16} className="text-neutral-500" /> New Group
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Group name *"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={80}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
            className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-neutral-900 transition-colors"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={200}
            className="w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-neutral-900 transition-colors"
          />
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <button
          onClick={handleCreate}
          disabled={!name.trim() || busy}
          className="mt-4 w-full py-2.5 rounded-xl bg-neutral-900 text-white text-[13.5px] font-medium disabled:opacity-30 hover:bg-neutral-700 transition-colors"
        >
          {busy ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}
