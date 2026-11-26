import daisy from "../assets/media/flowers/daisy.webp";
import hibiscus from "../assets/media/flowers/hibiscus.webp";
import rose from "../assets/media/flowers/rose.webp";
import sunflower from "../assets/media/flowers/sunflower.webp";
import tulip from "../assets/media/flowers/tulip.webp";
import violet from "../assets/media/flowers/violet.webp";

const FLOWERS = { daisy, hibiscus, rose, sunflower, tulip, violet };

// مكان الوردة في زاوية البطاقة (نصفها يطلع برا الزاوية). نستخدم left/right الفعلية مو اتجاه الصفحة.
const POSITIONS = {
  tl: "-top-5 -left-5",
  tr: "-top-5 -right-5",
  bl: "-bottom-5 -left-5",
  br: "-bottom-5 -right-5",
};

// وردة تلف ببطء. البطاقة لازم تكون relative و overflow-hidden.
export function SpinFlower({ name, pos = "tl", size = "w-20 h-20 sm:w-24 sm:h-24", seconds = 24, reverse = false }) {
  return (
    <img
      src={FLOWERS[name]}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`flower-spin pointer-events-none absolute ${POSITIONS[pos]} ${size}`}
      style={{ animationDuration: `${seconds}s`, animationDirection: reverse ? "reverse" : "normal" }}
    />
  );
}
