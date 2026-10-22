import {
  ChevronLeft, ChevronRight, CircleArrowUp, CircleUserRound, ExternalLink,
  FileText, Gift, History, Layers3, Package, PackageOpen, Search, Settings,
  ShieldCheck, Swords, UsersRound, Wallet, type LucideProps,
} from "lucide-react";

const NAV_ICON_DEFAULTS = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

function withNavDefaults(Icon: typeof Package) {
  return function NavIcon(props: LucideProps) {
    return <Icon {...NAV_ICON_DEFAULTS} {...props} />;
  };
}

export const IconCases = withNavDefaults(Package);
export const IconBattles = withNavDefaults(Swords);
export const IconContracts = withNavDefaults(FileText);
export const IconUpgrader = withNavDefaults(CircleArrowUp);
export const IconCards = withNavDefaults(Layers3);
export const IconInventory = withNavDefaults(PackageOpen);
export const IconReferral = withNavDefaults(UsersRound);
export const IconGift = withNavDefaults(Gift);
export const IconSearch = withNavDefaults(Search);
export const IconWallet = withNavDefaults(Wallet);
export const IconProfile = withNavDefaults(CircleUserRound);
export const IconSettings = withNavDefaults(Settings);
export const IconHistory = withNavDefaults(History);
export const IconAdmin = withNavDefaults(ShieldCheck);
export const IconExternalLink = withNavDefaults(ExternalLink);
export const IconChevronLeft = withNavDefaults(ChevronLeft);
export const IconChevronRight = withNavDefaults(ChevronRight);

export const mainNavItems = [
  { to: "/", key: "cases", icon: IconCases, end: true },
  { to: "/battles", key: "battles", icon: IconBattles, end: false },
  { to: "/contracts", key: "contracts", icon: IconContracts, end: false },
  { to: "/upgrader", key: "upgrade", icon: IconUpgrader, end: false },
  { to: "/cards", key: "cards", icon: IconCards, end: false },
] as const;
