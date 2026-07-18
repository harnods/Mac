"use client";

import { useState, useEffect, cloneElement, isValidElement } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
} from "@/components/ui/sheet";
import { ItemForm } from "./item-form";
import { ProductForm } from "./product-form";
import { getItemFormData, getProductFormData } from "@/app/actions/inventory";
import { ITEM_TYPE_CONFIG, type ItemTypeSlug } from "@/lib/item-types";
import type { ItemFormData, ProductFormData } from "@/app/actions/inventory";

type Props = {
  itemTypeSlug: ItemTypeSlug;
  itemId?: string;
  /** Uncontrolled mode: provide a trigger element */
  trigger?: React.ReactNode;
  /** Controlled mode: manage open state externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ItemFormDialog({ itemTypeSlug, itemId, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: Props) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen! : internalOpen;

  const isProduct = itemTypeSlug === "products";
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ItemFormData | null>(null);
  const [productFormData, setProductFormData] = useState<ProductFormData | null>(null);

  const config = ITEM_TYPE_CONFIG[itemTypeSlug];
  const isEdit = !!itemId;
  const title = isEdit
    ? `Edit ${config.singular.toLowerCase()}`
    : `Add ${config.singular.toLowerCase()}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFormData(null);
    setProductFormData(null);
    if (isProduct) {
      getProductFormData(itemId).then((data) => {
        if (!cancelled) { setProductFormData(data); setLoading(false); }
      });
    } else {
      getItemFormData(itemTypeSlug, itemId).then((data) => {
        if (!cancelled) { setFormData(data); setLoading(false); }
      });
    }
    return () => { cancelled = true; };
  }, [open, itemTypeSlug, itemId]);

  function handleOpenChange(next: boolean) {
    if (isControlled) {
      controlledOnOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  }

  const content = (
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetClose />
      </SheetHeader>
      <SheetBody>
        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}
        {!loading && isProduct && productFormData && (
          <ProductForm
            categories={productFormData.categories}
            units={productFormData.units}
            products={productFormData.products}
            item={productFormData.item ?? undefined}
            setProducts={productFormData.setProducts}
            unitLocked={productFormData.unitLocked}
            onSuccess={() => handleOpenChange(false)}
            onCancel={() => handleOpenChange(false)}
          />
        )}
        {!loading && !isProduct && formData && (
          <ItemForm
            categories={formData.categories}
            units={formData.units}
            item={formData.item ?? undefined}
            itemTypeSlug={itemTypeSlug}
            hasCategories={config.hasCategories}
            unitLocked={formData.unitLocked}
            onSuccess={() => handleOpenChange(false)}
            onCancel={() => handleOpenChange(false)}
          />
        )}
        {!loading && ((isProduct && !productFormData) || (!isProduct && !formData)) && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Failed to load form data.
          </div>
        )}
      </SheetBody>
    </SheetContent>
  );

  if (trigger) {
    const triggerEl = isValidElement(trigger)
      ? cloneElement(trigger as React.ReactElement<{ onClick?: React.MouseEventHandler }>, {
          onClick: (e: React.MouseEvent) => {
            (trigger as React.ReactElement<{ onClick?: React.MouseEventHandler }>).props.onClick?.(e);
            handleOpenChange(true);
          },
        })
      : trigger;
    return (
      <>
        {triggerEl}
        <Sheet open={open} onOpenChange={handleOpenChange}>
          {content}
        </Sheet>
      </>
    );
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {content}
    </Sheet>
  );
}
