import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Link,
  Search,
  Wallet,
  CheckCircle,
  Globe,
  Upload,
  Plug,
  Settings2,
  Shield,
  DollarSign,
} from "lucide-react";

export function HowItWorks() {
  return (
    <section id="how">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-10 md:mb-14"
      >
        <h2 className="text-3xl md:text-4xl font-medium tracking-tight">
          How it works
        </h2>
        <p className="mt-3 text-base md:text-lg text-fog max-w-2xl mx-auto">
          Connect via MCP, discover licensed resources, then pay & fetch —
          powered by Walrus and SUI.
        </p>
      </motion.div>

      {/* Agents */}
      <div className="text-center text-sm uppercase tracking-widest text-fog mb-1">
        For AI Agents
      </div>
      <div className="mx-auto mb-4 h-px w-24 bg-white/10" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <StepCard
          step={1}
          title="Connect via MCP"
          description="Connect Suimo's MCP to your agent (Claude, ChatGPT, any OAuth-capable client) and authenticate with OAuth 2.0 (PKCE)"
        >
          <div className="flex-1 flex flex-col justify-start space-y-3">
            <div className="text-xs uppercase tracking-wider text-fog">
              Endpoint
            </div>
            <code className="block truncate rounded-lg bg-white/5 p-3 text-xs text-sand">
              https://suimo.onrender.com/mcp
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <Pill icon={Link} color="blue">OAuth 2.0 (PKCE)</Pill>
              <Pill color="purple">Claude</Pill>
              <Pill color="green">ChatGPT</Pill>
              <Pill color="cyan">Any MCP client</Pill>
            </div>
          </div>
        </StepCard>

        <StepCard
          step={2}
          title="Discover resources"
          description="Type your query; agent calls discover_resources to find licensed sources with details; you select the one you want"
        >
          <div className="flex-1 flex flex-col justify-start space-y-3">
            <div className="flex items-center gap-2 text-xs text-fog">
              <Search className="h-3.5 w-3.5" /> discover_resources(query)
            </div>
            <div className="space-y-2">
              <ResultRow name="Premium Articles" badge="$0.02 / KB" />
              <ResultRow name="News Archive API" badge="$0.10 / req" />
              <ResultRow name="Legal Docs DB" badge="$0.05 / KB" />
            </div>
          </div>
        </StepCard>

        <StepCard
          step={3}
          title="Pay & Fetch"
          description="Pay with your custodial balance in SUI USDC; receive a signed cryptographic receipt and your agent receives the data to work with"
        >
          <div className="flex-1 flex flex-col justify-start space-y-3">
            <div className="text-xs font-mono text-parchment/80">
              POST /v1/fetch
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-xs text-fog">
              {`{ url: "/articles/abc", budget: "$0.40" }`}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill icon={Wallet} color="green">Custodial wallet (SUI USDC)</Pill>
              <Pill color="blue">Instant custodial settlement</Pill>
              <Pill icon={CheckCircle} color="cyan">Signed receipt</Pill>
            </div>
          </div>
        </StepCard>
      </div>

      {/* Providers */}
      <div className="mt-10 text-center text-sm uppercase tracking-widest text-fog mb-1">
        For Data Providers
      </div>
      <div className="mx-auto mb-4 h-px w-24 bg-white/10" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        <StepCard
          step={4}
          title="Sign up & verify"
          description="Add your domain and verify via DNS TXT, or upload a file"
        >
          <div className="flex-1">
            <div className="grid grid-cols-1 auto-rows-min items-start gap-3">
              <ColorTile icon={Globe} label="Add domain" color="blue" />
              <ColorTile icon={Shield} label="Verify via DNS TXT" color="cyan" />
              <ColorTile icon={Upload} label="Upload verification file" color="orange" />
            </div>
          </div>
        </StepCard>

        <StepCard
          step={5}
          title="Auth & pricing"
          description="Add an auth connector, set pricing & access; or use Suimo's internal connector"
        >
          <div className="flex-1">
            <div className="grid grid-cols-1 auto-rows-min items-start gap-3">
              <ColorTile icon={Plug} label="Add auth connector" color="purple" />
              <ColorTile icon={Settings2} label="Set pricing & access rules" color="blue" />
              <ColorTile icon={Shield} label="Internal connector (Suimo-managed)" color="cyan" />
            </div>
          </div>
        </StepCard>

        <StepCard
          step={6}
          title="Publish & payouts"
          description="Publish resources. Usage credits accrue and settle to your payout wallet"
        >
          <div className="flex-1">
            <div className="grid grid-cols-1 auto-rows-min items-start gap-3">
              <ColorTile icon={CheckCircle} label="Sign & publish" color="green" />
              <ColorTile icon={DollarSign} label="Usage credits accrue" color="orange" />
              <ColorTile icon={Wallet} label="Payout wallet (auto-settlement)" color="green" />
            </div>
          </div>
        </StepCard>
      </div>
    </section>
  );
}

function StepCard({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: step * 0.1 }}
      className="group relative flex h-full flex-col rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 md:p-8 backdrop-blur-xl hover:border-white/15"
    >
      <div className="mb-2 text-xs uppercase tracking-widest text-fog">
        Step {String(step).padStart(2, "0")}
      </div>
      <h3 className="mb-2 text-xl md:text-2xl font-semibold">{title}</h3>
      <p className="mb-4 text-[15px] text-fog leading-relaxed">{description}</p>
      {children}
    </motion.div>
  );
}

function ResultRow({ name, badge }: { name: string; badge: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <span className="text-sm text-parchment/85">{name}</span>
      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-fog">
        {badge}
      </span>
    </div>
  );
}

function Pill({
  children,
  icon: Icon,
  color,
}: {
  children: ReactNode;
  icon?: any;
  color?: "blue" | "purple" | "cyan" | "orange" | "green";
}) {
  const styles: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    orange: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    green: "from-green-500/20 to-green-600/10 border-green-500/30",
  };
  const tint = color
    ? `bg-gradient-to-br ${styles[color]} text-parchment`
    : "bg-white/5 text-fog";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${tint} border-white/10`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-sand" />} {children}
    </span>
  );
}

function ColorTile({
  icon: Icon,
  label,
  color,
}: {
  icon: any;
  label: string;
  color: "blue" | "purple" | "cyan" | "orange" | "green";
}) {
  const styles: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    orange: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    green: "from-green-500/20 to-green-600/10 border-green-500/30",
  };
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border bg-gradient-to-br ${styles[color]} px-3 py-2 text-sm text-parchment shadow-lg shadow-black/10`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
        {Icon && <Icon className="h-3.5 w-3.5 text-sand" />}
      </span>
      <span className="whitespace-normal leading-snug">{label}</span>
    </div>
  );
}
