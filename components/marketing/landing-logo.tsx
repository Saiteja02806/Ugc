import { ProductLogoMark } from "@/components/brand/product-logo";

export function LandingLogo({
  className,
  sizes = "28px",
}: {
  className?: string;
  sizes?: string;
}) {
  return <ProductLogoMark className={className} sizes={sizes} />;
}
