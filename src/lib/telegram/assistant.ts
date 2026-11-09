import "server-only";

import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { P, allowedRecipeStations } from "@/lib/permissions";
import type { LinkedAccount } from "./account";
import { MODEL, anthropic, fallbackParams } from "./claude";
import { findByName } from "./text";

/*
 * Free-form Q&A ("ube syrup sekali bikin cukup untuk berapa cup hulk latte?").
 * Claude answers using read-only tools over recipes and stock, scoped to the
 * asker's permissions. No cost, payroll, benefit or crew data is exposed —
 * there is simply no tool for it, and the instructions say to refuse.
 */

const MAX_QUESTIONS_PER_HOUR = 30;

const INSTRUCTIONS = [
  "Kamu asisten internal untuk staf kafe Machimoto, menjawab lewat Telegram.",
  "Jawab dalam Bahasa Indonesia yang singkat dan jelas, sesuai gaya penanya.",
  "Gunakan tools untuk data resep dan stok — jangan pernah mengarang angka. Kalau data tidak ada, katakan terus terang.",
  "Untuk pertanyaan hitungan (misalnya satu batch cukup untuk berapa porsi), tunjukkan langkah hitungnya singkat, perhatikan konversi satuan (1 kg = 1000 g, 1 l = 1000 ml), dan bulatkan ke bawah untuk jumlah porsi/cup.",
  "Bahan dengan tanda [WIP] atau is_prep_item = true adalah bahan setengah jadi yang punya resep sendiri — cari resepnya dengan get_recipe untuk tahu hasil per batch.",
  "Kalau satuan berat dan volume tercampur (misalnya hasil batch dalam g tapi pemakaian dalam ml), sebutkan asumsimu dengan jelas (untuk sirup/cairan berbasis air: 1 ml ≈ 1 g) dan beri catatan bahwa angka sebenarnya bisa sedikit berbeda.",
  "Kamu TIDAK punya akses dan TIDAK boleh membahas: gaji, payroll, slip gaji, benefit, tunjangan, bonus, data pribadi crew lain, maupun harga/biaya/HPP. Tolak dengan sopan dan arahkan ke aplikasi Machitori.",
  "Untuk absensi, jadwal, dan status request milik sendiri, arahkan penanya mengetik: absensi, jadwal, atau request saya.",
  "Untuk 'kapan terakhir dicek/di-stock count', pakai last_stock_count. Untuk 'dipakai di produk/resep apa', pakai recipes_using.",
  "Format: teks biasa untuk Telegram. Jangan pakai Markdown (tanpa **, #, atau tabel). Boleh pakai daftar dengan tanda '-'.",
].join("\n");

type RecipeRow = {
  id: string;
  name: string;
  recipe_type: string;
  yield_qty: number;
  unit: string | null;
  weight_per_pcs: number | null;
  weight_unit: string | null;
  station: string | null;
  product: { name: string; type: string } | null;
  recipe_items: { quantity: number; unit: string; item: { name: string; type: string } | null }[];
};

async function loadRecipes(account: LinkedAccount): Promise<RecipeRow[]> {
  const { data } = await createServiceClient()
    .from("recipes")
    .select(
      "id, name, recipe_type, yield_qty, unit, weight_per_pcs, weight_unit, station, product:items!product_id(name, type), recipe_items(quantity, unit, item:items!item_id(name, type))",
    )
    .order("name")
    .limit(2000);
  const stations = allowedRecipeStations({ is_owner: account.isOwner, permissions: account.permissions });
  return ((data ?? []) as unknown as RecipeRow[]).filter(
    (r) => stations === null || r.station == null || stations.includes(r.station as "bar" | "kitchen"),
  );
}

