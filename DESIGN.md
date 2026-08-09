# Machitori Design Rules

Panduan konsistensi UI/UX untuk semua halaman dan komponen di Machitori.
Setiap fitur baru harus mengikuti rules ini tanpa perlu diingatkan kembali.

---

## Layout & Page Structure

### List pages (index)
```
<div class="space-y-4">
  <div class="flex items-center justify-between gap-4">
    <h1 class="text-2xl font-semibold tracking-tight">Page Title</h1>
    <Button>Primary action</Button>     ← satu primary action di kanan (admin only)
  </div>
  <FilterBar />                         ← SELALU ada di semua table page
  <Table />
</div>
```
- **Tidak ada caption/deskripsi** di bawah h1 di mana pun.
- Filter bar wajib ada meski page sederhana (min: search input).

### Detail / form pages
```
<div class="space-y-4 max-w-xl mx-auto">    (max-w-2xl untuk detail yang lebih lebar)
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-start gap-3">
      <BackButton />           ← icon-only ghost button, -ml-2 mt-0.5
      <h1 class="text-2xl font-semibold tracking-tight">Page Title</h1>
    </div>
    <ActionButtons />          ← Edit, Delete di kanan (admin only)
  </div>
  <Content />
</div>
```
- Form pages: `max-w-xl mx-auto` (centered).
- **Tidak ada caption/deskripsi** di bawah h1.

---

## Navigation

- Header **full width** (tidak ada max-w).
- Menu yang punya sub-halaman dibuat **dropdown**, bukan link langsung.
- Dropdown item: teks saja, **tanpa icon**.

---

## Filter Bar

Wajib ada di atas **setiap** table page tanpa kecuali.

Posisi:
- **Select / filter** → kiri
- **Search input** → kanan
- **Clear button** → muncul di sebelah kanan filter select jika ada filter aktif

Jika tidak ada filter select, search input tetap ada di kanan (full width atau max-w tertentu).

---

## Table

