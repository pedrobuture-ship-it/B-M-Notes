export function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function timeStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dateStamp(d)}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function dailyTemplate(stamp: string): string {
  return `# ${stamp}\n\n## Notes\n\n- \n\n## Tasks\n\n- [ ] \n`;
}
