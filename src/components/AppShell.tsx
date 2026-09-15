import { NavLink, Outlet } from "react-router-dom";
import { ProjectHeader } from "./ProjectHeader";
import styles from "./AppShell.module.css";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/brand-kit", label: "Brand Kit" },
  { to: "/ads", label: "Ads" },
  { to: "/logos", label: "Logos" },
  { to: "/overlays", label: "Overlays" },
  { to: "/exports", label: "Exports" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandmark}>
          <span className={styles.brandmarkDot} />
          Vibeforge
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>O-Kay-Est Media LLC</div>
      </aside>
      <div className={styles.main}>
        <ProjectHeader />
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
