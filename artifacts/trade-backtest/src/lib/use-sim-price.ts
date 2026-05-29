import { useState, useEffect } from "react";

export function useSimPrice(base: number) {
  const [price, setPrice] = useState(base);

  // Reset to new base whenever the symbol changes
  useEffect(() => {
    setPrice(base);
  }, [base]);

  // Tick every 300ms for a real-time feel
  useEffect(() => {
    const id = setInterval(
      () => setPrice(p => Math.max(0.0001, p + (Math.random() - 0.5) * 0.0018 * p)),
      300,
    );
    return () => clearInterval(id);
  }, []);

  return price;
}
