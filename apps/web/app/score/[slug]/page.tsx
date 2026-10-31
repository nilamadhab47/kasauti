import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/report/report-view";
import { reportBySlug, topFinding } from "@/lib/report-model";
import { siteUrl } from "@/lib/site-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = reportBySlug(slug);
  const run = report?.runs[report.runs.length - 1];
  if (!report || !run) return { title: "Score" };
  const title = `${report.name} ${run.score}/100`;
  const description = `${report.name} · ${run.score}/100 · ${topFinding(run)}`;
  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ScorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = reportBySlug(slug);
  if (!report) notFound();

  return (
    <main className="min-h-screen bg-[#FFFDFB] text-neutral-900">
      <ReportView report={report} origin={siteUrl()} />
    </main>
  );
}
