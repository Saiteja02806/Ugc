import { ProductLogoMark } from "@/components/brand/product-logo";

export function ConsentBrandMark({
  className = "",
  theme = "auto",
}: {
  className?: string;
  theme?: "auto" | "light" | "dark";
}) {
  return <ProductLogoMark className={className} sizes="40px" theme={theme} />;
}
