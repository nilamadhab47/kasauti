// content.ts, not the package barrel: that barrel's .js specifiers do not resolve in Next.
import { catalogRoot, loadFileContentStore } from "../../../../../packages/core/src/content.ts";
import { CallersScreen } from "./callers-screen";

export default async function CallersPage() {
  const categories = await (await loadFileContentStore(catalogRoot())).listCategories();
  const deskForVertical: Record<string, string> = {};
  for (const category of categories) deskForVertical[category.vertical] = category.id;
  return <CallersScreen deskForVertical={deskForVertical} />;
}
