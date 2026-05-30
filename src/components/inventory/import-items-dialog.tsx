"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, ClipboardPaste, AlertCircle, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { importItems } from "@/app/actions/inventory";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { ImportRow } from "@/app/actions/inventory";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = ImportRow & { _rowNum: number; _errors: string[] };

type ColumnMapping = {
  name: string;      // required
  unit: string;      // required
  category: string;  // optional, "" = skip
};

type FileData = {
  headers: string[];
  rows: string[][];
};

type Step = "upload" | "map" | "preview" | "done";

type Props = {
  itemTypeSlug: ItemTypeSlug;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SKIP = "__skip__";

// ─── File parsing ─────────────────────────────────────────────────────────────

function readFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        resolve(XLSX.read(data, { type: "array" }));
      } catch {
        reject(new Error("Failed to parse file. Make sure it's a valid Excel or CSV file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

function extractFileData(wb: XLSX.WorkBook): FileData | string {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if ((raw[i] as unknown[]).some((c) => String(c).trim() !== "")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return "The file appears to be empty.";

  const headers = (raw[headerIdx] as unknown[])
    .map((h) => String(h).trim())
    .filter(Boolean);
  if (headers.length === 0) return "No columns found in the header row.";

  const rows: string[][] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] as unknown[];
    const cells = headers.map((_, ci) => String(r[ci] ?? "").trim());
    if (cells.some((c) => c !== "")) rows.push(cells);
  }

  if (rows.length === 0) return "No data rows found after the header row.";
  return { headers, rows };
}

// Parse text copied from Excel/Google Sheets (tab-separated)
function parsePastedText(text: string): FileData | string {
  const raw = text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((c) => c.trim()));

  // Find first non-empty row as header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (raw[i].some((c) => c !== "")) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return "Pasted content appears to be empty.";

  const headers = raw[headerIdx].filter(Boolean);
  if (headers.length === 0) return "No columns found in the pasted header row.";

  const rows: string[][] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const cells = headers.map((_, ci) => raw[i][ci]?.trim() ?? "");
    if (cells.some((c) => c !== "")) rows.push(cells);
  }

  if (rows.length === 0) return "No data rows found — make sure you copied the header row and data rows.";
  return { headers, rows };
}

function guessMapping(
  headers: string[],
  hasCategories: boolean
): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (aliases: string[]) => {
    for (const a of aliases) {
      const i = lower.indexOf(a);
      if (i !== -1) return headers[i];
    }
    return "";
  };
  return {
    name:     find(["name", "nama", "item", "item name", "product", "produk", "bahan", "ingredient", "supply"]),
    unit:     find(["unit", "satuan", "uom", "unit of measure"]),
    category: hasCategories ? find(["category", "kategori", "cat", "group", "grup", "kelompok"]) : "",
  };
}

