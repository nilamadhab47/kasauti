import Image from "next/image";

/** Nav lockup from the brand file. 40px tall, not redrawn. */
export function Mark({ height = 40 }: { height?: number }) {
  const width = Math.round(height * (1024 / 409));
  return (
    <Image
      id="nav-mark"
      className="lockup-img"
      src="/brand/lockup-black.png"
      alt="Kasauti"
      height={height}
      width={width}
      priority
      draggable={false}
    />
  );
}
