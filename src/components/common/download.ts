/** Hands the viewer a file to save. */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari reads the URL after click()
}

/** Today as YYYY-MM-DD, for file names. */
export const today = () => new Date().toISOString().slice(0, 10);
