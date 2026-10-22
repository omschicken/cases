import { useEffect, useState } from "react";
import { resolveItemImage } from "../../lib/itemImages";

interface EditorialItemImageProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  decorative?: boolean;
  loading?: "eager" | "lazy";
}

export function EditorialItemImage({
  name,
  imageUrl,
  className,
  decorative = false,
  loading = "lazy",
}: EditorialItemImageProps) {
  const resolved = resolveItemImage(name, imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [resolved.url]);

  if (!resolved.url || failed) {
    const [weapon, finish] = name.replace(/ \([^)]*\)$/, "").split(" | ");
    return (
      <div
        className={["dze-item-fallback", className].filter(Boolean).join(" ")}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative || undefined}
        data-image-fallback="true"
      >
        <span>{weapon}</span>
        {finish && <strong>{finish}</strong>}
      </div>
    );
  }

  return (
    <img
      className={className}
      src={resolved.url}
      alt={decorative ? "" : name}
      aria-hidden={decorative || undefined}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      data-image-source={resolved.status}
    />
  );
}
