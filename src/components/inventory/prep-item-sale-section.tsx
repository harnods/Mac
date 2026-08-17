"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DecimalInput } from "@/components/ui/decimal-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryCombobox } from "./category-combobox";
import { UnitCombobox } from "./unit-combobox";
import { createClient } from "@/lib/supabase/client";
import { parseDecimal } from "@/lib/units";
import { formatRp } from "@/lib/format";
import { setItemSellable, setPrepItemSale, updatePrepItemMenu } from "@/app/actions/inventory";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type PrepItem = {
  id: string;
  is_sellable: boolean;
  sell_price: number | null;
  station: string | null;
  description: string | null;
  category_id: string | null;
  image_url: string | null;
  unit: string;
};

export function PrepItemSaleSection({
  item,
  categories,
  units,
}: {
  item: PrepItem;
  categories: { id: string; name: string }[];
  units: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Toggle-on modal (price + station)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrice, setModalPrice] = useState(item.sell_price != null ? String(item.sell_price) : "");
  const [modalStation, setModalStation] = useState(item.station ?? "");

  // Menu details form (shown when sellable)
  const [description, setDescription] = useState(item.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(item.category_id);
  const [unit, setUnit] = useState(item.unit);
  const [sellPrice, setSellPrice] = useState(item.sell_price != null ? String(item.sell_price) : "");
  const [station, setStation] = useState(item.station ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(item.image_url);
  const [uploading, setUploading] = useState(false);

  function handleToggle(checked: boolean) {
    if (checked) {
      setModalOpen(true);
      return;
    }
    start(async () => {
      const res = await setItemSellable(item.id, false);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Removed from sale");
      router.refresh();
    });
  }

  function confirmSale() {
    if (!modalPrice.trim()) { toast.error("Enter a selling price"); return; }
    if (!modalStation) { toast.error("Select a station"); return; }
    start(async () => {
      const res = await setPrepItemSale(item.id, { sell_price: parseDecimal(modalPrice), station: modalStation });
      if (!res.ok) { toast.error(res.error); return; }
      setSellPrice(modalPrice);
      setStation(modalStation);
      setModalOpen(false);
      toast.success("Now available for sale");
      router.refresh();
    });
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error("Image must be under 5MB"); return; }
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${item.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setImageUrl(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  }

  function saveMenu() {
    if (!sellPrice.trim()) { toast.error("Enter a selling price"); return; }
    if (!station) { toast.error("Select a station"); return; }
    start(async () => {
      const res = await updatePrepItemMenu(item.id, {
        description: description.trim() || null,
        category_id: categoryId,
        image_url: imageUrl,
        unit,
        sell_price: parseDecimal(sellPrice),
        station,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Switch id="sellable-toggle" checked={item.is_sellable} onCheckedChange={handleToggle} disabled={pending} />
        <Label htmlFor="sellable-toggle" className="text-sm cursor-pointer">Available for sale (à la carte)</Label>
      </div>

      {item.is_sellable && (
        <div className="rounded-lg border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Menu details</h2>
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Selling price</Label>
                  <DecimalInput value={sellPrice} onValueChange={setSellPrice} />
                </div>
                <div className="space-y-2">
                  <Label>Station</Label>
                  <Select value={station} onValueChange={setStation}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Bar</SelectItem>
                      <SelectItem value="kitchen">Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <CategoryCombobox categories={categories} value={categoryId} onChange={setCategoryId} catType="product" />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <UnitCombobox units={units} value={unit} onChange={setUnit} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="resize-none" placeholder="Shown on the customer menu" />
              </div>
            </div>

            <div className="space-y-2 md:w-48">
              <Label>Photo</Label>
              <div className="aspect-square w-full overflow-hidden rounded-lg border bg-muted">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="size-8" />
                  </div>
                )}
              </div>
              <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full cursor-pointer")}>
                {uploading ? "Uploading…" : imageUrl ? "Change photo" : "Upload photo"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImage} disabled={uploading} />
              </label>
              {imageUrl && (
                <Button type="button" variant="ghost" size="sm" className="w-full text-destructive" onClick={() => setImageUrl(null)}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveMenu} disabled={pending || uploading}>Save changes</Button>
          </div>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sell this prep item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selling price</Label>
              <DecimalInput value={modalPrice} onValueChange={setModalPrice} autoFocus />
              {modalPrice.trim() && (
                <p className="text-xs text-muted-foreground">{formatRp(parseDecimal(modalPrice))}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Station</Label>
              <Select value={modalStation} onValueChange={setModalStation}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="kitchen">Kitchen</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Routes the order docket to the right printer.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={confirmSale} disabled={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
