import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import BackgroundGrid from "@/components/background-grid";

export function Hero() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  return (
    <section
      id="overview"
      className="relative hero-bg text-center overflow-hidden scroll-mt-24 md:scroll-mt-28"
      onMouseMove={(e) => {
        const t = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - t.left, y: e.clientY - t.top });
      }}
      onMouseLeave={() => setMouse(null)}
    >
      <BackgroundGrid mouse={mouse} />
      <div className="container-outer pt-28 pb-24 md:pt-36 md:pb-32 relative z-10">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-medium leading-tight tracking-tight text-balance max-w-4xl md:max-w-5xl mx-auto"
        >
          The gateway between
          <br />
          <span className="text-sand">AI agents and protected data</span>
        </motion.h1>

        <p className="mt-6 md:mt-7 hidden text-base md:block md:text-xl text-fog text-pretty max-w-2xl mx-auto">
          Suimo is an MCP gateway that lets AI agents fetch and consume data
          behind paywalls, logins, or anti-bot systems — legally and fairly —
          powered by Walrus+Seal on SUI.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 md:flex-row">
          <Button
            className="group h-12 gap-2 bg-blue-600 px-8 text-white hover:bg-blue-500"
            onClick={() => {
              window.location.href = "/get-started";
            }}
          >
            Start a Crawl{" "}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:scale-110" />
          </Button>
          <Button
            variant="ghost"
            className="h-11 gap-2 px-6"
            onClick={() => setDemoOpen(true)}
          >
            Watch Demo <Play className="h-4 w-4" />
          </Button>
        </div>

        <Modal
          open={demoOpen}
          title="Watch demo"
          onClose={() => setDemoOpen(false)}
        >
          <div className="relative w-full flex items-center justify-center overflow-hidden rounded-xl bg-black">
            <iframe
              width="100%"
              height="360"
              src="https://www.youtube.com/embed/vqFlRzuLa20"
              title="Suimo Demo | Walrus Haulout Hackerthon"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              style={{ aspectRatio: "16 / 9" }}
            />
          </div>
        </Modal>
      </div>
    </section>
  );
}
