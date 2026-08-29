import { describe, it, expect } from "vitest";
import { periodMonths, totalExperience, formatExperience } from "../src/lib/recruitment";

// Fixed "today" so the ongoing/open-ended cases stay deterministic.
const NOW = new Date(2026, 7, 29); // 29 Aug 2026

const months = (raw: string) => periodMonths(raw, NOW);

describe("periodMonths — what applicants actually type", () => {
  it("reads year ranges", () => {
    expect(months("2022 - 2025")).toBe(36);
    expect(months("2024-2025")).toBe(12);
    expect(months("2019/2023")).toBe(48);
  });

  it("reads month-year ranges, in any casing", () => {
    expect(months("Januari 2026 - Agustus 2026")).toBe(7);
    expect(months("Oktober 2025-desember 2025")).toBe(2);
  });

  it("reads day-month-year with an 's/d' separator", () => {
    expect(months("20-Maret-2020 s/d 20-Agustus-2026")).toBe(77);
  });

  it("treats an open end as running until today", () => {
    expect(months("2023/sekarang")).toBe(43);
    expect(months("2025 / Sampai saat ini")).toBe(19);
  });

  it("takes a stated duration at face value", () => {
    expect(months("2 tahun 5 bulan")).toBe(29);
    expect(months("9 bulan")).toBe(9);
    expect(months("Kurang lebih 10 tahun di FNB")).toBe(120);
    expect(months("1 tahun 2025")).toBe(12); // the stray year is not a range
  });

  it("counts a bare year as that year, never into the future", () => {
    expect(months("2020")).toBe(12);
    expect(months("2026")).toBe(7); // Jan → Aug 2026
  });

  it("gives up on text with no period in it", () => {
    expect(months("")).toBeNull();
    expect(months("-")).toBeNull();
    expect(months("kapan saja")).toBeNull();
  });
});

describe("totalExperience", () => {
  it("adds every period up and reports how many it could read", () => {
    const t = totalExperience(
      [{ period: "2015 - 2016" }, { period: "2016 - 2020" }, { period: "2020 - 2023" }, { period: "2023 - 2026" }],
      NOW,
    );
    expect(t).toEqual({ months: 132, parsed: 4, entries: 4 });
  });

  it("skips what it cannot read", () => {
    const t = totalExperience([{ period: "2019-2025" }, { period: "lupa" }], NOW);
    expect(t).toEqual({ months: 72, parsed: 1, entries: 2 });
  });

  it("handles no experience at all", () => {
    expect(totalExperience([], NOW)).toEqual({ months: 0, parsed: 0, entries: 0 });
    expect(totalExperience(undefined, NOW)).toEqual({ months: 0, parsed: 0, entries: 0 });
  });
});

describe("formatExperience", () => {
  it("reads as years and months", () => {
    expect(formatExperience(132)).toBe("11 yr");
    expect(formatExperience(29)).toBe("2 yr 5 mo");
    expect(formatExperience(9)).toBe("9 mo");
  });
});
