import { loadFont } from "@remotion/google-fonts/BeVietnamPro";

// Be Vietnam Pro covers Vietnamese diacritics and Latin.
export const { fontFamily } = loadFont("normal", {
  weights: ["600", "800"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});
