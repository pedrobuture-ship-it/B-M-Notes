/** Safe, lowercase file slug: "Minha ideia!" -> "minha-ideia". */
export function slugify(input: string, fallback = "untitled"): string {
  const s = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || fallback;
}
