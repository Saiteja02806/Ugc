"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Eye,
  FileVideo,
  Heart,
  Images,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SidebarIcon } from "@/components/icons/sidebar-icon";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AnalyticsRange = "7d" | "30d" | "90d";

type AnalyticsDataset = {
  engagement: number;
  engagementChange: number;
  engagementRate: number;
  labels: string[];
  points: number[];
  posts: number;
  views: number;
  viewsChange: number;
};

const rangeOptions: Array<{ label: string; value: AnalyticsRange }> = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
];

const analyticsByRange: Record<AnalyticsRange, AnalyticsDataset> = {
  "7d": {
    engagement: 2_480,
    engagementChange: 8.4,
    engagementRate: 7.8,
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    points: [2_900, 3_600, 3_250, 5_100, 5_850, 6_500, 7_320],
    posts: 5,
    views: 31_800,
    viewsChange: 14.2,
  },
  "30d": {
    engagement: 9_240,
    engagementChange: 12.1,
    engagementRate: 7.4,
    labels: ["Jun 15", "Jun 20", "Jun 25", "Jun 30", "Jul 5", "Jul 10", "Jul 14"],
    points: [8_400, 10_900, 12_600, 11_800, 15_200, 17_900, 19_600],
    posts: 18,
    views: 124_500,
    viewsChange: 24.0,
  },
  "90d": {
    engagement: 27_900,
    engagementChange: 31.6,
    engagementRate: 7.1,
    labels: ["Apr 15", "May 1", "May 15", "Jun 1", "Jun 15", "Jul 1", "Jul 14"],
    points: [15_600, 18_300, 20_900, 26_400, 31_200, 36_800, 42_100],
    posts: 51,
    views: 392_800,
    viewsChange: 38.5,
  },
};

const topCreatives = [
  {
    engagement: "8.9% engagement",
    format: "UGC video",
    icon: FileVideo,
    platform: "TikTok",
    title: "The 15-second product walkthrough",
    tone: "navy",
    views: "60.2K",
  },
  {
    engagement: "7.1% engagement",
    format: "Carousel",
    icon: Images,
    platform: "Instagram",
    title: "Campaign chaos slows your team down",
    tone: "orange",
    views: "45.0K",
  },
  {
    engagement: "5.4% engagement",
    format: "Product demo",
    icon: Eye,
    platform: "YouTube",
    title: "From blank page to published post",
    tone: "stone",
    views: "17.3K",
  },
] as const;

const platforms = [
  {
    bestFormat: "Short UGC video",
    comments: 300,
    engagement: 7_900,
    likes: 4_500,
    name: "TikTok",
    share: 50,
    views: 62_000,
  },
  {
    bestFormat: "Problem-led carousel",
    comments: 120,
    engagement: 4_100,
    likes: 3_200,
    name: "Instagram",
    share: 36,
    views: 45_000,
  },
  {
    bestFormat: "Product walkthrough",
    comments: 90,
    engagement: 1_020,
    likes: 540,
    name: "YouTube",
    share: 14,
    views: 17_500,
  },
] as const;

const recentPosts = [
  {
    comments: 186,
    likes: 3_000,
    platform: "TikTok",
    published: "Today",
    saves: 412,
    title: "One workflow, three finished posts",
    views: 45_200,
  },
  {
    comments: 84,
    likes: 1_480,
    platform: "Instagram",
    published: "2 days ago",
    saves: 267,
    title: "The hidden cost of campaign chaos",
    views: 22_600,
  },
  {
    comments: 41,
    likes: 610,
    platform: "YouTube",
    published: "4 days ago",
    saves: 96,
    title: "Build your first UGC workflow",
    views: 12_800,
  },
] as const;

