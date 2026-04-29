"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface OrgContextState {
  orgId: string | null;
  userId: string | null;
  loading: boolean;
}

export function useOrgContext(): OrgContextState {
  const [orgId, setOrgId]   = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("org_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single();

      if (!cancelled) {
        setOrgId(data?.organization_id ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { orgId, userId, loading };
}