```tsx
<Table className="table-fixed w-full">
  <TableHeader>
    <TableRow>
      <TableHead className="w-[X]">Col A</TableHead>
      <TableHead className="w-[X]">Col B</TableHead>
      <TableHead />                    ← spacer, tanpa width — mendorong action ke kanan
      <TableHead className="w-12" />   ← action column
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>...</TableCell>
      <TableCell>...</TableCell>
      <TableCell />                    ← spacer kosong
      <TableCell>
        <DropdownMenu>                 ← kebab MoreHorizontal button
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>   ← admin only
            <DropdownMenuSeparator />
            <DropdownMenuItem>Delete</DropdownMenuItem>  ← admin only, TIDAK merah
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

Rules:
- `table-fixed w-full` di semua table.
- Semua kolom **left-aligned**.
- Lebar kolom di-set eksplisit di `<TableHead>`.
- Satu **spacer column** (`<TableHead />` tanpa width) sebelum action column.
- Kolom action di paling kanan, lebar `w-12`.
- Action per row selalu pakai **kebab icon button** (`MoreHorizontal`), **tidak pernah inline button**.
- Delete di kebab menu **tidak pakai warna merah** di mana pun.
- Kolom numerik: class `tabular-nums`.

### Column widths yang sering dipakai
| Kolom | Width |
|-------|-------|
| Name / judul | `w-56` atau `w-64` |
| Category | `w-40` |
| On hand / Reserved / Available | `w-24` |
| Unit | `w-20` |
| Last updated | `w-44` |
| Count / angka kecil | `w-28` |
| Action | `w-12` |

---

## Forms

### Input
- **Tidak ada placeholder** di semua form input (text, number, dll).
- Filter search bar boleh pakai placeholder.

### Select
- Dropdown: gunakan **Popover + Command** (bukan native select atau shadcn Select).
- Placeholder: `Select [nama label]` (contoh: `Select category`, `Select unit`).
- Filter select pakai label deskriptif: `All categories`.

### Tombol aksi form
- Posisi: **justify-end** (rata kanan).
- Urutan: **Cancel** (ghost) → **Submit** (primary).
- Label: sesuai aksi (`Create [item]`, `Save changes`, dll).

### Add form — modal vs halaman baru
- **Form sederhana** (1–2 field): pakai **Dialog modal**. Tombol "Add X" di header → buka modal.
  - Contoh: Add unit (1 input), Add category (1 input).
- **Form kompleks** (banyak field / relasi): pakai **halaman terpisah** (`/new`, `/[id]/edit`).
  - Contoh: Add item, Add recipe.

### Konfirmasi delete
- Selalu pakai confirm **Dialog** (bukan window.confirm).
- Trigger: kebab menu item "Delete" → set state → render `<DeleteDialog>`.

---

## Category Rules

- Selalu ada category default **Uncategorized** (`is_default = true`) per type.
- Uncategorized tidak bisa diedit atau dihapus — tidak ada kebab menu di baris ini.
- Saat category dihapus, item di dalamnya otomatis pindah ke Uncategorized (DB trigger).

---

## Data Columns

- Setiap table yang menampilkan data ter-update harus ada kolom **Last updated** (tanggal + nama user).
- Format tanggal: `formatDate()` dari `@/lib/format`.
- Kolom Last updated untuk row default/system tampil `—`.

---

## Stock Fields

Item tidak punya satu kolom "quantity". Tiga field:
- **On hand** — stok fisik yang ada.
- **Reserved** — stok yang sudah dialokasikan / dipesan.
- **Available** = On hand − Reserved. Dihitung di app layer, tidak disimpan di DB.

Di table list: tampilkan ketiga kolom + kolom Unit terpisah (angka saja di on_hand/reserved/available).
Di detail page: tampilkan ketiga nilai + unit conversion.
Update stock: dua input (On hand dan Reserved).

---

## Roles

- **Admin**: full CRUD semua data.
- **Staff**: read-only + update On hand item saja.
- Tombol Add/Edit/Delete hanya muncul untuk admin.
- Kebab menu tidak muncul untuk staff (atau hanya tampil "View details").

---

## Layout conventions (list, detail, tabs)

- **Primary page action in the title bar.** The main action for a page — `Add <thing>` on a list, `Edit` on a detail — lives in the page title row, right-aligned next to the `<h1>`. Do NOT put it in the filter/search row or below the tabs.
- **Filter bar: search is always right-aligned.** The search input sits at the right end of the filter bar. Left side holds any dropdown filters (department, status, etc.); if there are none, the search still stays right (`flex justify-end`).
- **Tabs.** Underline tabs (the `TabButton` pattern) have **12px horizontal padding** per tab (`px-3 py-2`), tight gap between tabs (`gap-1`), and the tab row is offset `-ml-3` so the first tab's text still aligns with the content's left edge.

---

## Inputs with prefix / suffix (addons)

Any prefix or suffix on an input — currency (`Rp`), unit (`kg`, `/day`), `%`, `per month`, etc. — goes **inside** the input via `InputGroup`, never as a separate `<span>` sitting beside it.

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";

<InputGroup>
  <InputGroupAddon align="inline-start"><InputGroupText>Rp</InputGroupText></InputGroupAddon>
  <InputGroupInput type="number" value={amount} onChange={...} />
  <InputGroupAddon align="inline-end"><InputGroupText>/day</InputGroupText></InputGroupAddon>
</InputGroup>
```

- `align="inline-start"` for prefixes, `align="inline-end"` for suffixes.
- For a custom control (e.g. `DecimalInput`), place it inside the `InputGroup` with `className="flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"` so the group draws the single border.
- A separate **selector** next to the amount (e.g. the per day/week/month `Select`, or a unit dropdown) is a control, not an addon — keep it beside the `InputGroup`, not inside.
- Do NOT render `<span>Rp</span>` + `<Input>` side by side. Ever.
- **Height:** `InputGroup` defaults to `h-8`, but the base `Input` and `SelectTrigger` are `h-10`. Always add `className="h-10"` to `InputGroup` so it lines up with adjacent inputs/selects (otherwise it renders shorter).
