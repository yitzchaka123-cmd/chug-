import { agreementPdfAssetPaths, loadAgreementPdfAssets } from "@/lib/agreement-pdf";
import type { ChoirRuntimeEnv } from "@/lib/runtime-env";

export async function loadChoirDocumentAssets(request: Request, runtime: ChoirRuntimeEnv) {
  const brand = await runtime.DB.prepare(`SELECT sf.storage_key FROM brand_assets ba JOIN stored_files sf ON sf.id = ba.stored_file_id WHERE ba.kind = 'logo' AND ba.is_current = 1 AND ba.status = 'active' AND sf.status = 'active' ORDER BY ba.updated_at DESC LIMIT 1`).first<{ storage_key: string }>();
  return loadAgreementPdfAssets(async (path) => {
    if (path === agreementPdfAssetPaths.logo && brand?.storage_key) {
      const object = await runtime.BUCKET.get(brand.storage_key);
      if (object) return new Uint8Array(await object.arrayBuffer());
    }
    if (runtime.ASSETS) {
      const response = await runtime.ASSETS.fetch(new Request(new URL(path, request.url)));
      if (!response.ok) throw new Error(`Document asset ${path} could not be loaded.`);
      return new Uint8Array(await response.arrayBuffer());
    }
    try {
      const [{ readFile }, { join }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
      return new Uint8Array(await readFile(join(process.cwd(), "public", path.replace(/^\/+/, ""))));
    } catch {
      // Serverless bundles may not include public/; the deployment always
      // serves its own static assets, so fall back to fetching them.
      const response = await fetch(new URL(path, request.url));
      if (!response.ok) throw new Error(`Document asset ${path} could not be loaded.`);
      return new Uint8Array(await response.arrayBuffer());
    }
  });
}
