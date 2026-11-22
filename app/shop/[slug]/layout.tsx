import type { ReactNode } from "react";
import CreativehubProductPhotos from "@/app/components/CreativehubProductPhotos";

// Nested route layout: avoids modifying existing artwork/shop pages.
export default function ProductPhotosLayout({ children }: { children: ReactNode }) {
  return <>{children}<CreativehubProductPhotos /></>;
}
