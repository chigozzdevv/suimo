import { motion } from 'framer-motion'

const features = [
  {
    title: 'Authorized by design',
    description:
      'Issue time-boxed, scope-limited crawl tokens bound to domains, paths, or queries. Every request is signed and traceable.',
  },
  {
    title: 'Agent-first protocol',
    description:
      'First-class support for Model Context Protocol (MCP) so LLM agents can request capabilities without leaking secrets.',
  },
  {
    title: 'Usage-based billing',
    description:
      'Fair, per-crawl metering with spending caps. Pay only for what you fetch with instant USDC settlement.',
  },
]

export function FeatureGrid() {
  return (
    <section id="features" className="grid gap-5 md:grid-cols-3">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <FeatureCard {...feature} />
        </motion.div>
      ))}
    </section>
  )
}

type FeatureCardProps = {
  title: string
  description: string
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="h-full">
      <h3 className="text-lg md:text-xl font-semibold text-parchment">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-fog">{description}</p>
    </div>
  )
}
