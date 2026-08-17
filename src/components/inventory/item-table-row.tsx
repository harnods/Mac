"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableCell, STICKY_ACTION_CELL } from "@/components/ui/table";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { compatibleUnits, convert, downConversionTarget, formatNum } from "@/lib/units";
import { Qty } from "@/components/ui/qty";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, updaterName } from "@/lib/format";
import { ItemDeleteDialog } from "@/components/inventory/item-delete-dialog";
import { QuickAdjustDialog } from "@/components/inventory/quick-adjust-dialog";
import { ItemPhotoThumbnail } from "@/components/inventory/item-photo-thumbnail";
import type { ItemWithCategory, UnitCode } from "@/lib/supabase/types";

export function ItemTableRow({
  item,
  isAdmin,
  itemTypeSlug,
  showPhoto = false,
  showBrand = false,
  showCategory = true,
  showLocation = false,
  showOnHand = true,
  showReserved = true,
  showAvailable = true,
  showLastCost = false,
  showAvgCost = false,
  showDefaultCost = false,
  showSellable = false,
  showSellingPrice = false,
  showAddOn = false,
  showRecipe = true,
  showLastUpdated = true,
  isSelected = false,
  onToggleSelect,
  hasRecipe,
}: {
  item: ItemWithCategory;
  isAdmin: boolean;
  itemTypeSlug: string;
  showPhoto?: boolean;
  showBrand?: boolean;
  showCategory?: boolean;
  showLocation?: boolean;
  showOnHand?: boolean;
  showReserved?: boolean;
  showAvailable?: boolean;
  showLastCost?: boolean;
  showAvgCost?: boolean;
  showDefaultCost?: boolean;
  showSellable?: boolean;
  showSellingPrice?: boolean;
  showAddOn?: boolean;
  showRecipe?: boolean;
  showLastUpdated?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  hasRecipe?: boolean;
}) {
  // Auto-show large stock in the bigger unit (1000+ g → kg, 1000+ ml → l).
  const [viewUnit, setViewUnit] = useState<UnitCode>(() => {
    const oh = Number(item.on_hand);
    if (item.unit === "g" && oh >= 1000) return "kg";
    if (item.unit === "ml" && oh >= 1000) return "l";
    return item.unit;
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const units = compatibleUnits(item.unit);
  const otherUnits = units.filter((u) => u !== viewUnit && u !== item.unit);

  const onHand = convert(Number(item.on_hand), item.unit, viewUnit) ?? Number(item.on_hand);
  const reserved = convert(Number(item.reserved), item.unit, viewUnit) ?? Number(item.reserved);
  const available = onHand - reserved;

  // A row can belong to a different type than the list (e.g. a sellable prep
  // item shown in the Products list) — route it to its own detail/edit pages.
  const rowSlug = item.type === "prep_item" ? "prep-items" : itemTypeSlug;

  return (
    <>
      <ClickableTableRow href={`/inventory/${rowSlug}/${item.id}`} className={isSelected ? "bg-primary/5" : undefined}>
        {onToggleSelect && (
          <TableCell className="w-8 pl-2 pr-0" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center justify-start w-full py-3 cursor-pointer">
              <input type="checkbox" checked={isSelected} onChange={onToggleSelect} className="size-4 cursor-pointer" />
            </label>
          </TableCell>
        )}
        {showPhoto && (
          <TableCell className="w-14">
            <ItemPhotoThumbnail imageUrl={item.image_url} name={item.name} className="size-10" />
          </TableCell>
        )}
        <TableCell className="font-medium">
          <span className="flex items-center gap-2 min-w-0">
            <Link
              href={`/inventory/${rowSlug}/${item.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate hover:underline"
            >
              {item.name}
            </Link>
            {(item as ItemWithCategory & { status?: string }).status === "draft" && (
              <Badge variant="secondary">Draft</Badge>
            )}
          </span>
        </TableCell>
        {showBrand && (
          <TableCell>
            {item.brand ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showCategory && (
          <TableCell>
            {item.categories?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showLocation && (
          <TableCell>
            {item.location?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showOnHand && (
          <TableCell className="tabular-nums text-sm">
            {isAdmin ? (
              <OnHandButton value={onHand} unit={viewUnit} onClick={() => setAdjustOpen(true)} />
            ) : (
              <Qty value={onHand} unit={viewUnit} auto={false} />
            )}
          </TableCell>
        )}
        {showReserved && <TableCell className="tabular-nums text-sm"><Qty value={reserved} unit={viewUnit} auto={false} /></TableCell>}
        {showAvailable && <TableCell className="tabular-nums text-sm"><Qty value={available} unit={viewUnit} auto={false} /></TableCell>}
        {showLastCost && (
          <TableCell className="tabular-nums text-right text-sm">
            {item.last_purchase_cost != null
              ? <>Rp{formatNum(item.last_purchase_cost)}<span className="text-muted-foreground text-xs">/{item.unit}</span></>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showAvgCost && (
          <TableCell className="tabular-nums text-right text-sm">
            {item.avg_purchase_cost != null
              ? <>Rp{formatNum(item.avg_purchase_cost)}<span className="text-muted-foreground text-xs">/{item.unit}</span></>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showDefaultCost && (
          <TableCell className="tabular-nums text-right text-sm">
            {item.default_purchase_cost != null
              ? <>Rp{formatNum(item.default_purchase_cost)}<span className="text-muted-foreground text-xs">/{item.default_purchase_cost_unit ?? item.unit}</span></>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showSellable && (
          <TableCell>
            {item.is_sellable
              ? <Badge variant="success">Yes</Badge>
              : <span className="text-xs text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showSellingPrice && (
          <TableCell className="tabular-nums text-right text-sm">
            {item.sell_price != null
              ? <>Rp{formatNum(item.sell_price)}</>
              : <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showAddOn && (
          <TableCell>
            {item.is_addon
              ? <Badge variant="success">Yes</Badge>
              : <span className="text-xs text-muted-foreground">—</span>}
          </TableCell>
        )}
        {hasRecipe !== undefined && showRecipe && (
          <TableCell>
            {hasRecipe
              ? <Badge variant="success">Yes</Badge>
              : <span className="text-xs text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showLastUpdated && (
          <TableCell>
            <div className="text-sm">{formatDate(item.updated_at)}</div>
            <div className="text-xs text-muted-foreground">{updaterName(item.updater)}</div>
          </TableCell>
        )}
        <TableCell />
        <TableCell className={STICKY_ACTION_CELL}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/inventory/${rowSlug}/${item.id}`}>View details</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href={`/inventory/${rowSlug}/${item.id}/edit`}>Edit</Link>
                </DropdownMenuItem>
              )}
              {(otherUnits.length > 0 || viewUnit !== item.unit) && (
                <>
                  <DropdownMenuSeparator />
                  {otherUnits.map((u) => (
                    <DropdownMenuItem key={u} onSelect={() => setViewUnit(u)}>
                      View in {u}
                    </DropdownMenuItem>
                  ))}
                  {viewUnit !== item.unit && (
                    <DropdownMenuItem onSelect={() => setViewUnit(item.unit)}>
                      View in {item.unit} (default)
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </ClickableTableRow>

      {isAdmin && (
        <>
          <ItemDeleteDialog
            id={item.id}
            name={item.name}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
          />
          <QuickAdjustDialog
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            itemId={item.id}
            itemName={item.name}
            itemUnit={item.unit}
            purchaseUnit={item.purchase_unit}
            purchaseUnitQty={item.purchase_unit_qty}
            unitConversions={(item as ItemWithCategory & { item_unit_conversions?: { from_unit: string; factor: number; to_unit: string }[] }).item_unit_conversions ?? []}
            onHand={Number(item.on_hand)}
          />
        </>
      )}
    </>
  );
}

/** On-hand cell button with optional conversion tooltip */
function OnHandButton({ value, unit, onClick }: { value: number; unit: string; onClick: () => void }) {
  const otherUnit = downConversionTarget(unit as UnitCode);
  const converted = otherUnit != null ? convert(value, unit as UnitCode, otherUnit) : null;

  const btn = (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className="hover:underline decoration-dashed underline-offset-2 cursor-pointer"
    >
      {formatNum(value)}
    </button>
  );

  if (converted == null || otherUnit == null) {
    return <>{btn}{" "}<span className="text-muted-foreground">{unit}</span></>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            {btn}{" "}<span className="text-muted-foreground">{unit}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatNum(converted)} {otherUnit}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
