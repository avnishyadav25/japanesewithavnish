"use client";

import { motion } from "framer-motion";

interface ProductSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function ProductSection({ children, delay = 0, className = "" }: ProductSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
