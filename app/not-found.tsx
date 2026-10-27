import Link from "next/link";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center max-w-md mx-auto">
      <Panel variant="surface" className="w-full space-y-4 py-10 rounded-3xl border border-[var(--border-default)] shadow-lg">
        <div className="text-4xl font-extrabold text-[var(--accent)] mono">
          404
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">
          That jar was never started
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
          The page or piggy savings pot you are looking for doesn&rsquo;t exist on this shelf.
        </p>
        <div className="pt-2">
          <Link href="/">
            <Button variant="primary" size="md">
              Return to Jar Shelf
            </Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
