import { Suspense, lazy } from "react";
import NotFound from "./NotFoundTool";

// كل أداة تنحمّل لحالها، فمكتباتها (pdf-lib وpdf.js وغيرها) ما تبطّئ المتجر
const ToolsHome = lazy(() => import("./ToolsHome"));
const CoverMaker = lazy(() => import("./CoverMaker"));
const PdfHub = lazy(() => import("./PdfHub"));
const PdfImages = lazy(() => import("./PdfImages"));
const PdfMerge = lazy(() => import("./PdfMerge"));
const PdfSplit = lazy(() => import("./PdfSplit"));
const PdfCompress = lazy(() => import("./PdfCompress"));

const PAGES = {
  "/tools": ToolsHome,
  "/tools/cover": CoverMaker,
  "/tools/pdf": PdfHub,
  "/tools/pdf/images": PdfImages,
  "/tools/pdf/merge": PdfMerge,
  "/tools/pdf/split": PdfSplit,
  "/tools/pdf/compress": PdfCompress,
};

export default function ToolsRouter({ path }) {
  const Page = PAGES[path.replace(/\/+$/, "")] ?? NotFound;
  return (
    <Suspense fallback={<p className="lead text-center py-20 m-0">جاري تحميل الأداة…</p>}>
      <Page />
    </Suspense>
  );
}
