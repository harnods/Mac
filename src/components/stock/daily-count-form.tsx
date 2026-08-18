"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, ChevronsUpDown, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Qty } from "@/components/ui/qty";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createDailyStockCount,
  deleteDailyCountTemplate,
  saveDailyCountTemplate,
  type DailyCountCategoryOption,
  type DailyCountItemOption,
  type DailyCountTemplate,
} from "@/app/actions/daily-stock";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_CATEGORIES = "__all__";
const UNCATEGORIZED = "__uncategorized__";
const ALL_TYPES = "__all__";

const TYPE_LABEL: Record<string, string> = {
  ingredient: "Ingredient",
  prep_item: "Prep item",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyCountForm({
  items,
  categories,
  templates: initialTemplates,
}: {
  items: DailyCountItemOption[];
  categories: DailyCountCategoryOption[];
  templates: DailyCountTemplate[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [templates, setTemplates] = useState(initialTemplates);
  const [countDate, setCountDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState(ALL_TYPES);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || item.name.toLowerCase().includes(q);
      const matchesType = itemType === ALL_TYPES || item.type === itemType;
      const matchesCategory =
        category === ALL_CATEGORIES ||
        (category === UNCATEGORIZED ? item.category_id == null : item.category_id === category);
      return matchesQuery && matchesType && matchesCategory;
    });
  }, [category, items, itemType, query]);

  const selectedItems = items.filter((item) => selected.has(item.id));
  const selectedCount = selectedItems.length;
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selected.has(item.id));

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredItems.forEach((item) => next.delete(item.id));
      else filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function applyTemplate(template: DailyCountTemplate) {
    const known = new Set(items.map((item) => item.id));
    const usable = template.item_ids.filter((id) => known.has(id));
    setSelected(new Set(usable));

    const missing = template.item_ids.length - usable.length;
    toast.success(
      missing > 0
        ? `${usable.length} items loaded — ${missing} no longer available`
        : `${usable.length} items loaded from "${template.name}"`,
    );
  }

  function removeTemplate(template: DailyCountTemplate) {
    start(async () => {
      const res = await deleteDailyCountTemplate(template.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      toast.success(`Template "${template.name}" deleted`);
    });
  }

  function submit() {
    if (selectedCount === 0) {
      toast.error("Select at least one item to count");
      return;
    }

    start(async () => {
      const res = await createDailyStockCount({
        count_date: countDate,
        note: note.trim() || undefined,
        items: selectedItems.map((item) => ({ item_id: item.id })),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Daily stock count created");
      router.push(`/stock/daily-counts/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col flex-1 gap-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="max-w-lg space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="count-date">Count date</Label>
            <Input
              id="count-date"
              type="date"
              value={countDate}
              onChange={(e) => setCountDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Record the day&rsquo;s sales first, then create the count. Opening is each
              item&rsquo;s on hand right now with this date&rsquo;s sales added back, and the Sold
              column subtracts them again.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="count-note">Note</Label>
            <Textarea
              id="count-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Item template</Label>
            <div className="flex flex-wrap items-center gap-2">
              <TemplatePicker
                templates={templates}
                onPick={applyTemplate}
                onDelete={removeTemplate}
              />
              <SaveTemplateButton
                selectedIds={selectedItems.map((item) => item.id)}
                templates={templates}
                onSaved={(template) =>
                  setTemplates((prev) => {
                    const rest = prev.filter((t) => t.id !== template.id);
                    return [...rest, template].sort((a, b) => a.name.localeCompare(b.name));
                  })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Load a saved item set instead of picking items by hand every day.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Items to count</h2>
          <p className="text-sm text-muted-foreground">{selectedCount} selected</p>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TYPES}>All types</SelectItem>
                <SelectItem value="ingredient">Ingredients</SelectItem>
                <SelectItem value="prep_item">Prep items</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative w-full sm:ml-auto sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search items..."
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          No ingredients or prep items found.
        </div>
      ) : (
        <div className="table-outer overflow-x-auto rounded-lg border">
          <Table className="w-auto min-w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 pl-2 pr-0">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFiltered}
                    aria-label="Select visible items"
                    className="size-4 rounded border-border"
                  />
                </TableHead>
                <TableHead className="w-[240px]">Item</TableHead>
                <TableHead className="w-[160px]">Type</TableHead>
                <TableHead className="w-[160px]">Category</TableHead>
                <TableHead className="w-[120px]">Unit</TableHead>
                <TableHead className="w-[160px] text-right">Current on hand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-2 pr-0">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      aria-label={`Select ${item.name}`}
                      className="size-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell className="font-medium truncate">
                    {item.name}
                    {item.brand && (
                      <span className="block text-xs font-normal text-muted-foreground truncate">
                        {item.brand}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{TYPE_LABEL[item.type] ?? item.type}</TableCell>
                  <TableCell className="text-sm">
                    {item.categories?.name ?? (
                      <span className="text-muted-foreground">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Qty value={Number(item.on_hand)} unit={item.unit} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    No items match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="button" disabled={pending || selectedCount === 0} onClick={submit}>
          {pending ? "Creating..." : "Create daily count"}
        </Button>
      </div>
    </div>
  );
}

function TemplatePicker({
  templates,
  onPick,
  onDelete,
}: {
  templates: DailyCountTemplate[];
  onPick: (template: DailyCountTemplate) => void;
  onDelete: (template: DailyCountTemplate) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-56 justify-between font-normal">
          <span className={cn("truncate", templates.length === 0 && "text-muted-foreground")}>
            {templates.length === 0 ? "No templates yet" : "Load template"}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search templates..." />
          <CommandList>
            <CommandEmpty>No templates found.</CommandEmpty>
            <CommandGroup>
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  value={template.name}
                  onSelect={() => {
                    onPick(template);
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {template.name}
                    <span className="block text-xs text-muted-foreground">
                      {template.item_ids.length} item{template.item_ids.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground"
                    aria-label={`Delete ${template.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(template);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SaveTemplateButton({
  selectedIds,
  templates,
  onSaved,
}: {
  selectedIds: string[];
  templates: DailyCountTemplate[];
  onSaved: (template: DailyCountTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, start] = useTransition();

  const trimmed = name.trim();
  const overwriting = templates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());

  function submit() {
    if (selectedIds.length === 0) {
      toast.error("Select the items you want to save first");
      return;
    }
    start(async () => {
      const res = await saveDailyCountTemplate({
        name: trimmed,
        items: selectedIds.map((item_id) => ({ item_id })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSaved(res.template);
      toast.success(`Template "${res.template.name}" saved`);
      setName("");
      setOpen(false);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={selectedIds.length === 0}
      >
        <Bookmark className="size-4" /> Save as template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              {selectedIds.length} selected item{selectedIds.length !== 1 ? "s" : ""} will be saved
              under this name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
            {overwriting && (
              <p className="text-xs text-muted-foreground">
                A template named &ldquo;{overwriting.name}&rdquo; already exists — saving replaces
                its items.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving || trimmed === ""}>
              {saving ? "Saving..." : overwriting ? "Replace template" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