function tools(account: LinkedAccount) {
  const canRecipes = account.permissions.includes(P.RECIPES_READ);
  const canStock = [P.INGREDIENTS_READ, P.PURCHASING_READ, P.PURCHASING_REQUEST].some((k) => account.permissions.includes(k));
  let recipeCache: Promise<RecipeRow[]> | null = null;
  const recipes = () => (recipeCache ??= loadRecipes(account));

  const list = [];
  if (canRecipes) {
    list.push(
      betaZodTool({
        name: "find_recipes",
        description:
          "Cari resep berdasarkan nama (resep produk/menu maupun bahan setengah jadi/WIP). Toleran typo. Mengembalikan daftar nama resep yang cocok.",
        inputSchema: z.object({ query: z.string().describe("Nama resep atau produk, misalnya 'hulk latte' atau 'ube syrup'") }),
        run: async ({ query }) => {
          const found = findByName(await recipes(), (r) => [r.name, r.product?.name ?? ""], query, 8);
          if (found.length === 0) return `Tidak ada resep yang cocok dengan "${query}".`;
          return JSON.stringify(found.map((r) => ({ name: r.name, type: r.recipe_type, station: r.station })));
        },
      }),
      betaZodTool({
        name: "get_recipe",
        description:
          "Detail satu resep: hasil per batch (yield_qty + unit), berat per pcs bila ada, dan daftar bahan dengan takarannya. Tanpa data biaya.",
        inputSchema: z.object({ name: z.string().describe("Nama resep (boleh tidak persis)") }),
        run: async ({ name }) => {
          const [r] = findByName(await recipes(), (x) => [x.name, x.product?.name ?? ""], name, 1);
          if (!r) return `Resep "${name}" tidak ditemukan.`;
          return JSON.stringify({
            name: r.name,
            type: r.recipe_type === "wip" ? "bahan setengah jadi (WIP)" : "produk/menu",
            station: r.station,
            yield: { qty: Number(r.yield_qty), unit: r.unit ?? "porsi" },
            weight_per_pcs: r.weight_per_pcs != null ? { qty: Number(r.weight_per_pcs), unit: r.weight_unit } : null,
            ingredients: r.recipe_items.map((ri) => ({
              name: ri.item?.name ?? "?",
              qty: Number(ri.quantity),
              unit: ri.unit,
              is_prep_item: ri.item?.type === "prep_item",
            })),
          });
        },
      }),
    );
  }
  if (canRecipes) {
    list.push(
      betaZodTool({
        name: "recipes_using",
        description: "Daftar resep (produk/menu dan WIP) yang memakai bahan tertentu, beserta takarannya per resep.",
        inputSchema: z.object({ ingredient: z.string().describe("Nama bahan, misalnya 'whipped cream'") }),
        run: async ({ ingredient }) => {
          const all = await recipes();
          const names = [...new Set(all.flatMap((r) => r.recipe_items.map((ri) => ri.item?.name ?? "")).filter(Boolean))];
          const [match] = findByName(names, (n) => [n], ingredient, 1);
          if (!match) return `Bahan "${ingredient}" tidak ditemukan di resep mana pun.`;
          const using = all
            .map((r) => ({ r, ri: r.recipe_items.find((x) => x.item?.name === match) }))
            .filter((x) => x.ri)
            .map((x) => ({ recipe: x.r.name, type: x.r.recipe_type, qty: Number(x.ri!.quantity), unit: x.ri!.unit }));
          return JSON.stringify({ ingredient: match, used_in: using });
        },
      }),
    );
  }
  const canCounts =
    canStock || [P.STOCK_COUNTS_READ, P.DAILY_STOCK_COUNTS_READ].some((k) => account.permissions.includes(k));
  if (canCounts) {
    list.push(
      betaZodTool({
        name: "last_stock_count",
        description:
          "Kapan terakhir sebuah bahan dihitung (stock count harian dan stock count penuh), beserta jumlah hasil hitungnya. Tidak menyebut siapa yang menghitung.",
        inputSchema: z.object({ item: z.string().describe("Nama bahan, misalnya 'whipped cream'") }),
        run: async ({ item }) => {
          const supabase = createServiceClient();
          const { data: items } = await supabase
            .from("items")
            .select("id, name, unit")
            .in("type", ["ingredient", "prep_item"])
            .is("deleted_at", null)
            .limit(5000);
          const [it] = findByName((items ?? []) as { id: string; name: string; unit: string }[], (i) => [i.name], item, 1);
          if (!it) return `Bahan "${item}" tidak ditemukan.`;
          const [{ data: daily }, { data: full }] = await Promise.all([
            supabase
              .from("daily_stock_count_items")
              .select("counted_qty, unit, count:daily_stock_counts!inner(count_date, status, completed_at)")
              .eq("item_id", it.id)
              .not("counted_qty", "is", null)
              .limit(1000), // sorted by count date below
            supabase
              .from("stock_count_items")
              .select("qty_counted, unit, count:stock_counts!inner(count_date, status, completed_at)")
              .eq("item_id", it.id)
              .not("qty_counted", "is", null)
              .limit(1000),
          ]);
          type C = { count_date: string | null; status: string; completed_at: string | null };
          const latest = <T extends { count: C | C[] | null }>(rows: T[]) =>
            rows
              .map((r) => ({ r, c: (Array.isArray(r.count) ? r.count[0] : r.count) as C | null }))
              .filter((x) => x.c)
              .sort((a, b) => String(b.c!.count_date ?? b.c!.completed_at ?? "").localeCompare(String(a.c!.count_date ?? a.c!.completed_at ?? "")))[0];
          const d = latest((daily ?? []) as unknown as { counted_qty: number; unit: string; count: C }[]);
          const f = latest((full ?? []) as unknown as { qty_counted: number; unit: string; count: C }[]);
          return JSON.stringify({
            item: it.name,
            daily_stock_count: d
              ? { date: d.c!.count_date, status: d.c!.status, counted: Number(d.r.counted_qty), unit: d.r.unit }
              : null,
            full_stock_count: f
              ? { date: f.c!.count_date ?? f.c!.completed_at, status: f.c!.status, counted: Number(f.r.qty_counted), unit: f.r.unit }
              : null,
          });
        },
      }),
    );
  }
  if (canStock) {
    list.push(
      betaZodTool({
        name: "check_stock",
        description: "Cek stok bahan (on hand, reserved, available) berdasarkan nama. Toleran typo.",
        inputSchema: z.object({ query: z.string().describe("Nama bahan, misalnya 'almond'") }),
        run: async ({ query }) => {
          const { data } = await createServiceClient()
            .from("items")
            .select("name, unit, on_hand, reserved, type")
            .in("type", ["ingredient", "prep_item"])
            .is("deleted_at", null)
            .limit(5000);
          const items = (data ?? []) as { name: string; unit: string; on_hand: number; reserved: number; type: string }[];
          const found = findByName(items, (i) => [i.name], query, 5);
          if (found.length === 0) return `Tidak ada bahan yang cocok dengan "${query}".`;
          return JSON.stringify(
            found.map((i) => ({
              name: i.name,
              unit: i.unit,
              on_hand: Number(i.on_hand),
              reserved: Number(i.reserved),
              available: Number(i.on_hand) - Number(i.reserved),
            })),
          );
        },
      }),
    );
  }
  return list;
}

