import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import ui from './ui.module.css';
import styles from './screen.module.css';

/** Layout for the Vocabulary, Bookmarks and Settings screens. */
export function Screen({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <Link to="/" className={ui.iconButton} aria-label="Back to library">
          <Icon name="back" />
        </Link>
        <h1 className={styles.heading}>{title}</h1>
        {actions}
      </header>
      {children}
    </main>
  );
}
