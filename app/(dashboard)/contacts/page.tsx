"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useOrgContext } from "@/lib/hooks/useOrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, Mail, Phone, MessageCircle, Building2,
  User, MapPin, Tag, Calendar,
} from "lucide-react";
import { format } from "date-fns";

type ContactType = "lead" | "client" | "contractor" | "vendor" | "investor" | "government";

type Contact = {
  id: string;
  type: ContactType;
  first_name: string;
  last_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  source: string | null;
  tags: string[];
  created_at: string;
};

const TYPE_CONFIG: Record<ContactType, { label: string; color: string }> = {
  lead:       { label: "Lead",       color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  client:     { label: "Client",     color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  contractor: { label: "Contractor", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  vendor:     { label: "Vendor",     color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  investor:   { label: "Investor",   color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  government: { label: "Government", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ value: k, label: v.label })),
];

function initials(c: Contact) {
  return `${c.first_name[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase() || "?";
}

function fullName(c: Contact) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

// ── Contact Card ─────────────────────────────────────────────
function ContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const cfg = TYPE_CONFIG[contact.type];
  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-surface border border-border rounded-xl p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {initials(contact)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground text-sm truncate">{fullName(contact)}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          {contact.company && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
              <Building2 className="w-3 h-3 flex-shrink-0" />{contact.company}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {contact.email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" /><span className="truncate max-w-[120px]">{contact.email}</span>
              </span>
            )}
            {contact.phone && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />{contact.phone}
              </span>
            )}
          </div>
          {contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.tags.slice(0, 3).map((t) => (
                <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Contact Detail Sheet ──────────────────────────────────────
function ContactSheet({ contact, open, onClose }: { contact: Contact | null; open: boolean; onClose: () => void }) {
  if (!contact) return null;
  const cfg = TYPE_CONFIG[contact.type];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
              {initials(contact)}
            </div>
            <div>
              <SheetTitle className="text-lg">{fullName(contact)}</SheetTitle>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Details */}
          <div className="space-y-3">
            {contact.company && (
              <Row icon={Building2} label="Company" value={contact.company} />
            )}
            {contact.email && (
              <Row icon={Mail} label="Email" value={contact.email} />
            )}
            {contact.phone && (
              <Row icon={Phone} label="Phone" value={contact.phone} />
            )}
            {contact.whatsapp && (
              <Row icon={MessageCircle} label="WhatsApp" value={contact.whatsapp} />
            )}
            {contact.city && (
              <Row icon={MapPin} label="City" value={contact.city} />
            )}
            {contact.source && (
              <Row icon={User} label="Source" value={contact.source} />
            )}
            <Row icon={Calendar} label="Added" value={format(new Date(contact.created_at), "dd MMM yyyy")} />
          </div>

          {/* Tags */}
          {contact.tags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Tag className="w-3 h-3" />Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <span key={t} className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full border border-border">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

// ── Create Contact Modal ──────────────────────────────────────
function CreateContactModal({
  open, onClose, orgId, onCreated,
}: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    type: "lead" as ContactType,
    first_name: "", last_name: "", company: "",
    email: "", phone: "", whatsapp: "", city: "", source: "", tags: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.first_name.trim()) { setError("First name is required."); return; }
    setSaving(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: err } = await supabase.from("contacts").insert({
      organization_id: orgId,
      type: form.type,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      city: form.city.trim() || null,
      source: form.source.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      assigned_to: user?.id,
      created_by: user?.id,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setForm({ type: "lead", first_name: "", last_name: "", company: "", email: "", phone: "", whatsapp: "", city: "", source: "", tags: "" });
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *" value={form.first_name} onChange={(v) => set("first_name", v)} />
            <Field label="Last Name"    value={form.last_name}  onChange={(v) => set("last_name", v)} />
          </div>
          <Field label="Company"   value={form.company} onChange={(v) => set("company", v)} />
          <Field label="Email"     value={form.email}   onChange={(v) => set("email", v)} type="email" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"    value={form.phone}    onChange={(v) => set("phone", v)} />
            <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set("whatsapp", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City"   value={form.city}   onChange={(v) => set("city", v)} />
            <Field label="Source" value={form.source} onChange={(v) => set("source", v)} placeholder="e.g. referral" />
          </div>
          <Field label="Tags (comma-separated)" value={form.tags} onChange={(v) => set("tags", v)} placeholder="e.g. high-value, Q3" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={saving}>
              {saving ? "Saving…" : "Create Contact"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? label} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ContactsPage() {
  const { orgId, loading: orgLoading } = useOrgContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!orgLoading && !orgId) setLoading(false);
  }, [orgLoading, orgId]);

  const fetchContacts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("contacts")
      .select("id,type,first_name,last_name,company,email,phone,whatsapp,city,source,tags,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setContacts((data as Contact[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const filtered = contacts.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.first_name.toLowerCase().includes(q) ||
        (c.last_name ?? "").toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (orgLoading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex gap-3 flex-wrap mb-6">
        {[1,2,3].map(i=><Skeleton key={i} className="h-10 w-24 rounded-lg"/>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1,2,3,4,5,6].map(i=><Skeleton key={i} className="h-28 rounded-xl"/>)}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />New Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {TYPE_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTypeFilter(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                typeFilter === value
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i=><Skeleton key={i} className="h-28 rounded-xl"/>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {search || typeFilter !== "all" ? "No contacts match your filters" : "No contacts yet"}
          </p>
          {!search && typeFilter === "all" && (
            <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
              Add your first contact
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <ContactCard key={c.id} contact={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <ContactSheet contact={selected} open={!!selected} onClose={() => setSelected(null)} />

      {/* Create Modal */}
      {orgId && (
        <CreateContactModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          orgId={orgId}
          onCreated={fetchContacts}
        />
      )}
    </div>
  );
}
