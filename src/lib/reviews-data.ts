// ─────────────────────────────────────────────────────────────────────────────
//  Google reviews — written manually (no API needed).
//
//  HOW TO ADD/EDIT:
//  Copy a review from your Google Maps page and add an entry below.
//    - author : reviewer name (as shown on Google)
//    - rating : 1–5 stars
//    - text   : the review text
//    - when   : optional, e.g. "2 minggu lalu" (or "" to hide)
//    - url    : optional link to open on tap (your Google reviews page is fine)
//
//  These show as cards shuffled among the menu on the "Everything" view.
//  Leave the list empty ([]) to hide reviews entirely.
// ─────────────────────────────────────────────────────────────────────────────

export type ManualReview = {
  author: string;
  rating: number;
  text: string;
  when?: string;
  url?: string;
};

const GOOGLE_REVIEWS_URL =
  "https://www.google.com/maps/search/?api=1&query=Machimoto%20Cafe%20Ruko%20DelRey%20Biztown%20BSD";

export const MANUAL_REVIEWS: ManualReview[] = [
  // Replace / add your real Google reviews here:
  // {
  //   author: "Nama Reviewer",
  //   rating: 5,
  //   text: "Isi review dari Google Maps…",
  //   when: "2 minggu lalu",
  //   url: GOOGLE_REVIEWS_URL,
  // },
];

// Every manual review defaults to opening your Google reviews page on tap.
export const MANUAL_REVIEWS_URL = GOOGLE_REVIEWS_URL;
