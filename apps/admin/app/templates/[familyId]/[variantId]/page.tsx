import { redirect } from "next/navigation";
import { appPath } from "../../../../lib/base-path";

type PageProps = {
  params: Promise<{ familyId: string; variantId: string }>;
};

export default async function LegacyTemplateDesignerRedirect({ params }: PageProps) {
  const resolvedParams = await params;
  redirect(
    appPath(
      `/templates/designer?familyId=${encodeURIComponent(resolvedParams.familyId)}&variantId=${encodeURIComponent(resolvedParams.variantId)}`
    )
  );
}
