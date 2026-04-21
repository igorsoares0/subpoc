export const FONT_FAMILY_CSS: Record<string, string> = {
  Inter: "var(--font-inter), sans-serif",
  Montserrat: "var(--font-montserrat), sans-serif",
  Poppins: "var(--font-poppins), sans-serif",
  Roboto: "var(--font-roboto), sans-serif",
  Arial: "Arial, sans-serif",
  Helvetica: "Helvetica, Arial, sans-serif",
};

export function resolveFontFamily(family: string | undefined): string {
  if (!family) return "var(--font-poppins), sans-serif";
  return FONT_FAMILY_CSS[family] || `${family}, sans-serif`;
}
