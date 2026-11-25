import { PDF_HUB, PDF_TOOLS } from "../../../shared/tools";
import { ToolCards } from "./ToolCards";
import { ToolShell } from "./ToolShell";

// /tools/pdf: الأدوات الأربع
export default function PdfHub() {
  return (
    <ToolShell meta={PDF_HUB}>
      <ToolCards tools={PDF_TOOLS} />
    </ToolShell>
  );
}
