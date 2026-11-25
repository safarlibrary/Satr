import { linkTo } from "../../lib/router";

export default function NotFoundTool() {
  return (
    <section className="wrap py-16 text-center">
      <h1 className="text-[30px] font-extrabold m-0">الأداة هذي مو موجودة</h1>
      <p className="lead mt-2 mb-0">يمكن الرابط قديم. شوف كل الأدوات من هنا.</p>
      <a href={linkTo("/tools")} className="btn mt-6">
        أدوات الطالب
      </a>
    </section>
  );
}
