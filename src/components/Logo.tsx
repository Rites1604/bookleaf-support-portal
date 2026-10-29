import Image from "next/image";

/** The official BookLeaf Publishing logo (public/bookleaf-logo.png, 180×81). Height drives the size. */
export function Logo({ height = 40 }: { height?: number }) {
  return (
    <Image
      src="/bookleaf-logo.png"
      alt="BookLeaf Publishing"
      width={Math.round((height * 180) / 81)}
      height={height}
      priority
    />
  );
}
