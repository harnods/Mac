"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createStockCount,
  getStockCountOptions,
  type StockCountCategoryOption,
  type StockCountItemOption,
} from "@/app/actions/stock";
import { formatDateTime } from "@/lib/format";
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
  supply: "Supply",
  prep_item: "Prep item",
};

export function CountForm({
  items,
  categories,
}: {
  items: StockCountItemOption[];
  categories: StockCountCategoryOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  const [currentItems, setCurrentItems] = useState(items);
  const [currentCategories, setCurrentCategories] = useState(categories);
  const [query, setQuery] = useState("");
  const [itemType, setItemType] = useState(ALL_TYPES);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return currentItems.filter((item) => {
      const matchesQuery = !q || item.name.toLowerCase().includes(q);
      const matchesType = itemType === ALL_TYPES || item.type === itemType;
      const matchesCategory =
        category === ALL_CATEGORIES ||
        (category === UNCATEGORIZED ? item.category_id == null : item.category_id === category);
      return matchesQuery && matchesType && matchesCategory;
    });
  }, [category, currentItems, itemType, query]);

  const selectedItems = currentItems.filter((item) => selected.has(item.id));
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
      if (allFilteredSelected) {
        filteredItems.forEach((item) => next.delete(item.id));
      } else {
        filteredItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }

  function submit() {
    if (selectedCount === 0) {
      toast.error("Select at least one item to count");
      return;
    }

    start(async () => {
      const res = await createStockCount({
        items: selectedItems.map((item) => ({ item_id: item.id })),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Cycle count task created");
      router.push(`/stock/counts/${res.id}`);
      router.refresh();
    });
  }

  function refreshData() {
    startRefresh(async () => {
      const res = await getStockCountOptions();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setCurrentItems(res.items);
      setCurrentCategories(res.categories);
      toast.success("Item list refreshed");
    });
  }

  return (
    <div className="flex flex-col flex-1 gap-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Items to count</h2>
          <p className="text-sm text-muted-foreground">
            {selectedCount} selected
          </p>
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
                {currentCategories.map((cat) => (
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
                <SelectItem value="supply">Supplies</SelectItem>
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

      {currentItems.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          No active stock items found.
        </div>
      ) : (
        <div className="table-outer overflow-hidden rounded-lg border">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 pl-4">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleFiltered}
                    aria-label="Select visible items"
                    className="size-4 rounded border-border"
                  />
                </TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-44">Category</TableHead>
                <TableHead className="w-24">Unit</TableHead>
                <TableHead className="w-36 text-right">Current on hand</TableHead>
                <TableHead className="w-44">Last counted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-4">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      aria-label={`Select ${item.name}`}
                      className="size-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
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
                  <TableCell className="text-sm">
                    {item.last_counted_at ? (
                      formatDateTime(item.last_counted_at)
                    ) : (
                      <span className="text-muted-foreground">Never counted</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                    No items match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="sticky bottom-0 z-10 mt-auto -mx-1 flex justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="button" variant="outline" onClick={refreshData} disabled={refreshing || pending}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          {refreshing ? "Refreshing..." : "Refresh data"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="button" disabled={pending || selectedCount === 0} onClick={submit}>
          {pending ? "Creating..." : "Create count task"}
        </Button>
      </div>
    </div>
  );
}
