/** Strict finishes: a colour keyword or an unqualified Doppler is not a phase. */
export function matchesCaseTheme(slug: string, name: string): boolean {
  if (slug === "fade") return / \| Fade \((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/.test(name);
  if (slug === "ruby-crystal") return / \| Doppler \(Ruby\) \((Factory New|Minimal Wear)\)$/.test(name);
  if (slug === "sapphire-crystal") return / \| Doppler \(Sapphire\) \((Factory New|Minimal Wear)\)$/.test(name);
  if (slug === "doppler") return / \| Doppler \((Phase [1-4]|Ruby|Sapphire|Black Pearl)\) \((Factory New|Minimal Wear)\)$/.test(name);
  return true;
}
