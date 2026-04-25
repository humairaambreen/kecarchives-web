"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GroupRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/messages/group-${id}`); }, [id, router]);
  return null;
}
