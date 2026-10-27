import { NavLink, Outlet } from 'react-router';
import { Icon, type IconName } from './Icon';
import styles from './nav.module.css';

const ITEMS: [to: string, label: string, icon: IconName][] = [
  ['/', 'Library', 'library'],
  ['/vocabulary', 'Vocabulary', 'words'],
  ['/bookmarks', 'Bookmarks', 'bookmark'],
  ['/settings', 'Settings', 'settings'],
];

/** UI-1: a bottom tab bar on phones, a top bar on desktop. The player has its own back button. */
export function WithNavBar() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Main">
        {ITEMS.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end className={styles.item}>
            <Icon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