export function AnalyticsDashboard({
  initialRange,
}: {
  initialRange: AnalyticsRange;
}) {
  const router = useRouter();
  const [range, setRange] = useState<AnalyticsRange>(initialRange);
  const dataset = analyticsByRange[range];

  function selectRange(nextRange: AnalyticsRange) {
    setRange(nextRange);

    const params = new URLSearchParams(window.location.search);
    params.set("range", nextRange);
    router.replace(`/analytics?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7 xl:px-10">
      <div className="mx-auto w-full max-w-[1360px]">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
              <SidebarIcon name="analytics" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground-strong sm:text-[30px]">
                Analytics
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                See which posts, platforms, and creative ideas are earning attention.
              </p>
            </div>
          </div>

          <div
            aria-label="Analytics date range"
            className="inline-flex w-fit rounded-control border border-border bg-card p-1"
            role="group"
          >
            {rangeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                onClick={() => selectRange(option.value)}
                className={cn(
                  "h-8 rounded-small px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
                  range === option.value
                    ? "bg-foreground-strong text-white"
                    : "text-muted hover:bg-card-muted hover:text-foreground-strong",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 rounded-card border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-primary">
              Sample data
            </span>
            <p className="text-sm leading-6 text-muted">
              Connect a publishing account to replace this preview with your post performance.
            </p>
          </div>
          <Link
            href="/connected-accounts"
            className={buttonClassName({
              variant: "secondary",
              className: "h-9 w-fit shrink-0 gap-1.5 px-3 text-xs",
            })}
          >
            Connect accounts
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <MetricRail dataset={dataset} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
          <PerformanceChart dataset={dataset} range={range} />
          <CreativeSignal />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <TopCreatives />
          <PlatformPerformance />
        </div>

        <RecentPosts />
      </div>
    </section>
  );
}

function MetricRail({ dataset }: { dataset: AnalyticsDataset }) {
  const metrics = [
    {
      change: dataset.viewsChange,
      icon: Eye,
      label: "Total views",
      value: formatCompactNumber(dataset.views),
    },
    {
      change: dataset.engagementChange,
      icon: Heart,
      label: "Engagement",
      value: formatCompactNumber(dataset.engagement),
    },
    {
      icon: Send,
      label: "Posts published",
      value: dataset.posts.toString(),
    },
    {
      icon: ArrowUpRight,
      label: "Engagement rate",
      value: `${dataset.engagementRate.toFixed(1)}%`,
    },
  ];

  return (
    <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div key={metric.label} className="min-w-0 bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs font-semibold text-muted">{metric.label}</dt>
              <Icon className="size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
            </div>
            <dd className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
              <span className="text-2xl font-semibold tracking-[-0.025em] text-foreground-strong tabular-nums sm:text-[28px]">
                {metric.value}
              </span>
              {metric.change ? (
                <span className="mb-1 inline-flex items-center gap-0.5 text-xs font-semibold text-success">
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  {metric.change.toFixed(1)}%
                </span>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function PerformanceChart({
  dataset,
  range,
}: {
  dataset: AnalyticsDataset;
  range: AnalyticsRange;
}) {
  const chartWidth = 700;
  const chartHeight = 230;
  const chartLeft = 28;
  const chartRight = 680;
  const chartTop = 28;
  const chartBottom = 184;
  const maximum = Math.max(...dataset.points) * 1.12;
  const coordinates = dataset.points.map((point, index) => {
    const x = chartLeft + ((chartRight - chartLeft) * index) / (dataset.points.length - 1);
    const y = chartBottom - ((chartBottom - chartTop) * point) / maximum;
    return { x, y };
  });
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? chartRight} ${chartBottom} L ${coordinates[0]?.x ?? chartLeft} ${chartBottom} Z`;

  return (
    <section className="min-w-0 rounded-card border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground-strong">Engagement trend</h2>
          <p className="mt-1 text-sm leading-5 text-muted">
            Daily views across published posts in this period.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-success">
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
          Momentum is rising
        </span>
      </div>

      <div className="mt-5 overflow-hidden">
        <svg
          aria-label={`Engagement trend for the selected ${range} range`}
          className="h-auto w-full"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <title>Engagement trend</title>
          {[0, 1, 2, 3].map((line) => {
            const y = chartTop + ((chartBottom - chartTop) * line) / 3;
            return (
              <line
                key={line}
                x1={chartLeft}
                x2={chartRight}
                y1={y}
                y2={y}
                stroke="#e8e4df"
                strokeDasharray="4 6"
              />
            );
          })}
          <path d={areaPath} fill="#fff1e8" />
          <path
            d={linePath}
            fill="none"
            stroke="#c94716"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
          {coordinates.map((point, index) => (
            <circle
              key={dataset.labels[index]}
              cx={point.x}
              cy={point.y}
              fill={index === coordinates.length - 1 ? "#c94716" : "#ffffff"}
              r={index === coordinates.length - 1 ? 5 : 3}
              stroke="#c94716"
              strokeWidth="2"
            />
          ))}
          {dataset.labels.map((label, index) => (
            <text
              key={label}
              x={coordinates[index]?.x}
              y="216"
              fill="#6b6e77"
              fontSize="11"
              fontWeight="600"
              textAnchor={index === 0 ? "start" : index === dataset.labels.length - 1 ? "end" : "middle"}
            >
              {label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function CreativeSignal() {
  return (
    <aside className="flex min-h-[320px] flex-col rounded-card bg-foreground-strong p-5 text-white sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-control bg-white/10 text-brand">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/70">
          Creative signal
        </span>
      </div>
      <h2 className="mt-6 text-xl font-semibold leading-7 !text-white">
        Short product demos are your strongest format.
      </h2>
      <p className="mt-3 text-sm leading-6 text-white/68">
        Hook-led UGC videos drove 61% of engagement. The best posts show the product within the first 3 seconds.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/12 pt-5">
        <div>
          <dt className="text-xs font-medium text-white/55">Best platform</dt>
          <dd className="mt-1 text-sm font-semibold text-white">TikTok</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-white/55">Best format</dt>
          <dd className="mt-1 text-sm font-semibold text-white">UGC video</dd>
        </div>
      </dl>

      <Link
        href="/video-gen"
        className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-control bg-white px-4 text-sm font-semibold text-foreground-strong transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-foreground-strong"
      >
        Create a similar video
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}

function TopCreatives() {
  return (
    <section className="rounded-card border border-border bg-card">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-foreground-strong">Top-performing creatives</h2>
          <p className="mt-1 text-sm leading-5 text-muted">What to make more of next.</p>
        </div>
        <Link
          href="/library?tab=posts"
          className="inline-flex h-8 shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Open library
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ol className="divide-y divide-border">
        {topCreatives.map((creative, index) => {
          const Icon = creative.icon;
          return (
            <li
              key={creative.title}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[28px_64px_minmax(0,1fr)_auto] sm:items-center sm:px-5"
            >
              <span className="text-sm font-semibold text-muted tabular-nums">{index + 1}</span>
              <span
                className={cn(
                  "flex aspect-[4/5] w-14 items-center justify-center rounded-small",
                  creative.tone === "navy" && "bg-deep-contrast text-white",
                  creative.tone === "orange" && "bg-brand-soft text-primary",
                  creative.tone === "stone" && "bg-card-muted text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground-strong">{creative.title}</h3>
                <p className="mt-1 text-xs font-medium text-muted">
                  {creative.platform} · {creative.format}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-semibold text-foreground-strong tabular-nums">{creative.views} views</p>
                <p className="mt-1 text-xs font-medium text-success">{creative.engagement}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PlatformPerformance() {
  return (
    <section className="rounded-card border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground-strong">Platform breakdown</h2>
      <p className="mt-1 text-sm leading-5 text-muted">Where your content is earning results.</p>

      <div className="mt-5 space-y-5">
        {platforms.map((platform) => (
          <div key={platform.name}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground-strong">{platform.name}</h3>
                <p className="mt-1 text-xs font-medium text-muted">{platform.bestFormat}</p>
              </div>
              <p className="text-sm font-semibold text-foreground-strong tabular-nums">
                {formatCompactNumber(platform.views)} views
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${platform.share}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted tabular-nums">
              <span>{formatCompactNumber(platform.likes)} likes</span>
              <span>{platform.comments} comments</span>
              <span>{formatCompactNumber(platform.engagement)} interactions</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentPosts() {
  return (
    <section className="mt-5 overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-foreground-strong">Recent posts</h2>
          <p className="mt-1 text-sm leading-5 text-muted">Latest published content and early signals.</p>
        </div>
        <span className="text-xs font-semibold text-muted">Updated 2 hours ago</span>
      </div>

      <div className="divide-y divide-border">
        {recentPosts.map((post) => (
          <article
            key={post.title}
            className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(80px,0.45fr))] md:items-center sm:px-5"
          >
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground-strong">{post.title}</h3>
              <p className="mt-1 text-xs font-medium text-muted">{post.platform} · {post.published}</p>
            </div>
            <PostMetric icon={Eye} label="Views" value={formatCompactNumber(post.views)} />
            <PostMetric icon={Heart} label="Likes" value={formatCompactNumber(post.likes)} />
            <PostMetric icon={MessageCircle} label="Comments" value={post.comments.toString()} />
            <PostMetric icon={Bookmark} label="Saves" value={post.saves.toString()} />
          </article>
        ))}
      </div>
    </section>
  );
}

function PostMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 md:block">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <p className="mt-0 text-sm font-semibold text-foreground-strong tabular-nums md:mt-1">{value}</p>
    </div>
  );
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}