function applyMapping(fileData: FileData, mapping: ColumnMapping): ParsedRow[] {
  const { headers, rows } = fileData;
  const idx = (col: string) => (col && col !== SKIP ? headers.indexOf(col) : -1);

  const nameIdx = idx(mapping.name);
  const unitIdx = idx(mapping.unit);
  const catIdx  = idx(mapping.category);

  return rows.map((r, i) => {
    const name     = nameIdx >= 0 ? r[nameIdx] : "";
    const unit     = unitIdx >= 0 ? r[unitIdx] : "";
    const category = catIdx  >= 0 ? r[catIdx]  : "";

    const row: ImportRow = { name, unit };
    if (category) row.category_name = category;

    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required");
    if (!unit.trim()) errs.push("Unit is required");

    return { ...row, _rowNum: i + 2, _errors: errs };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportItemsDialog({ itemTypeSlug, open, onOpenChange }: Props) {
  const config = ITEM_TYPE_CONFIG[itemTypeSlug];
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep]               = useState<Step>("upload");
  const [uploadMethod, setUploadMethod] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText]     = useState("");
  const [fileData, setFileData]       = useState<FileData | null>(null);
  const [mapping, setMapping]         = useState<ColumnMapping>({ name: "", unit: "", category: "" });
  const [rows, setRows]               = useState<ParsedRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skipped: string[];
    created: { categories: string[]; units: string[] };
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("upload");
    setUploadMethod("file");
    setPasteText("");
    setFileData(null);
    setRows([]);
    setImportResult(null);
  }, [open, itemTypeSlug]);

  const processFile = useCallback(async (file: File) => {
    try {
      const wb = await readFile(file);
      const result = extractFileData(wb);
      if (typeof result === "string") { toast.error(result); return; }
      setFileData(result);
      setMapping(guessMapping(result.headers, config.hasCategories));
      setStep("map");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to read file");
    }
  }, [config.hasCategories]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handlePasteContinue() {
    if (!pasteText.trim()) { toast.error("Paste some data first."); return; }
    const result = parsePastedText(pasteText);
    if (typeof result === "string") { toast.error(result); return; }
    setFileData(result);
    setMapping(guessMapping(result.headers, config.hasCategories));
    setStep("map");
  }

  function handleConfirmMapping() {
    if (!fileData) return;
    if (!mapping.name) { toast.error("Please map the Name column."); return; }
    if (!mapping.unit) { toast.error("Please map the Unit column."); return; }
    setRows(applyMapping(fileData, mapping));
    setStep("preview");
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r._errors.length === 0);
    if (validRows.length === 0) { toast.error("No valid rows to import."); return; }

    setLoading(true);
    const payload: ImportRow[] = validRows.map(({ _rowNum: _, _errors: __, ...rest }) => rest);
    const result = await importItems(itemTypeSlug, payload);
    setLoading(false);

    if (!result.ok) { toast.error(result.error); return; }
    setImportResult({ inserted: result.inserted, skipped: result.skipped, created: result.created });
    setStep("done");
    router.refresh();
  }

  const errorCount = rows.filter((r) => r._errors.length > 0).length;
  const validCount = rows.length - errorCount;

  const ColSelect = ({
    field,
    label,
    required,
  }: {
    field: keyof ColumnMapping;
    label: string;
    required?: boolean;
  }) => {
    const currentVal = mapping[field];
    const previewVal =
      currentVal && fileData
        ? fileData.rows[0]?.[fileData.headers.indexOf(currentVal)] ?? ""
        : "";

    return (
      <div className="flex items-center gap-3">
        <div className="w-24 shrink-0 text-sm">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </div>
        <Select
          value={currentVal || SKIP}
          onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === SKIP ? "" : v }))}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select column…" />
          </SelectTrigger>
          <SelectContent>
            {!required && <SelectItem value={SKIP}>— Skip —</SelectItem>}
            {(fileData?.headers ?? []).map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {previewVal && (
          <span className="text-xs text-muted-foreground w-36 truncate">
            e.g. {previewVal}
          </span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {config.label.toLowerCase()}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {(["upload", "map", "preview", "done"] as Step[]).map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className={step === s ? "text-foreground font-medium" : undefined}>
                {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < arr.length - 1 && <span>›</span>}
            </span>
          ))}
        </div>

        {/* ── Upload ── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Method tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <button
                onClick={() => setUploadMethod("file")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  uploadMethod === "file"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="size-3.5" />
                Upload file
              </button>
              <button
                onClick={() => setUploadMethod("paste")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  uploadMethod === "paste"
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ClipboardPaste className="size-3.5" />
                Paste from spreadsheet
              </button>
            </div>

            {/* File upload */}
            {uploadMethod === "file" && (
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls, or .csv</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            )}

            {/* Paste from spreadsheet */}
            {uploadMethod === "paste" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select and copy cells from Excel or Google Sheets (including the header row), then paste below.
                </p>
                <Textarea
                  className="font-mono text-xs h-48 resize-none"
                  placeholder={"Name\tCategory\tUnit\nTepung Terigu\tBahan Kering\tkg\nGula Pasir\tBahan Kering\tkg"}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  onPaste={(e) => {
                    // capture before React recycles the event
                    const pasted = e.clipboardData.getData("text").trim();
                    if (!pasted) return;
                    const result = parsePastedText(pasted);
                    if (typeof result !== "string") {
                      setPasteText(pasted);
                      setFileData(result);
                      setMapping(guessMapping(result.headers, config.hasCategories));
                      setStep("map");
                    } else {
                      toast.error(result);
                    }
                  }}
                />
                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setPasteText("")} disabled={!pasteText}>
                    Clear
                  </Button>
                  <Button onClick={handlePasteContinue} disabled={!pasteText.trim()}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {uploadMethod === "file" && (
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}

        {/* ── Map ── */}
        {step === "map" && fileData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your file&apos;s columns to the required fields.
              Missing categories and units will be created automatically.
            </p>

            {/* File preview — first 2 rows */}
            <div className="border rounded-lg overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    {fileData.headers.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileData.rows.slice(0, 2).map((r, i) => (
                    <TableRow key={i}>
                      {r.map((cell, ci) => (
                        <TableCell key={ci} className="text-muted-foreground max-w-[140px] truncate">
                          {cell || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mapping selects */}
            <div className="space-y-3">
              <ColSelect field="name"     label="Name"     required />
              {config.hasCategories && <ColSelect field="category" label="Category" />}
              <ColSelect field="unit"     label="Unit"     required />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setStep("upload"); setFileData(null); setPasteText(""); }}>
                Back
              </Button>
              <Button onClick={handleConfirmMapping}>
                Preview {fileData.rows.length} row{fileData.rows.length !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              {errorCount === 0 ? (
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="size-4" />
                  {rows.length} rows ready
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertCircle className="size-4" />
                  {validCount} valid, {errorCount} with errors (will be skipped)
                </span>
              )}
              <Button variant="outline" size="sm" className="ml-auto" onClick={() => setStep("map")}>
                Adjust mapping
              </Button>
            </div>

            <div className="border rounded-lg overflow-auto max-h-80">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="w-56">Name</TableHead>
                    {config.hasCategories && <TableHead className="w-36">Category</TableHead>}
                    <TableHead className="w-24">Unit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row._rowNum}
                      className={row._errors.length > 0 ? "bg-destructive/5" : undefined}
                    >
                      <TableCell className="text-muted-foreground text-xs tabular-nums">
                        {row._rowNum}
                      </TableCell>
                      <TableCell className="truncate">
                        {row.name || <span className="text-muted-foreground italic">—</span>}
                      </TableCell>
                      {config.hasCategories && (
                        <TableCell className="truncate text-muted-foreground">
                          {row.category_name || "—"}
                        </TableCell>
                      )}
                      <TableCell>{row.unit || <span className="text-muted-foreground italic">—</span>}</TableCell>
                      <TableCell>
                        {row._errors.length > 0 && (
                          <span className="text-xs text-destructive">{row._errors.join("; ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={loading || validCount === 0}>
                {loading ? "Importing…" : `Import ${validCount} item${validCount !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && importResult && (
          <div className="space-y-4">
            {importResult.inserted > 0 ? (
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                <CheckCircle2 className="size-5 text-green-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {importResult.inserted} item{importResult.inserted !== 1 ? "s" : ""} imported successfully.
                  </p>
                  {importResult.created.categories.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      New categories: {importResult.created.categories.join(", ")}
                    </p>
                  )}
                  {importResult.created.units.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      New units: {importResult.created.units.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900">No items were imported.</p>
                  {importResult.skipped.length > 0 && (
                    <p className="text-xs text-amber-700">All {importResult.skipped.length} row{importResult.skipped.length !== 1 ? "s" : ""} were skipped — see reasons below.</p>
                  )}
                </div>
              </div>
            )}

            {importResult.skipped.length > 0 && (
              <div className="border rounded-lg p-3 max-h-48 overflow-auto">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Skipped rows ({importResult.skipped.length})
                </p>
                <ul className="text-xs space-y-1">
                  {importResult.skipped.map((s, i) => (
                    <li key={i} className="text-muted-foreground">• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              {importResult.inserted === 0 && (
                <Button variant="outline" onClick={() => setStep("map")}>
                  Adjust mapping
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
