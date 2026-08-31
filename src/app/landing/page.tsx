import type { Metadata } from "next";
import { getMenu } from "@/app/actions/online-order";
import { MenuBoard } from "@/components/menu/menu-board";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

const TITLE = "Machimoto Cafe - Ruko Delrey Biztown C2 No. 8";
const DESC =
  "Machimoto — Japanese comfort-food cafe & coffee shop at Ruko DelRey Biztown, BSD. A cozy work-friendly spot for WFC / WFA in BSD: specialty coffee, matcha, rice bowls, onigiri, yakitori & more. Order ahead with Grab & Go.";

export const metadata: Metadata = {
  metadataBase: new URL("https://machimoto.cafe"),
  title: TITLE,
  description: DESC,
  applicationName: "Machimoto Cafe",
  keywords: [
    "Machimoto", "Machimoto Cafe", "cafe BSD", "coffee shop BSD", "kafe BSD",
    "WFC BSD", "work from cafe BSD", "WFA BSD", "work from anywhere BSD",
    "cafe untuk kerja BSD", "wifi cafe BSD", "specialty coffee BSD",
    "matcha BSD", "Japanese cafe BSD", "cafe Ruko DelRey Biztown", "cafe BSD City",
    "cafe Serpong", "Tangerang Selatan cafe", "tempat nongkrong BSD", "brunch BSD",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  verification: { google: "3NJDsbLJgGtyOmxh_uiNt1jw6kYsAr00ix3U3H9NFIk" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://machimoto.cafe",
    siteName: "Machimoto Cafe",
    type: "website",
    locale: "id_ID",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Machimoto Cafe — BSD" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/opengraph-image"] },
};

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    name: "Machimoto Cafe",
    description: DESC,
    image: "https://machimoto.cafe/logo-machimoto.svg",
    url: "https://machimoto.cafe",
    servesCuisine: ["Japanese", "Coffee", "Cafe"],
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Ruko DelRey Biztown, Blok C2 No. 8",
      addressLocality: "BSD, Tangerang Selatan",
      addressRegion: "Banten",
      addressCountry: "ID",
    },
    sameAs: [SITE.instagram],
    hasMap: SITE.mapsUrl,
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"], opens: "07:00", closes: "19:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Friday", "Saturday"], opens: "08:00", closes: "21:00" },
    ],
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Free WiFi", value: true },
      { "@type": "LocationFeatureSpecification", name: "Good for working (WFC / WFA)", value: true },
    ],
    potentialAction: { "@type": "OrderAction", target: SITE.order },
  };
}

export default async function LandingPage() {
  const menu = await getMenu();
  const categories = menu.map((c) => ({
    id: c.id,
    name: c.name,
    items: c.items.map((it) => ({ id: it.id, name: it.name, description: it.description, imageUrl: it.imageUrl })),
  }));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      {/* SEO copy for crawlers/AI — visually hidden, real content for humans is the menu board */}
      <h1 style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
        Machimoto Cafe — Japanese comfort-food cafe & coffee shop at Ruko DelRey Biztown, BSD. Work-friendly WFC / WFA spot in BSD.
      </h1>
      <MenuBoard categories={categories} />
    </>
  );
}
