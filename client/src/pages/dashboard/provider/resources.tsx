import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api } from "@/services/api";
import type { Resource, Connector, Domain } from "@/services/api";
import {
  Plus,
  FileText,
  CheckCircle,
  Trash2,
  Loader2,
  Upload,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type ResourceFormState = {
  title: string;
  type: "site" | "dataset" | "file";
  format: string;
  domain: string;
  path: string;
  category: string;
  summary: string;
  samplePreview: string;
  tags: string;
  priceFlat: string;
  pricePerKb: string;
  flatFeeEnabled: boolean;
  visibility: "public" | "restricted";
  modes: { raw: boolean; summary: boolean };
  connectorId: string;
  file?: File;
  epochs?: string;
  deletable?: boolean;
};

const defaultResourceForm: ResourceFormState = {
  title: "",
  type: "site",
  format: "html",
  domain: "",
  path: "/",
  category: "",
  summary: "",
  samplePreview: "",
  tags: "",
  priceFlat: "",
  pricePerKb: "",
  flatFeeEnabled: true,
  visibility: "public",
  modes: { raw: true, summary: false },
  connectorId: "",
  epochs: "1",
  deletable: true,
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const FORMAT_OPTIONS = {
  site: ["html", "json", "xml", "rss", "text", "markdown"],
  dataset: ["json", "csv", "parquet", "jsonl", "xml", "text"],
  file: [
    "pdf",
    "docx",
    "txt",
    "md",
    "json",
    "csv",
    "xlsx",
    "png",
    "jpg",
    "svg",
  ],
};

export function ResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(
    null,
  );
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resourceForm, setResourceForm] =
    useState<ResourceFormState>(defaultResourceForm);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [walUsd, setWalUsd] = useState<number | null>(null);
  const [walrusQuote, setWalrusQuote] = useState<{
    wal_est: number;
    sui_est: number | null;
    encoded_bytes?: number;
  } | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendResource, setExtendResource] = useState<Resource | null>(null);
  const [extendAddEpochs, setExtendAddEpochs] = useState<string>("1");
  const [extendQuote, setExtendQuote] = useState<{
    wal_est: number;
    sui_est: number | null;
    encoded_bytes?: number;
  } | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  const DEFAULT_CATEGORIES = [
    "healthcare",
    "finance",
    "technology",
    "research",
    "education",
    "legal",
    "marketing",
    "real-estate",
    "entertainment",
    "social-media",
    "e-commerce",
    "analytics",
  ];

  const allCategories = [
    ...new Set([...categoryOptions, ...DEFAULT_CATEGORIES]),
  ];

  const loadPage = async () => {
    setIsLoading(true);
    try {
      const [resList, connectorList, domainList, categories, prices] =
        await Promise.all([
          api.getProviderResources(100),
          api.getConnectors(),
          api.getDomains(),
          api.getMarketCategories(),
          api.getPrices().catch(() => ({ wal_usd: null })),
        ]);
      setResources(resList);
      setConnectors(connectorList);
      setDomains(domainList);
      setCategoryOptions(categories || []);
      setWalUsd(typeof prices.wal_usd === "number" ? prices.wal_usd : null);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load resources");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!catRef.current) return;
      if (!catRef.current.contains(e.target as Node)) setCategoryOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setError("");

    if (
      (resourceForm.type === "file" || resourceForm.type === "dataset") &&
      !resourceForm.file
    ) {
      setError("Please select a file to upload");
      setFormSubmitting(false);
      return;
    }

    if (resourceForm.type === "site" && !resourceForm.domain) {
      setError("Please select a verified domain");
      setFormSubmitting(false);
      return;
    }

    const hasPrice = resourceForm.priceFlat || resourceForm.pricePerKb;
    if (!hasPrice) {
      setError(
        "Please set at least one pricing option (flat price or price per KB)",
      );
      setFormSubmitting(false);
      return;
    }

    const hasModes = resourceForm.modes.raw || resourceForm.modes.summary;
    if (!hasModes) {
      setError("Please select at least one mode (raw or summary)");
      setFormSubmitting(false);
      return;
    }

    try {
      let walrusUpload:
        | {
            walrus_blob_id: string;
            walrus_blob_object_id: string;
            size_bytes: number;
            cipher_meta: { algo: string; size_bytes: number };
          }
        | undefined;
      if (
        (resourceForm.type === "file" || resourceForm.type === "dataset") &&
        resourceForm.file
      ) {
        setUploadingFile(true);
        try {
          walrusUpload = await api.uploadEncryptedToWalrus(resourceForm.file, {
            epochs: Math.max(1, parseInt(resourceForm.epochs || "1", 10) || 1),
            deletable: resourceForm.deletable,
          });
        } finally {
          setUploadingFile(false);
        }
      }

      const slugify = (s: unknown) =>
        String(s ?? "")
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-_]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$|_/g, (m) => (m === "_" ? "-" : ""));

      const payload: Partial<Resource> = {
        title: resourceForm.title,
        type: resourceForm.type,
        format: resourceForm.format,
        domain: resourceForm.domain || undefined,
        path: resourceForm.path || undefined,
        category: resourceForm.category
          ? slugify(resourceForm.category)
          : undefined,
        summary: resourceForm.summary || undefined,
        sample_preview: resourceForm.samplePreview || undefined,
        tags: resourceForm.tags
          ? resourceForm.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : undefined,
        price_flat:
          (resourceForm.type !== "site" || resourceForm.flatFeeEnabled) &&
          resourceForm.priceFlat
            ? Number(resourceForm.priceFlat)
            : undefined,
        price_per_kb:
          resourceForm.type === "site" && resourceForm.pricePerKb
            ? Number(resourceForm.pricePerKb)
            : undefined,
        visibility: resourceForm.visibility,
        modes: Object.entries(resourceForm.modes)
          .filter(([, enabled]) => enabled)
          .map(([mode]) => mode as "raw" | "summary"),
        connector_id: resourceForm.connectorId || undefined,
      };

      if (walrusUpload) {
        (payload as any).walrus_blob_id = walrusUpload.walrus_blob_id;
        (payload as any).walrus_blob_object_id =
          walrusUpload.walrus_blob_object_id;
        (payload as any).cipher_meta = walrusUpload.cipher_meta;
        (payload as any).size_bytes = walrusUpload.size_bytes;
        (payload as any).seal_policy_id =
          import.meta.env.VITE_SEAL_POLICY_PACKAGE || undefined;
      }

      await api.createResource(payload);
      setResourceModalOpen(false);
      setResourceForm(defaultResourceForm);
      await loadPage();
    } catch (err: any) {
      setError(err.message || "Unable to create resource");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!resourceForm.domain || resourceForm.type !== "site") return;
    setGeneratingPreview(true);
    try {
      const url = `https://${resourceForm.domain}${resourceForm.path || "/"}`;
      const response = await fetch(url);
      const html = await response.text();
      const preview = html
        .substring(0, 500)
        .replace(/<[^>]*>/g, " ")
        .trim();
      setResourceForm({ ...resourceForm, samplePreview: preview });
    } catch (err: any) {
      setError(
        "Failed to generate preview. Make sure the domain is accessible.",
      );
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResourceForm({ ...resourceForm, file });
      if (!resourceForm.title) {
        setResourceForm({ ...resourceForm, file, title: file.name });
      }
      const epochs = Math.max(1, parseInt(resourceForm.epochs || "1", 10) || 1);
      api
        .getWalrusQuote({
          size_bytes: file.size,
          epochs,
          deletable: resourceForm.deletable,
        })
        .then((q) =>
          setWalrusQuote({
            wal_est: q.wal_est,
            sui_est: q.sui_est,
            encoded_bytes: q.encoded_bytes,
          }),
        )
        .catch(() => setWalrusQuote(null));
    }
  };

  const handleEpochsChange = async (val: string) => {
    setResourceForm({ ...resourceForm, epochs: val });
    const epochs = Math.max(1, parseInt(val || "1", 10) || 1);
    if (resourceForm.file) {
      try {
        const q = await api.getWalrusQuote({
          size_bytes: resourceForm.file.size,
          epochs,
          deletable: resourceForm.deletable,
        });
        setWalrusQuote({
          wal_est: q.wal_est,
          sui_est: q.sui_est,
          encoded_bytes: q.encoded_bytes,
        });
      } catch {
        setWalrusQuote(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-fog">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading resources…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-fog">
            Publish and manage your resource listings.
          </p>
        </div>
        <Button onClick={() => setResourceModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Resource
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          icon={FileText}
          color="text-blue-400"
          label="Total Resources"
          value={resources.length.toString()}
          helper="Active listings"
        />
        <StatCard
          icon={CheckCircle}
          color="text-green-400"
          label="Verified"
          value={resources.filter((r) => r.verified).length.toString()}
          helper={`${resources.length > 0 ? Math.round((resources.filter((r) => r.verified).length / resources.length) * 100) : 0}% rate`}
        />
        <StatCard
          icon={FileText}
          color="text-purple-400"
          label="Avg Price"
          value={
            resources.length > 0
              ? formatCurrency(
                  resources.reduce(
                    (sum, r) => sum + (r.price_flat || r.price_per_kb || 0),
                    0,
                  ) / resources.length,
                )
              : "$0.00"
          }
          helper="Per listing"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-6">
            {resources.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto mb-4 h-12 w-12 text-fog" />
                <p className="text-fog">No resources yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resources.map((resource) => {
                  const preview = resource.sample_preview || resource.summary;
                  const isExpanded = expandedResourceId === resource._id;
                  return (
                    <div
                      key={resource._id}
                      className="rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/30"
                    >
                      {/* Compact Header - Always Visible */}
                      <div className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() =>
                                setExpandedResourceId(
                                  isExpanded ? null : resource._id,
                                )
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-fog transition hover:border-white/30 hover:text-parchment"
                            >
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-parchment font-semibold">
                                  {resource.title}
                                </h3>
                                {resource.verified && (
                                  <CheckCircle className="h-4 w-4 text-parchment" />
                                )}
                                <span
                                  className={`rounded px-2 py-0.5 text-xs ${
                                    resource.visibility === "restricted"
                                      ? "bg-ember/10 text-ember"
                                      : "bg-white/5 text-parchment"
                                  }`}
                                >
                                  {resource.visibility || "public"}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fog">
                                <span className="rounded bg-white/5 px-2 py-1">
                                  {resource.type}
                                </span>
                                <span className="rounded bg-white/5 px-2 py-1 uppercase">
                                  {resource.format}
                                </span>
                                {resource.domain && (
                                  <span>{resource.domain}</span>
                                )}
                                {typeof resource.price_flat === "number" && (
                                  <span className="text-parchment">
                                    {formatCurrency(resource.price_flat)}
                                  </span>
                                )}
                                {typeof resource.price_per_kb === "number" && (
                                  <span className="text-parchment">
                                    {formatCurrency(resource.price_per_kb)}/KB
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(resource.type === "file" ||
                              resource.type === "dataset") &&
                              resource.size_bytes && (
                                <Button
                                  variant="ghost"
                                  className="h-9 px-3"
                                  onClick={async () => {
                                    setExtendResource(resource);
                                    setExtendAddEpochs("1");
                                    setExtendQuote(null);
                                    setExtendOpen(true);
                                    try {
                                      const q = await api.getWalrusExtendQuote({
                                        size_bytes: resource.size_bytes!,
                                        add_epochs: 1,
                                      });
                                      setExtendQuote({
                                        wal_est: q.wal_est,
                                        sui_est: q.sui_est,
                                        encoded_bytes: q.encoded_bytes,
                                      });
                                    } catch {
                                      setExtendQuote(null);
                                    }
                                  }}
                                >
                                  Extend
                                </Button>
                              )}
                            <Button
                              variant="ghost"
                              className="h-9 px-3 text-ember hover:text-ember"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Delete "${resource.title}"? This action cannot be undone.`,
                                  )
                                )
                                  return;
                                try {
                                  await api.deleteResource(resource._id);
                                  await loadPage();
                                } catch (err: any) {
                                  setError(
                                    err.message || "Failed to delete resource",
                                  );
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-white/10 p-4 pt-3">
                          {(resource.type === "file" ||
                            resource.type === "dataset") && (
                            <div className="mb-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                              {(resource as any).walrus_blob_id && (
                                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                                    Blob ID
                                  </div>
                                  <div
                                    className="truncate text-parchment font-mono text-[11px]"
                                    title={(resource as any).walrus_blob_id}
                                  >
                                    {(resource as any).walrus_blob_id.substring(
                                      0,
                                      12,
                                    )}
                                    ...
                                  </div>
                                </div>
                              )}
                              {resource.size_bytes && (
                                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                                    Size
                                  </div>
                                  <div className="text-parchment">
                                    {resource.size_bytes < 1024
                                      ? `${resource.size_bytes} B`
                                      : resource.size_bytes < 1024 * 1024
                                        ? `${(resource.size_bytes / 1024).toFixed(1)} KB`
                                        : `${(resource.size_bytes / (1024 * 1024)).toFixed(2)} MB`}
                                  </div>
                                </div>
                              )}
                              {(resource as any).cipher_meta && (
                                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                                    Encrypted
                                  </div>
                                  <div className="text-parchment uppercase">
                                    {(resource as any).cipher_meta.algo ||
                                      "AES"}
                                  </div>
                                </div>
                              )}
                              {typeof (resource as any).deletable ===
                                "boolean" && (
                                <div className="rounded-lg border border-white/5 bg-white/5 p-2">
                                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                                    Deletable
                                  </div>
                                  <div
                                    className={`font-medium ${(resource as any).deletable ? "text-green-400" : "text-red-400"}`}
                                  >
                                    {(resource as any).deletable ? "Yes" : "No"}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {preview && (
                            <div className="rounded-lg border border-white/5 bg-white/5 p-3 text-xs text-fog">
                              <div className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
                                Preview
                              </div>
                              <p className="whitespace-pre-wrap">{preview}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <Modal
        open={resourceModalOpen}
        title="Create resource"
        onClose={() => setResourceModalOpen(false)}
      >
        <form onSubmit={handleResourceSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <input
                required
                value={resourceForm.title}
                onChange={(e) =>
                  setResourceForm({ ...resourceForm, title: e.target.value })
                }
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
              />
            </Field>
            <Field label="Type">
              <FancySelect
                value={resourceForm.type}
                onChange={(val) => {
                  const newType = val as ResourceFormState["type"];
                  setResourceForm({
                    ...resourceForm,
                    type: newType,
                    format: FORMAT_OPTIONS[newType][0],
                    flatFeeEnabled: newType !== "site",
                  });
                }}
                options={[
                  { value: "site", label: "Site" },
                  { value: "dataset", label: "Dataset" },
                  { value: "file", label: "File" },
                ]}
              />
            </Field>
            <Field label="Format">
              <FancySelect
                value={resourceForm.format}
                onChange={(val) =>
                  setResourceForm({ ...resourceForm, format: val })
                }
                options={FORMAT_OPTIONS[resourceForm.type].map((fmt) => ({
                  value: fmt,
                  label: fmt,
                }))}
              />
            </Field>
            <Field label="Visibility">
              <FancySelect
                value={resourceForm.visibility}
                onChange={(val) =>
                  setResourceForm({
                    ...resourceForm,
                    visibility: val as ResourceFormState["visibility"],
                  })
                }
                options={[
                  { value: "public", label: "Public" },
                  { value: "restricted", label: "Restricted" },
                ]}
              />
            </Field>
          </div>
          {(resourceForm.type === "file" ||
            resourceForm.type === "dataset") && (
            <Field label="Upload File">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-parchment hover:border-white/40">
                  <Upload className="h-4 w-4" />
                  {resourceForm.file ? resourceForm.file.name : "Choose file"}
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {resourceForm.file && (
                  <span className="text-xs text-fog">
                    {(resourceForm.file.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-fog">
                    Storage Duration (epochs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={53}
                    value={resourceForm.epochs}
                    onChange={(e) => handleEpochsChange(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
                    placeholder="1"
                  />
                  <div className="mt-1 text-xs text-fog">
                    Testnet: ~1 day/epoch; Mainnet: ~14 days/epoch
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm text-fog">
                    <input
                      type="checkbox"
                      checked={!!resourceForm.deletable}
                      onChange={async (e) => {
                        const deletable = e.target.checked;
                        setResourceForm({ ...resourceForm, deletable });
                        if (resourceForm.file) {
                          try {
                            const q = await api.getWalrusQuote({
                              size_bytes: resourceForm.file.size,
                              epochs: Math.max(
                                1,
                                parseInt(resourceForm.epochs || "1", 10) || 1,
                              ),
                              deletable,
                            });
                            setWalrusQuote({
                              wal_est: q.wal_est,
                              sui_est: q.sui_est,
                              encoded_bytes: q.encoded_bytes,
                            });
                          } catch {
                            setWalrusQuote(null);
                          }
                        }
                      }}
                    />
                    Deletable
                  </label>
                </div>
                <div className="text-sm text-fog">
                  <div className="text-xs text-fog mb-1">Estimated Cost</div>
                  {walrusQuote ? (
                    <div className="text-parchment">
                      {walrusQuote.wal_est.toFixed(4)} WAL{" "}
                      <span className="text-fog">
                        +{" "}
                        {walrusQuote.sui_est !== null &&
                        walrusQuote.sui_est !== undefined
                          ? walrusQuote.sui_est.toFixed(3)
                          : "~"}{" "}
                        SUI gas
                      </span>
                    </div>
                  ) : (
                    <div className="text-fog/70">
                      Select a file to see estimate
                    </div>
                  )}
                </div>
              </div>
            </Field>
          )}
          <Field label="Category">
            <div className="relative" ref={catRef}>
              <input
                value={resourceForm.category}
                onChange={(e) => {
                  setResourceForm({
                    ...resourceForm,
                    category: e.target.value,
                  });
                  setCategoryOpen(true);
                }}
                onFocus={() => setCategoryOpen(true)}
                placeholder="Type to search or create new category"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
              />
              {categoryOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#121212]/95 p-1 shadow-2xl backdrop-blur">
                  {resourceForm.category &&
                    !allCategories.some(
                      (c) =>
                        String(c).toLowerCase() ===
                        String(resourceForm.category).toLowerCase(),
                    ) && (
                      <button
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-parchment hover:bg-white/10 flex items-center gap-2"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCategoryOpen(false);
                        }}
                      >
                        <span className="text-green-400">+</span> Create "
                        {resourceForm.category}"
                      </button>
                    )}
                  {allCategories
                    .filter(
                      (c) =>
                        !resourceForm.category ||
                        String(c)
                          .toLowerCase()
                          .includes(
                            String(resourceForm.category).toLowerCase(),
                          ),
                    )
                    .slice(0, 12)
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-full rounded-xl px-3 py-2 text-left text-sm text-parchment hover:bg-white/10"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setResourceForm({ ...resourceForm, category: c });
                          setCategoryOpen(false);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </Field>
          {resourceForm.type === "site" && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Domain">
                  {domains.filter((d) => d.status === "verified").length ===
                  0 ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                      <p className="text-parchment">
                        You need a verified domain to list site resources.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/dashboard/provider/domains")}
                        className="mt-1 text-parchment hover:underline"
                      >
                        Open Domains to verify
                      </button>
                    </div>
                  ) : (
                    <FancySelect
                      value={resourceForm.domain}
                      onChange={(val) =>
                        setResourceForm({ ...resourceForm, domain: val })
                      }
                      required
                      placeholder="Select verified domain"
                      options={domains
                        .filter((d) => d.status === "verified")
                        .map((d) => ({ value: d.domain, label: d.domain }))}
                    />
                  )}
                </Field>
                <Field label="Path">
                  <input
                    value={resourceForm.path}
                    onChange={(e) =>
                      setResourceForm({ ...resourceForm, path: e.target.value })
                    }
                    placeholder="/docs"
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
                  />
                </Field>
              </div>
            </>
          )}
          <Field label="Summary">
            <textarea
              value={resourceForm.summary}
              onChange={(e) =>
                setResourceForm({ ...resourceForm, summary: e.target.value })
              }
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-parchment focus:border-white/40 focus:outline-none"
            />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-fog">Sample preview</label>
              {resourceForm.type === "site" && resourceForm.domain && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleGeneratePreview}
                  disabled={generatingPreview}
                  className="h-7 gap-1 text-xs"
                >
                  {generatingPreview ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Auto-generate
                </Button>
              )}
            </div>
            <textarea
              value={resourceForm.samplePreview}
              onChange={(e) =>
                setResourceForm({
                  ...resourceForm,
                  samplePreview: e.target.value,
                })
              }
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-parchment focus:border-white/40 focus:outline-none"
            />
          </div>
          <Field label="Tags (comma separated)">
            <input
              value={resourceForm.tags}
              onChange={(e) =>
                setResourceForm({ ...resourceForm, tags: e.target.value })
              }
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
            />
          </Field>
          <div className="space-y-4 mt-8">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-parchment">Pricing</p>
              <p className="text-xs text-fog mb-3">
                Set how this resource is billed.
              </p>
              {resourceForm.type === "site" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-fog">
                      Price per KB (USD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={resourceForm.pricePerKb}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          pricePerKb: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
                      placeholder="e.g. 0.0012"
                    />
                    {walUsd &&
                      resourceForm.pricePerKb &&
                      Number(resourceForm.pricePerKb) > 0 && (
                        <div className="mt-1 text-xs text-fog">
                          ≈{" "}
                          {(Number(resourceForm.pricePerKb) / walUsd).toFixed(
                            6,
                          )}{" "}
                          WAL/KB
                        </div>
                      )}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs uppercase tracking-[0.2em] text-fog">
                        Flat price (USD)
                      </label>
                      <label className="flex items-center gap-2 text-xs text-fog">
                        <input
                          type="checkbox"
                          checked={resourceForm.flatFeeEnabled}
                          onChange={(e) =>
                            setResourceForm({
                              ...resourceForm,
                              flatFeeEnabled: e.target.checked,
                              priceFlat: e.target.checked
                                ? resourceForm.priceFlat
                                : "",
                            })
                          }
                        />
                        Include base flat fee
                      </label>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={resourceForm.priceFlat}
                      onChange={(e) =>
                        setResourceForm({
                          ...resourceForm,
                          priceFlat: e.target.value,
                        })
                      }
                      className={`w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none ${
                        resourceForm.flatFeeEnabled
                          ? ""
                          : "opacity-50 pointer-events-none"
                      }`}
                      placeholder="e.g. 0.50"
                      disabled={!resourceForm.flatFeeEnabled}
                    />
                    {walUsd &&
                      resourceForm.flatFeeEnabled &&
                      resourceForm.priceFlat &&
                      Number(resourceForm.priceFlat) > 0 && (
                        <div className="mt-1 text-xs text-fog">
                          ≈{" "}
                          {(Number(resourceForm.priceFlat) / walUsd).toFixed(4)}{" "}
                          WAL
                        </div>
                      )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-fog">
                    Flat price (USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={resourceForm.priceFlat}
                    onChange={(e) =>
                      setResourceForm({
                        ...resourceForm,
                        priceFlat: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
                    placeholder="e.g. 4.99"
                  />
                  {walUsd &&
                    resourceForm.priceFlat &&
                    Number(resourceForm.priceFlat) > 0 && (
                      <div className="mt-1 text-xs text-fog">
                        ≈ {(Number(resourceForm.priceFlat) / walUsd).toFixed(4)}{" "}
                        WAL
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 mt-6">
            <p className="text-sm font-medium text-parchment">Modes</p>
            <p className="text-xs text-fog mb-3">
              Raw returns original content as-is; Summary returns a concise
              provider-generated overview.
            </p>
            <div className="flex gap-4">
              {(["raw", "summary"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex items-center gap-2 text-sm text-fog capitalize"
                >
                  <input
                    type="checkbox"
                    checked={resourceForm.modes[mode]}
                    onChange={(e) =>
                      setResourceForm({
                        ...resourceForm,
                        modes: {
                          ...resourceForm.modes,
                          [mode]: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4 rounded border-white/10 bg-white/5"
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>
          <Field label="Connector">
            {connectors.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <p className="text-parchment">No connectors found.</p>
                <p className="text-xs text-fog">
                  Add a connector to authenticate private resources.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/provider/connectors")}
                  className="mt-1 text-parchment hover:underline"
                >
                  Open Connectors
                </button>
              </div>
            ) : (
              <FancySelect
                value={resourceForm.connectorId}
                onChange={(val) =>
                  setResourceForm({ ...resourceForm, connectorId: val })
                }
                placeholder="Select connector"
                options={connectors.map((connector) => ({
                  value: connector.id,
                  label: connector.type,
                }))}
              />
            )}
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResourceModalOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formSubmitting} className="gap-2">
              {uploadingFile ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading file…
                </>
              ) : formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={extendOpen}
        title="Extend storage"
        onClose={() => {
          setExtendOpen(false);
          setExtendResource(null);
        }}
      >
        <div className="space-y-3">
          <div className="text-sm text-fog">{extendResource?.title}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-fog">Add Epochs</label>
              <input
                type="number"
                min={1}
                max={53}
                value={extendAddEpochs}
                onChange={async (e) => {
                  const v = e.target.value;
                  setExtendAddEpochs(v);
                  const n = Math.max(1, parseInt(v || "1", 10) || 1);
                  if (extendResource?.size_bytes) {
                    try {
                      const q = await api.getWalrusExtendQuote({
                        size_bytes: extendResource.size_bytes,
                        add_epochs: n,
                      });
                      setExtendQuote({
                        wal_est: q.wal_est,
                        sui_est: q.sui_est,
                        encoded_bytes: q.encoded_bytes,
                      });
                    } catch {
                      setExtendQuote(null);
                    }
                  }
                }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-parchment focus:border-white/40 focus:outline-none"
              />
              <div className="mt-1 text-xs text-fog">
                Testnet: ~1 day/epoch; Mainnet: ~14 days/epoch
              </div>
            </div>
            <div className="md:col-span-1">
              <div className="text-xs text-fog mb-1">Estimated Cost</div>
              {extendQuote ? (
                <div className="text-parchment text-sm">
                  {extendQuote.wal_est.toFixed(4)} WAL{" "}
                  <span className="text-fog">
                    +{" "}
                    {extendQuote.sui_est !== null &&
                    extendQuote.sui_est !== undefined
                      ? extendQuote.sui_est.toFixed(3)
                      : "~"}{" "}
                    SUI gas
                  </span>
                </div>
              ) : (
                <div className="text-fog/70 text-sm">
                  Enter epochs to see estimate
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setExtendOpen(false);
                setExtendResource(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!extendResource) return;
                setFormSubmitting(true);
                setError("");
                try {
                  const epochs = Math.max(
                    1,
                    parseInt(extendAddEpochs || "1", 10) || 1,
                  );
                  await api.extendWalrusStorage({
                    resource_id: extendResource._id,
                    add_epochs: epochs,
                  });
                  setExtendOpen(false);
                  setExtendResource(null);
                  await loadPage();
                } catch (err: any) {
                  setError(err.message || "Failed to extend storage");
                } finally {
                  setFormSubmitting(false);
                }
              }}
              disabled={formSubmitting}
              className="gap-2"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extending...
                </>
              ) : (
                "Extend Storage"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm text-fog">
      <span>{label}</span>
      {children}
    </label>
  );
}

type Option = { label: string; value: string };

function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  name,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  name?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((opt) => opt.value === value);

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        className="sr-only"
        tabIndex={-1}
        name={name}
        value={value}
        readOnly
        required={required}
      />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-parchment transition hover:border-white/30 focus:border-white/40 focus:outline-none"
      >
        <span className={selected ? "" : "text-fog/70"}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-fog" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#121212]/95 p-1 shadow-2xl backdrop-blur">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-white/10 text-parchment"
                    : "text-parchment hover:bg-white/10"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  label,
  value,
  helper,
}: {
  icon: any;
  color: string;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between">
          <div
            className={`w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center ${color}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="text-2xl font-semibold text-parchment">{value}</div>
        <div className="text-sm text-fog">{label}</div>
        <div className="text-xs text-fog mt-1">{helper}</div>
      </CardContent>
    </Card>
  );
}
