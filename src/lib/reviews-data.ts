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
  {
    author: "Joshua Lee",
    rating: 5,
    when: "3 months ago",
    text: "If you're looking for a chill quality time cafe for work or leisure, I highly recommend. The staff here are very welcoming and kind, doing their best to cater to my every need. They also provide board games for leisure, extra electric outlets to charge devices, and a toilet full of nice amenities. Will go back for sure.",
  },
  {
    author: "bianca louisa",
    rating: 5,
    when: "7 months ago",
    text: "If you're looking for a cozy, relaxing place to work, study, or have a meeting, this is the place! Warm ambiance, good wifi and power outlets, plus board games you can use. Coffee's good, the ceremonial matcha latte is quite balanced. They also have ube drinks and onigiri! Plus point: they open quite early (7 am), perfect for breakfast after a morning run.",
  },
  {
    author: "Febby",
    rating: 5,
    when: "5 months ago",
    text: "Stopped by for some dessert and quick hang out. The place has a really cozy and comfortable vibe. Tried the Kakigori and Ube Cloud Coco, both had unique flavors and were enjoyable. Will definitely be back to explore more of the food and drink menu.",
  },
  {
    author: "Amu",
    rating: 5,
    when: "7 months ago",
    text: "WFC friendly place located in a quiet complex, opens early morning at 7 and has decent selections of food and beverages. Try their matcha latte and any sandos 👌✨",
  },
  {
    author: "Angelia Sean",
    rating: 4,
    when: "4 months ago",
    text: "The place is very comfortable for WFC. It smells good and has a lot of things to do for free (comic books, board games, and a printer). Overall, I recommend it to someone that likes WFC.",
  },
  {
    author: "Ellen Fernanda",
    rating: 5,
    when: "8 months ago",
    text: "Super nice first visit, love the interior & vibe, all the food & drinks we ordered were super great! Definitely will be back for WFC next time.",
  },
  {
    author: "Dirman Suharno",
    rating: 5,
    when: "10 months ago",
    text: "Great food and cozy ambience. Perfect spot to work from cafe in BSD — quiet, comfortable, and welcoming.",
  },
];

// Every manual review defaults to opening your Google reviews page on tap.
export const MANUAL_REVIEWS_URL = GOOGLE_REVIEWS_URL;
