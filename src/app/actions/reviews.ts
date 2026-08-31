import "server-only";

export type Review = {
  author: string;
  rating: number;
  text: string;
  photo: string | null;
  when: string | null;
  url: string | null;
};

/**
 * Google reviews via the Places Details API (returns up to 5, Google's limit).
 * Needs env GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID. Returns [] if unset or on
 * any error so the menu still renders. Cached 1h.
 */
export async function getReviews(): Promise<Review[]> {
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
