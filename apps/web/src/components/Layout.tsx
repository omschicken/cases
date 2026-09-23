import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatMinor } from "../lib/money";
import type { WalletDto } from "../lib/types";

export function Layout() {
  const { user, logout } = useAuth();
  const [balanceMinor, setBalanceMinor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBalanceMinor(null);
      return;
    }
    api
      .get<WalletDto>("/wallet/me")
      .then((w) => setBalanceMinor(w.balanceMinor))
      .catch(() => setBalanceMinor(null));
  }, [user]);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <NavLink to="/" className="brand">
          <span className="brand-crosshair" aria-hidden="true" />
          GunDone<span className="brand-suffix">.case</span>
        </NavLink>
        <nav>
          <NavLink to="/">Cases</NavLink>
          {user && <NavLink to="/inventory">Inventory</NavLink>}
          {user && <NavLink to="/wallet">Wallet</NavLink>}
          {user && <NavLink to="/referral">Referral</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}
          {user?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-right">
          {user ? (
            <>
              {balanceMinor !== null && <span className="balance-pill">{formatMinor(balanceMinor)}</span>}
              <span className="user-email">{user.email}</span>
              <button onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Sign up</NavLink>
            </>
          )}
        </div>
      </header>
      <main className="page-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        GunDone.case — 18+ only. Gambling can be addictive, play responsibly.
        Provably-fair RNG: every case result can be independently verified.
        Licensed operator; licence status shown here in production.
      </footer>
    </div>
  );
}
