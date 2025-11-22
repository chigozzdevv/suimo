import { motion } from "framer-motion";
import { AlertCircle, Ban, ShieldAlert, DollarSign } from "lucide-react";

const agentProblems = [
  {
    icon: Ban,
    title: "403 Errors & Paywalls",
    description:
      "AI agents hit authorization walls trying to access premium content with no way to authenticate or pay",
  },
  {
    icon: ShieldAlert,
    title: "No Licensing Verification",
    description:
      "Unable to verify data authenticity, licensing terms, or usage rights before scraping",
  },
  {
    icon: AlertCircle,
    title: "Legal Risk",
    description:
      "Unauthorized scraping exposes agents and their operators to legal liability and IP violations",
  },
];

const ownerProblems = [
  {
    icon: DollarSign,
    title: "Zero Revenue from AI Traffic",
    description:
      "Content creators miss out on monetizing the billions of AI agent requests hitting their servers",
  },
  {
    icon: Ban,
    title: "All-or-Nothing Access",
    description:
      "Only two options: block all bots or allow free access. No granular control or metered billing",
  },
  {
    icon: AlertCircle,
    title: "No Usage Attribution",
    description:
      "Impossible to track which agents accessed what content or enforce usage limits and compliance",
  },
];

export function TheProblem() {
  return (
    <section>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
          The Problem
        </h2>
        <p className="mt-3 text-base text-fog md:text-lg">
          The web wasn't built for AI agents. Everyone loses.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <ProblemPanel
            title="AI Agents struggle with"
            problems={agentProblems}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <ProblemPanel
            title="Content Owners lose from"
            problems={ownerProblems}
          />
        </motion.div>
      </div>
    </section>
  );
}

function ProblemPanel({
  title,
  problems,
}: {
  title: string;
  problems: Array<{
    icon: React.ElementType;
    title: string;
    description: string;
  }>;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-transparent p-6 md:p-8">
      <h3 className="mb-6 text-lg font-medium text-parchment">{title}</h3>
      <div className="divide-y divide-white/5">
        {problems.map((problem) => {
          const Icon = problem.icon;
          return (
            <div
              key={problem.title}
              className="flex items-start gap-4 py-5 first:pt-0 last:pb-0"
            >
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-sand/10 ring-1 ring-sand/20">
                <Icon className="h-4 w-4 text-sand" />
              </div>
              <div>
                <h4 className="font-medium text-parchment">{problem.title}</h4>
                <p className="mt-1 text-sm text-fog">{problem.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
