import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alleman Corretora · Relatório Executivo" },
      { name: "description", content: "Acesso ao relatório executivo da Alleman Corretora." },
      { property: "og:title", content: "Alleman Corretora · Relatório Executivo" },
      { property: "og:description", content: "Acesso ao relatório executivo da Alleman Corretora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
