import { LearnSubNav } from "@/components/learn/LearnSubNav";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LearnSubNav />
      {children}
    </>
  );
}
