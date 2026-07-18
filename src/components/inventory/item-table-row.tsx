"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ItemFormDialog } from "@/components/inventory/item-form-dialog";
import { QuickAdjustDialog } from "@/components/inventory/quick-adjust-dialog";
import { ItemPhotoThumbnail } from "@/components/inventory/item-photo-thumbnail";
import type { ItemWithCategory, UnitCode } from "@/lib/supabase/types";
import type { ItemTypeSlug } from "@/lib/item-types";

export function ItemTableRow({
  item,
  isAdmin,
  itemTypeSlug,
  showPhoto = false,
  showCategory = true,
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
  showCategory?: boolean;
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
  const [viewUnit, setViewUnit] = useState<UnitCode>(item.unit);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const units = compatibleUnits(item.unit);
  const otherUnits = units.filter((u) => u !== viewUnit && u !== item.unit);

  const onHand = convert(Number(item.on_hand), item.unit, viewUnit) ?? Number(item.on_hand);
  const reserved = convert(Number(item.reserved), item.unit, viewUnit) ?? Number(item.reserved);
  const available = onHand - reserved;

  return (
    <>
      <ClickableTableRow href={`/inventory/${itemTypeSlug}/${item.id}`} className={isSelected ? "bg-primary/5" : undefined}>
        {onToggleSelect && (
          <TableCell className="w-12 pl-3 pr-0" onClick={(e) => e.stopPropagation()}>
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
            <span className="truncate">{item.name}</span>
            {(item as ItemWithCategory & { status?: string }).status === "draft" && (
              <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                Draft
              </span>
            )}
            <Button
              variant="outline"
              size="xs"
              asChild
              className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Link href={`/inventory/${itemTypeSlug}/${item.id}`} onClick={(e) => e.stopPropagation()}>
                View
              </Link>
            </Button>
          </span>
        </TableCell>
        {showCategory && (
          <TableCell>
            {item.categories?.name ?? <span className="text-muted-foreground">—</span>}
          </TableCell>
        )}
        {showOnHand && (
          <TableCell className="tabular-nums text-sm">
            {isAdmin ? (
              <OnHandButton value={onHand} unit={viewUnit} onClick={() => setAdjustOpen(true)} />
            ) : (
              <Qty value={onHand} unit={viewUnit} />
            )}
          </TableCell>
        )}
        {showReserved && <TableCell className="tabular-nums text-sm"><Qty value={reserved} unit={viewUnit} /></TableCell>}
        {showAvailable && <TableCell className="tabular-nums text-sm"><Qty value={available} unit={viewUnit} /></TableCell>}
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
              ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Yes</span>
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
              ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Yes</span>
              : <span className="text-xs text-muted-foreground">—</span>}
          </TableCell>
        )}
        {hasRecipe !== undefined && showRecipe && (
          <TableCell>
            {hasRecipe
              ? <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Yes</span>
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
                <Link href={`/inventory/${itemTypeSlug}/${item.id}`}>View details</Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>Edit</DropdownMenuItem>
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
          <ItemFormDialog
            itemTypeSlug={itemTypeSlug as ItemTypeSlug}
            itemId={item.id}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
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
