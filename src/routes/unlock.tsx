import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockSite } from "@/lib/gate.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/unlock")({
  head: () => ({
    meta: [
      { title: "Acesso Executivo · Alleman Corretora" },
      { name: "description", content: "Portal executivo de inteligência de tráfego e funil comercial." },
      { property: "og:title", content: "Acesso Executivo · Alleman Corretora" },
      { property: "og:description", content: "Acesso restrito ao relatório executivo da Alleman Corretora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Unlock,
});

function Unlock() {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockSite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(false);
    setLoading(true);
    const password = new FormData(e.currentTarget).get("password") as string;
    const { ok } = await unlock({ data: { password } });
    setLoading(false);
    if (ok) await navigate({ to: "/dashboard" });
    else setError(true);
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 text-foreground"
      style={{ backgroundImage: "var(--grad-hero)" }}
    >
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="bento-card w-full max-w-[420px] p-7 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] font-medium tracking-wide text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Portal Executivo · Acesso Restrito
          </span>

          <div className="mt-6 flex items-center justify-center gap-3.5">
            <img
              src="/trive-logo.png"
              alt="Trive"
              className="h-9 w-auto shrink-0 object-contain"
            />
            <span className="h-7 w-px bg-border" aria-hidden />
            <img
              src="/alleman-logo.jpg"
              alt="Alleman Corretora"
              className="h-10 w-auto shrink-0 rounded-lg border border-border/80 bg-white p-1 object-contain shadow-2xs"
            />
          </div>

          <h1 className="mt-5 font-display text-xl font-semibold tracking-tight text-foreground">
            Painel de Performance &amp; CRM
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            Insira a credencial executiva para consultar os indicadores consolidados da Alleman Corretora.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-foreground">
              Credencial de acesso
            </Label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite a senha de acesso"
                required
                autoFocus
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 pr-11 text-base text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Senha incorreta. Verifique a credencial informada.</span>
            </div>
          )}

          <Button type="submit" className="h-10 w-full cursor-pointer font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Autenticando…
              </>
            ) : (
              "Acessar painel"
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] tracking-wider text-muted-foreground uppercase">
        Trive × Alleman Corretora · Inteligência de Aquisição
      </p>
    </div>
  );
}
