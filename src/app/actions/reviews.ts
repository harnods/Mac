import "server-only";
import { MANUAL_REVIEWS, MANUAL_REVIEWS_URL } from "@/lib/reviews-data";

export type Review = {
  author: string;
  rating: number;
  text: string;
  photo: string | null;
  when: string | null;
  url: string | null;
};

/**
 * Reviews shown on the menu. Uses the hand-written list in
 * `src/lib/reviews-data.ts` first; if that's empty it falls back to the Google
 * Places API (needs GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID). Returns [] if
 * neither is available so the menu still renders. Cached 1h for the API path.
 */
export async function getReviews(): Promise<Review[]> {
  if (MANUAL_REVIEWS.length > 0) {
    return MANUAL_REVIEWS.map((r) => ({
      author: r.author,
      rating: Math.max(1, Math.min(5, Math.round(r.rating))),
      text: r.text.trim(),
      photo: null,
      when: r.when?.trim() || null,
      url: r.url?.trim() || MANUAL_REVIEWS_URL,
    }));
  }
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  if (!key || !placeId) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=reviews&reviews_sort=most_relevant&language=id&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      status?: string;
      result?: { reviews?: { author_name?: string; author_url?: string; profile_photo_url?: string; rating?: number; text?: string; relative_time_description?: string }[] };
    };
    if (json.status !== "OK") return [];
    return (json.result?.reviews ?? [])
      .filter((r) => (r.text ?? "").trim().length > 0)
      .map((r) => ({
        author: r.author_name ?? "Google user",
        rating: Math.round(r.rating ?? 5),
        text: (r.text ?? "").trim(),
        photo: r.profile_photo_url ?? null,
        when: r.relative_time_description ?? null,
        url: r.author_url ?? null,
      }));
  } catch {
    return [];
  }
}
