import { useEffect, useRef } from "react";
import { animate } from "@motionone/dom";

const SplitTextComponent = ({ text, className = "" }) => {
  const containerRef = useRef();

  useEffect(() => {
    if (!containerRef.current) return;
    const wordSpans = Array.from(containerRef.current.querySelectorAll(".split-word"));
    animate(
      wordSpans,
      {
        opacity: [0, 1],
        transform: ["translateY(1em)", "translateY(0)"]
      },
      {
        delay: (i) => i * 0.08,
        duration: 0.6,
        easing: "ease-out"
      }
    );
  }, [text]);

  // Split text into words and preserve spaces
  const words = text.split(/(\s+)/).map((word, i) => {
    if (word.trim() === "") {
      return word; // preserve whitespace
    }
    return (
      <span
        key={i}
        className="split-word inline-block opacity-0"
        style={{ willChange: "opacity, transform" }}
      >
        {word}
      </span>
    );
  });

  return (
    <div ref={containerRef} className={`split-text-container overflow-hidden ${className}`}>
      <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed tracking-wide px-4">
        {words}
      </p>
    </div>
  );
};

export default SplitTextComponent; 