import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="py-24 bg-white dark:bg-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-semibold text-black dark:text-white mb-8 tracking-tight">
            Machine Learning Research
          </h1>
          <p className="text-2xl md:text-3xl text-gray-600 dark:text-gray-400 mb-12 max-w-4xl mx-auto font-light leading-relaxed">
            Advancing cardiovascular science through innovative SphygmoCor technology and data-driven insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button 
              variant="ghost"
              className="text-lg px-8 py-6 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
              data-testid="browse-research-button"
            >
              Browse research
            </Button>
            <Button 
              variant="ghost"
              className="text-lg px-8 py-6 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
              data-testid="view-highlights-button"
            >
              View highlights
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
