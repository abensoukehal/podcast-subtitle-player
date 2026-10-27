import { SHORTCUTS } from './shortcuts';
import styles from './screen.module.css';

/** SET-3, and the ? dialog in the player. */
export function ShortcutsTable() {
  return (
    <table className={styles.shortcuts}>
      <tbody>
        {SHORTCUTS.map(([keys, action]) => (
          <tr key={action}>
            <th scope="row">
              {keys.map((k, i) => (
                <span key={k}>
                  {i > 0 && ' '}
                  <kbd>{k}</kbd>
                </span>
              ))}
            </th>
            <td>{action}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