/** DB-backed per-user limit (serverless instances don't share memory). */
async function overLimit(telegramUserId: number): Promise<boolean> {
  const supabase = createServiceClient();
  const key = `tg-ask:${telegramUserId}`;
  const now = new Date();
  const { data } = await supabase.from("rate_limits").select("count, reset_at").eq("key", key).maybeSingle();
  if (!data || new Date(data.reset_at as string) < now) {
    await supabase
      .from("rate_limits")
      .upsert({ key, count: 1, reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString() }, { onConflict: "key" });
    return false;
  }
  if ((data.count as number) >= MAX_QUESTIONS_PER_HOUR) return true;
  await supabase.from("rate_limits").update({ count: (data.count as number) + 1 }).eq("key", key);
  return false;
}

/**
 * Answer a free-form question. `context` is the text of the message being
 * replied to (e.g. a recipe the bot sent), so "ube syrup ini" makes sense.
 * Returns plain text (caller escapes it for Telegram HTML).
 */
export const SKIP = "SKIP";

const SKIP_RULE =
  "Pesan ini dikirim di grup staf tanpa menyebut bot. Kalau pesan ini BUKAN pertanyaan yang bisa kamu bantu (obrolan antar staf, sapaan, pertanyaan untuk orang lain, atau tidak terkait resep/bahan/stok/purchase request), balas persis dengan satu kata: SKIP";

export async function answerQuestion(
  account: LinkedAccount,
  telegramUserId: number,
  question: string,
  context?: string,
  /** Unaddressed group message: let Claude decline with SKIP so chatter gets no reply. */
  allowSkip = false,
): Promise<string> {
  const toolList = tools(account);
  if (toolList.length === 0) return "Akun kamu belum punya izin melihat resep atau stok. Hubungi admin.";
  if (await overLimit(telegramUserId)) return "Terlalu banyak pertanyaan dalam 1 jam terakhir. Coba lagi nanti.";

  const prompt = context
    ? `Konteks (pesan yang dibalas):\n"""\n${context.slice(0, 3000)}\n"""\n\nPertanyaan: ${question}`
    : question;

  const final = await anthropic().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    max_iterations: 8,
    ...fallbackParams(),
    output_config: { effort: "medium" },
    system: [{ type: "text", text: allowSkip ? `${INSTRUCTIONS}\n${SKIP_RULE}` : INSTRUCTIONS }],
    tools: toolList,
    messages: [{ role: "user", content: prompt }],
  });

  if (final.stop_reason === "refusal") return "Maaf, saya tidak bisa membantu pertanyaan itu.";
  const text = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "Maaf, saya belum bisa menjawab pertanyaan itu.";
}
