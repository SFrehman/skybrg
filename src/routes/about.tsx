import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Cloud, Lock, Zap, MessageCircle } from "lucide-react";
import ownerImg from "@/assets/owner.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SkyBridge" },
      { name: "description", content: "About SkyBridge — a secure personal vault for your files, built by Saif Jani." },
      { property: "og:title", content: "About — SkyBridge" },
      { property: "og:description", content: "About SkyBridge — a secure personal vault for your files." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Cloud className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-foreground">SkyBridge</span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1.5" /> Back</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 space-y-12">
        {/* Developer */}
        <section>
          <Card className="overflow-hidden border-border/60">
            <CardContent className="p-0">
              <div className="grid gap-0 md:grid-cols-[280px_1fr]">
                <div className="relative bg-gradient-to-br from-primary/20 to-primary/5 p-6 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute -inset-2 rounded-full bg-primary/20 blur-xl" />
                    <img
                      src={ownerImg}
                      alt="Saif Jani — Developer of SkyBridge"
                      className="relative h-48 w-48 rounded-full object-cover object-center ring-4 ring-background shadow-xl"
                    />
                  </div>
                </div>
                <div className="p-6 sm:p-8 space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-primary">Developer & Owner</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">Saif Jani</h2>
                    <p className="text-sm text-muted-foreground">Creator of SkyBridge</p>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    Saif built SkyBridge to solve a simple problem — having his important files
                    in one private, secure place that he could open from any device, any time.
                    What started as a personal tool grew into a polished vault designed around
                    privacy, speed, and a calm user experience.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Product</span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Design</span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Engineering</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" asChild>
                      <a href="https://wa.me/923153857725" target="_blank" rel="noreferrer">
                        <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp 0315 3857725
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Private. Encrypted. Yours.
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            About <span className="text-primary">SkyBridge</span>
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            SkyBridge is a personal vault for your files — a quiet, secure bridge
            between your devices and the cloud. Upload once, access anywhere.
          </p>
        </section>

        {/* Features */}
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, title: "Secure by Default", text: "Protected access with passkey authentication." },
            { icon: Zap, title: "Fast & Light", text: "Instant uploads with realtime sync across devices." },
            { icon: Cloud, title: "Always Available", text: "Your files are always one tap away, anywhere." },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-border/60">
              <CardContent className="p-5 space-y-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">{text}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SkyBridge. Crafted with care.
        </footer>
      </main>
    </div>
  );
}