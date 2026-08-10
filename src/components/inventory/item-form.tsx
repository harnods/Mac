"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryCombobox } from "./category-combobox";
import { UnitCombobox } from "./unit-combobox";
import { ITEM_TYPE_CONFIG } from "@/lib/item-types";
import { compatibleUnits, parseDecimal } from "@/lib/units";
import { createItem, updateItem } from "@/app/actions/inventory";
import { createClient } from "@/lib/supabase/client";
import type { Category, Item } from "@/lib/supabase/types";
import type { ItemTypeSlug } from "@/lib/item-types";
import type { UnitCode } from "@/lib/supabase/types";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function Required() {
  return <span className="text-destructive">*</span>;
}

type Props = {
  categories: Pick<Category, "id" | "name">[];
  units: string[];
  item?: Item;
  itemTypeSlug: ItemTypeSlug;
  hasCategories: boolean;
  unitLocked?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
};

function defaultUnitFor(): string {
  return "pcs";
}

export function ItemForm({ categories, units: initialUnits, item, itemTypeSlug, hasCategories, unitLocked = false, onSuccess, onCancel }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(item?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item?.category_id ?? null);
  const [unit, setUnit] = useState<string>(item?.unit ?? defaultUnitFor());
  const [defaultCost, setDefaultCost] = useState(
    item?.default_purchase_cost != null ? String(item.default_purchase_cost) : "",
  );
  const [defaultCostUnit, setDefaultCostUnit] = useState<string>(
    item?.default_purchase_cost_unit ?? item?.unit ?? defaultUnitFor(),
  );
  const [usePurchaseUnit, setUsePurchaseUnit] = useState(Boolean(item?.purchase_unit));
  const [purchaseUnit, setPurchaseUnit] = useState<string>(item?.purchase_unit ?? "");
  const [purchaseUnitQty, setPurchaseUnitQty] = useState(
    item?.purchase_unit_qty != null ? String(item.purchase_unit_qty) : "",
  );
  const [units, setUnits] = useState(initialUnits);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image_url ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEdit = !!item;
  const config = ITEM_TYPE_CONFIG[itemTypeSlug];
  const showDefaultCost = itemTypeSlug === "ingredients";
  const showPhoto = itemTypeSlug === "supplies";

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

  const lockedUnits = unitLocked
    ? units.filter((u) => compatibleUnits(item!.unit as UnitCode).includes(u as UnitCode) || u === "pcs")
    : units;
  const fullyLocked = unitLocked && lockedUnits.length <= 1;
  const visibleUnits = unitLocked ? lockedUnits : units;

  // Default cost can be denominated in a unit compatible with the item's own
  // unit (e.g. g ↔ kg, but never g ↔ l), or in its custom purchase unit
  // (e.g. "bungkus") if one is set.
  const costUnitOptions = [
    ...compatibleUnits(unit as UnitCode),
    ...(usePurchaseUnit && purchaseUnit ? [purchaseUnit] : []),
  ];
  const selectedDefaultCostUnit = costUnitOptions.includes(defaultCostUnit) ? defaultCostUnit : unit;

  function handleUsePurchaseUnitChange(checked: boolean) {
    setUsePurchaseUnit(checked);
    if (!checked) {
      setPurchaseUnit("");
      setPurchaseUnitQty("");
      if (selectedDefaultCostUnit === purchaseUnit) setDefaultCostUnit(unit);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = {
        name,
        category_id: hasCategories ? categoryId : null,
        unit,
        type: config.dbType,
        default_purchase_cost: showDefaultCost && defaultCost.trim() ? parseDecimal(defaultCost) : null,
        default_purchase_cost_unit: showDefaultCost && defaultCost.trim() ? selectedDefaultCostUnit : null,
        purchase_unit: usePurchaseUnit && purchaseUnit ? purchaseUnit : null,
        purchase_unit_qty: usePurchaseUnit && purchaseUnit && purchaseUnitQty.trim() ? parseDecimal(purchaseUnitQty) : null,
        image_url: showPhoto ? imageUrl : null,
      };
      const res = isEdit ? await updateItem(item!.id, payload) : await createItem(payload);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Saved" : "Created");
      router.refresh();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(isEdit ? `/inventory/${itemTypeSlug}/${item!.id}` : `/inventory/${itemTypeSlug}`);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col flex-1 gap-6">
      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* Left: the 6-column form */}
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-8 md:order-1">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">{config.singular} info</h2>
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-6 space-y-2">
                <Label htmlFor="name">Name <Required /></Label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {hasCategories && (
                <div className="col-span-6 space-y-2 sm:col-span-3">
                  <Label>Category</Label>
                  <CategoryCombobox
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    catType={config.dbType}
                  />
                </div>
              )}

              <div className="col-span-6 space-y-2 sm:col-span-3">
                <Label>Unit</Label>
                {fullyLocked ? (
                  <div className="flex items-center gap-2">
                    <div className="border rounded-md px-3 py-2 text-sm bg-muted text-muted-foreground w-full">
                      {unit}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">Locked — no compatible units</span>
                  </div>
                ) : (
                  <>
                    <UnitCombobox
                      units={visibleUnits}
                      onUnitsChange={setUnits}
                      value={unit}
                      onChange={setUnit}
                      placeholder="Select unit"
                      allowCreate={!unitLocked}
                    />
                    {unitLocked && (
                      <p className="text-xs text-muted-foreground">
                        Only compatible units shown — has existing transactions.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {showDefaultCost && (
            <section className="space-y-4">
              <h2 className="text-sm font-semibold">Purchasing</h2>
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-6 space-y-3 rounded-lg border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={usePurchaseUnit}
                      onChange={(event) => handleUsePurchaseUnitChange(event.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    Use purchase unit
                  </label>
                  {usePurchaseUnit && (
                    <div className="space-y-2">
                      <Label>Purchase unit</Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <UnitCombobox
                            units={units.filter((u) => u !== unit)}
                            onUnitsChange={setUnits}
                            value={purchaseUnit}
                            onChange={setPurchaseUnit}
                            placeholder="Select unit"
                          />
                        </div>
                        <span className="text-sm text-muted-foreground shrink-0">=</span>
                        <InputGroup className="h-10 w-32 shrink-0">
                          <DecimalInput
                            value={purchaseUnitQty}
                            onValueChange={setPurchaseUnitQty}
                            className="flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                          />
                          <InputGroupAddon align="inline-end"><InputGroupText>{unit || "unit"}</InputGroupText></InputGroupAddon>
                        </InputGroup>
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    For packaging bought as a different unit than it&apos;s tracked in, e.g. 1 bungkus = 5000 g.
                  </div>
                </div>

                <div className="col-span-6 space-y-2">
                  <Label htmlFor="default-purchase-cost">Default purchase cost</Label>
                  <div className="flex items-center gap-2">
                    <DecimalInput
                      id="default-purchase-cost"
                      min="0"
                      step="1"
                      value={defaultCost}
                      onValueChange={setDefaultCost}
                      className="flex-1"
                    />
                    {costUnitOptions.length > 1 ? (
                      <Select value={selectedDefaultCostUnit} onValueChange={setDefaultCostUnit}>
                        <SelectTrigger id="default-purchase-cost-unit" className="w-24 shrink-0">
                          <span className="text-muted-foreground text-sm mr-0.5">/</span>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {costUnitOptions.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground shrink-0">/ {unit || "unit"}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Estimated cost per {selectedDefaultCostUnit || unit || "unit"}, used before any purchase is recorded.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Actions — directly below the form */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onCancel ? onCancel() : router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : isEdit ? "Save changes" : "Save"}
            </Button>
          </div>
        </div>

        {/* Photo — supplies only; outside the 6-column grid */}
        {showPhoto && (
          <div className="order-1 space-y-2 md:order-2 md:w-48 md:shrink-0">
            <Label>Photo</Label>
            <div className="flex flex-col items-start gap-3">
              <div className="size-32 shrink-0 overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={name || "Supply"} className="size-full object-cover" />
                ) : (
                  <ImagePlus className="size-7 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-image" className="cursor-pointer">
                  <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer")}>
                    {uploadingImage ? "Uploading..." : imageUrl ? "Change photo" : "Upload photo"}
                  </span>
                  <input
                    id="item-image"
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
                    className="text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP, up to 5MB.</p>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
