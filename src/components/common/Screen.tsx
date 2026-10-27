import type { ReactNode } from 'react';
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
        <h1 className={styles.heading}>{title}</h1>
        {actions}
      </header>
      {children}
    </main>
  );
}
