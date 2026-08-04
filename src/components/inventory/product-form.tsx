"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, ImagePlus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryCombobox } from "./category-combobox";
import { parseDecimal } from "@/lib/units";
import { createProductItem, updateProductItem } from "@/app/actions/inventory";
import { createUnit } from "@/app/actions/units";
import { createClient } from "@/lib/supabase/client";
import type { Item } from "@/lib/supabase/types";
import type { SetProductEntry, ProductFormData } from "@/app/actions/inventory";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ProductKind = "ala_carte" | "set";

type Props = {
  categories: { id: string; name: string }[];
  units: string[];
  products: ProductFormData["products"];
  item?: Item & { product_kind?: string };
  setProducts?: SetProductEntry[];
  unitLocked?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ProductForm({
  categories, units: initialUnits, products, item,
  setProducts: initialSetProducts = [],
  unitLocked = false, onSuccess, onCancel,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const isEdit = !!item;
  const defaultKind = (item?.product_kind ?? "ala_carte") as ProductKind;

  const [productKind, setProductKind] = useState<ProductKind>(defaultKind);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState((item as (Item & { description?: string | null }) | undefined)?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [unit, setUnit] = useState(productKind === "set" ? "set" : (item?.unit ?? "pcs"));
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [units, setUnits] = useState(initialUnits);
  const [creatingUnit, startCreateUnit] = useTransition();

  const [setProducts, setSetProducts] = useState<SetProductEntry[]>(initialSetProducts);
  const [productOpen, setProductOpen] = useState(false);

  const itemAny = item as (Item & { is_sellable?: boolean; sell_price?: number | null; is_addon?: boolean }) | undefined;
  const [isSellable, setIsSellable] = useState(itemAny?.is_sellable ?? false);
  const [sellPrice, setSellPrice] = useState(
    itemAny?.sell_price != null ? String(itemAny.sell_price) : "",
  );
  const [isAddon, setIsAddon] = useState(itemAny?.is_addon ?? false);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error("Image must be under 5MB"); return; }

    setUploadingImage(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${item?.id ?? crypto.randomUUID()}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    setUploadingImage(false);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  function handleKindChange(kind: ProductKind) {
    setProductKind(kind);
    if (kind === "set") setUnit("set");
    else setUnit(item?.unit ?? "pcs");
  }

  function addSetProduct(id: string) {
    if (!setProducts.find((p) => p.id === id)) {
      setSetProducts((prev) => [...prev, { id, qty: 1 }]);
    }
    setProductOpen(false);
  }

  function removeSetProduct(id: string) {
    setSetProducts((prev) => prev.filter((p) => p.id !== id));
  }

  function updateSetProductQty(id: string, qty: number) {
    setSetProducts((prev) => prev.map((p) => p.id === id ? { ...p, qty } : p));
  }

  const exactMatch = units.some((u) => u.toLowerCase() === unitSearch.toLowerCase());

  function handleQuickAddUnit() {
    if (!unitSearch.trim() || exactMatch) return;
    const code = unitSearch.trim();
    startCreateUnit(async () => {
      const res = await createUnit({ code });
      if (!res.ok) { toast.error(res.error); return; }
      setUnits((prev) => [...prev, code].sort());
      setUnit(code);
      setUnitSearch("");
      setUnitOpen(false);
      toast.success(`Unit "${code}" created`);
    });
  }

  function handleSubmit(targetStatus: "active" | "draft") {
    if (targetStatus === "active") {
      if (!name.trim()) { toast.error("Name is required"); return; }
      if (productKind === "set" && setProducts.length === 0) {
        toast.error("Add at least one product to the set");
        return;
      }
    }

    start(async () => {
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        product_kind: productKind,
        unit: productKind === "set" ? "set" : unit,
        status: targetStatus,
        is_sellable: isSellable,
        sell_price: isSellable && sellPrice.trim() ? parseDecimal(sellPrice) : null,
        is_addon: isAddon,
        image_url: imageUrl,
        description: description.trim() || null,
        set_products: productKind === "set" ? setProducts : [],
      };

      const res = isEdit
        ? await updateProductItem(item!.id, payload)
        : await createProductItem(payload);

      if (!res.ok) { toast.error(res.error); return; }
      toast.success(
        targetStatus === "draft"
          ? isEdit ? "Saved as draft" : "Saved as draft"
          : isEdit ? "Saved" : "Product created"
      );
      router.refresh();
      if (onSuccess) onSuccess();
      else router.push(`/inventory/products`);
    });
  }

  const selectedSetProducts = products.filter((p) => setProducts.find((s) => s.id === p.id));
  const availableProducts = products.filter((p) => !setProducts.find((s) => s.id === p.id));

  return (
    <form className="flex flex-col flex-1 gap-4">
      {/* Kind toggle */}
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="flex gap-4">
          {(["ala_carte", "set"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="product_kind"
                value={k}
                checked={productKind === k}
                onChange={() => handleKindChange(k)}
                className="accent-primary"
                disabled={isEdit && unitLocked}
              />
              <span className="text-sm font-medium">
                {k === "ala_carte" ? "Ala carte" : "Set"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of the product"
        />
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <Label>Photo</Label>
        <div className="flex items-center gap-3">
          <div className="size-20 rounded-lg border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={name || "Product"} className="size-full object-cover" />
            ) : (
              <ImagePlus className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="product-image" className="cursor-pointer">
              <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                {uploadingImage ? "Uploading..." : imageUrl ? "Change photo" : "Upload photo"}
              </span>
              <input
                id="product-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingImage}
                onChange={handleImageChange}
              />
            </Label>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="text-xs text-muted-foreground hover:text-foreground text-left"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Shown on the customer order menu. PNG, JPEG, or WebP, up to 5MB.</p>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category</Label>
        <CategoryCombobox
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          catType="product"
        />
      </div>

      {/* Unit */}
      <div className="space-y-2">
        <Label>Unit</Label>
        {productKind === "set" ? (
          <div className="border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground">
            set
          </div>
        ) : (
          <Popover open={unitOpen} onOpenChange={setUnitOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                disabled={unitLocked}
                className="w-full justify-between font-normal"
              >
                <span className={cn(!unit && "text-muted-foreground")}>
                  {unit || "Select unit"}
                </span>
                <ChevronsUpDown className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search or create unit..."
                  value={unitSearch}
                  onValueChange={setUnitSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {unitSearch.trim() ? (
                      <button
                        type="button"
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                        onClick={handleQuickAddUnit}
                        disabled={creatingUnit}
                      >
                        <Plus className="size-3.5" />
                        {creatingUnit ? "Creating..." : `Create "${unitSearch.trim()}"`}
                      </button>
                    ) : "No units found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {units.map((u) => (
                      <CommandItem
                        key={u}
                        value={u}
                        onSelect={() => { setUnit(u); setUnitSearch(""); setUnitOpen(false); }}
                      >
                        <Check className={cn("size-4", unit === u ? "opacity-100" : "opacity-0")} />
                        {u}
                      </CommandItem>
                    ))}
                    {unitSearch.trim() && !exactMatch && (
                      <CommandItem
                        value={`__create__${unitSearch}`}
                        onSelect={handleQuickAddUnit}
                        disabled={creatingUnit}
                        className="text-muted-foreground"
                      >
                        <Plus className="size-4" />
                        {creatingUnit ? "Creating..." : `Create "${unitSearch.trim()}"`}
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Sell to customers (shows on the customer order menu) */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Switch id="sellable" checked={isSellable} onCheckedChange={setIsSellable} />
          <Label htmlFor="sellable" className="cursor-pointer">
            Sell to customers (shown on the order menu)
          </Label>
        </div>
        {isSellable && (
          <div className="space-y-2">
            <Label htmlFor="sell-price">Selling price</Label>
            <DecimalInput
              id="sell-price"
              min="0"
              step="100"
              value={sellPrice}
              onValueChange={setSellPrice}
              className="w-40"
            />
          </div>
        )}
      </div>

      {/* Add-on */}
      <div className="flex items-center gap-2 rounded-lg border p-3">
        <Switch id="addon" checked={isAddon} onCheckedChange={setIsAddon} />
        <Label htmlFor="addon" className="cursor-pointer">
          Sell as add-on (extra topping/side offered on other products)
        </Label>
      </div>

      {/* Set items */}
      {productKind === "set" && (
        <div className="space-y-2">
          <Label>Included products</Label>

          {selectedSetProducts.length > 0 && (
            <ul className="space-y-1">
              {selectedSetProducts.map((p) => {
                const entry = setProducts.find((s) => s.id === p.id)!;
                return (
                  <li key={p.id} className="flex items-center gap-2 border rounded-md px-3 py-2">
                    <span className="flex-1 text-sm flex items-center gap-2">
                      {p.name}
                      {p.itemType === "prep_item" && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">prep</span>
                      )}
                    </span>
                    <DecimalInput
                      integer
                      min="1"
                      step="1"
                      value={String(entry.qty)}
                      onValueChange={(v) => updateSetProductQty(p.id, parseDecimal(v) || 1)}
                      className="w-16 h-7 text-sm text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeSetProduct(p.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <Popover open={productOpen} onOpenChange={setProductOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Plus className="size-3.5" /> Add product
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search products..." />
                <CommandList>
                  <CommandEmpty>No products available.</CommandEmpty>
                  <CommandGroup>
                    {availableProducts.map((p) => (
                      <CommandItem key={p.id} value={p.name} onSelect={() => addSetProduct(p.id)}>
                        <span className="flex items-center gap-2 flex-1">
                          <span>{p.name}</span>
                          {p.itemType === "prep_item" && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">prep</span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 z-10 mt-auto -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" variant="outline" onClick={() => handleSubmit("draft")} disabled={pending}>
          {pending ? "Saving..." : "Save as draft"}
        </Button>
        <Button type="button" onClick={() => handleSubmit("active")} disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
