import { useState, useEffect, useRef } from "react";

export function useSimPrice(base: number) {
  const [price, setPrice] = useState(base);
  const baseRef = useRef(base);
  baseRef.current = base;
  useEffect(() => {
    setPrice(baseRef.current);
    const id = setInterval(
      () => setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p)),
      900,
    );
    return () => clearInterval(id);
  }, []);
  return price;
}
