export function parseWikiLinks(
  text: string,
  onLink: (title: string) => string
) {
  return text.replace(/\[([^\]]+)\]/g, (_, title) => {
    return onLink(title.trim());
  });
}
