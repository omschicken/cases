import { useState } from "react";
import { resolveItemImageSources } from "../../lib/itemImages";

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
  const sources = resolveItemImageSources(name, imageUrl);
  const sourceKey = sources.map((source) => source.url).join("\\u0000");
  const [failedSource, setFailedSource] = useState({ key: "", index: 0 });
  // Changing the item synchronously resets the selected source without a
  // one-frame blank state. Each image failure advances once to the next URL.
  const index = failedSource.key === sourceKey ? failedSource.index : 0;
  const active = sources[index];

  if (!active) {
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
      src={active.url}
      alt={decorative ? "" : name}
      aria-hidden={decorative || undefined}
      loading={loading}
      decoding="async"
      onError={() => setFailedSource({ key: sourceKey, index: index + 1 })}
      data-image-source={active.status}
    />
  );
}
