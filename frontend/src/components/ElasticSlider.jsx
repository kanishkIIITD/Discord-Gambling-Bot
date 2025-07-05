import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useTransform
} from "framer-motion";
import { useEffect, useRef, useState } from "react";

const MAX_OVERFLOW = 50;

export default function ElasticSlider({
  defaultValue = 50,
  startingValue = 0,
  maxValue = 100,
  className = "",
  isStepped = false,
  stepSize = 1,
  leftIcon = <>-</>,
  rightIcon = <>+</>,
  onChange = () => {}
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 w-48 ${className}`}>
      <Slider
        defaultValue={defaultValue}
        startingValue={startingValue}
        maxValue={maxValue}
        isStepped={isStepped}
        stepSize={stepSize}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
        onChange={onChange}
      />
    </div>
  );
}

function Slider({
  defaultValue,
  startingValue,
  maxValue,
  isStepped,
  stepSize,
  leftIcon,
  rightIcon,
  onChange
}) {
  const [value, setValue] = useState(defaultValue);
  const sliderRef = useRef(null);
  const [region, setRegion] = useState("middle");
  const clientX = useMotionValue(0);
  const overflow = useMotionValue(0);
  const scale = useMotionValue(1);
  const transformOrigin = useMotionValue("center");

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    onChange(value);
  }, [value, onChange]);

  useMotionValueEvent(clientX, "change", (latest) => {
    if (sliderRef.current) {
      const { left, right } = sliderRef.current.getBoundingClientRect();
      let newValue;

      if (latest < left) {
        setRegion("left");
        newValue = left - latest;
      } else if (latest > right) {
        setRegion("right");
        newValue = latest - right;
      } else {
        setRegion("middle");
        newValue = 0;
      }

      overflow.set(decay(newValue, MAX_OVERFLOW));
    }
  });

  useEffect(() => {
    const updateTransformOrigin = () => {
      if (!sliderRef.current) return;
      const { left, width } = sliderRef.current.getBoundingClientRect();
      const currentX = clientX.get();
      const origin = currentX < left + width / 2 ? "right" : "left";
      transformOrigin.set(origin);
    };

    const unsubscribe = clientX.on("change", updateTransformOrigin);
    return () => unsubscribe();
  }, []);

  const handlePointerMove = (e) => {
    if (e.buttons > 0 && sliderRef.current) {
      const { left, width } = sliderRef.current.getBoundingClientRect();
      let newValue = startingValue + ((e.clientX - left) / width) * (maxValue - startingValue);

      if (isStepped) {
        newValue = Math.round(newValue / stepSize) * stepSize;
      }

      newValue = Math.min(Math.max(newValue, startingValue), maxValue);
      setValue(newValue);
      clientX.set(e.clientX);
    }
  };

  const handlePointerDown = (e) => {
    handlePointerMove(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = () => {
    animate(overflow, 0, { type: "spring", bounce: 0.5 });
  };

  const getRangePercentage = () => {
    const totalRange = maxValue - startingValue;
    if (totalRange === 0) return 0;
    return ((value - startingValue) / totalRange) * 100;
  };

  const scaleX = useTransform(() => {
    const width = sliderRef.current?.getBoundingClientRect().width ?? 1;
    return 1 + overflow.get() / width;
  });

  const scaleY = useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]);
  const height = useTransform(scale, [1, 1.2], [6, 12]);
  const marginTop = useTransform(scale, [1, 1.2], [0, -3]);
  const marginBottom = useTransform(scale, [1, 1.2], [0, -3]);
  const opacity = useTransform(scale, [1, 1.2], [0.7, 1]);

  const leftX = useTransform(() => (region === "left" ? -overflow.get() / scale.get() : 0));
  const rightX = useTransform(() => (region === "right" ? overflow.get() / scale.get() : 0));

  return (
    <>
      <motion.div
        onHoverStart={() => animate(scale, 1.2)}
        onHoverEnd={() => animate(scale, 1)}
        onTouchStart={() => animate(scale, 1.2)}
        onTouchEnd={() => animate(scale, 1)}
        style={{ scale, opacity }}
        className="flex w-full touch-none select-none items-center justify-center gap-4"
      >
        <motion.div
          animate={{
            scale: region === "left" ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{ x: leftX }}
        >
          {leftIcon}
        </motion.div>

        <div
          ref={sliderRef}
          className="relative flex w-full max-w-xs flex-grow cursor-grab touch-none select-none items-center py-4"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
        >
          <motion.div
            style={{ scaleX, scaleY, transformOrigin, height, marginTop, marginBottom }}
            className="flex flex-grow"
          >
            <div className="relative h-full flex-grow overflow-hidden rounded-full bg-border">
              <div
                className="absolute h-full bg-primary rounded-full"
                style={{ width: `${getRangePercentage()}%` }}
              />
            </div>
          </motion.div>
        </div>

        <motion.div
          animate={{
            scale: region === "right" ? [1, 1.4, 1] : 1,
            transition: { duration: 0.25 },
          }}
          style={{ x: rightX }}
        >
          {rightIcon}
        </motion.div>
      </motion.div>
      <p className="absolute text-text-secondary transform -translate-y-4 text-xs font-medium tracking-wide">
        {Math.round(value)}
      </p>
    </>
  );
}

function decay(value, max) {
  if (max === 0) return 0;
  const entry = value / max;
  const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);
  return sigmoid * max;
}