import { MessageCircle } from "lucide-react";
import { useAdminWhatsapp, waLink } from "@/lib/contact";

export function ContactFooter() {
  const number = useAdminWhatsapp();
  return (
    <footer className="mt-12 border-t border-border bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} SkyBridge</span>
        <a
          href={waLink(number)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
          Contact admin: <span className="font-medium text-foreground">{number}</span>
        </a>
      </div>
    </footer>
  );
}