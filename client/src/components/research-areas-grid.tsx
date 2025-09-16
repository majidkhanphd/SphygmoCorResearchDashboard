import { useState } from "react";
import { 
  Stethoscope, 
  Eye, 
  BarChart3, 
  Brain, 
  FileText, 
  HeartHandshake,
  ArrowRight
} from "lucide-react";

interface ResearchAreasGridProps {
  selectedArea: string | null;
  onAreaChange: (area: string | null) => void;
}

const researchAreas = [
  {
    id: "biomedical-engineering",
    name: "Biomedical Engineering",
    description: "Device research & measurement technology",
    icon: Stethoscope,
    color: "text-muted-foreground"
  },
  {
    id: "computer-vision", 
    name: "Computer Vision",
    description: "Medical imaging & visual analysis",
    icon: Eye,
    color: "text-muted-foreground"
  },
  {
    id: "data-analysis",
    name: "Data Analysis", 
    description: "Statistical studies & predictive modeling",
    icon: BarChart3,
    color: "text-muted-foreground"
  },
  {
    id: "methods-algorithms",
    name: "Methods and Algorithms",
    description: "Novel methodologies & frameworks",
    icon: Brain,
    color: "text-muted-foreground"
  },
  {
    id: "nlp",
    name: "Natural Language Processing",
    description: "Text analysis & information extraction",
    icon: FileText,
    color: "text-muted-foreground"
  },
  {
    id: "health-medical",
    name: "Health and Medical Research",
    description: "General medical & clinical studies",
    icon: HeartHandshake,
    color: "text-muted-foreground"
  }
];

export default function ResearchAreasGrid({ selectedArea, onAreaChange }: ResearchAreasGridProps) {
  const [hoveredArea, setHoveredArea] = useState<string | null>(null);

  const handleAreaClick = (areaId: string) => {
    if (selectedArea === areaId) {
      onAreaChange(null); // Deselect if clicking the same area
    } else {
      onAreaChange(areaId);
    }
  };

  const handleAllAreasClick = () => {
    onAreaChange(null);
  };

  return (
    <section className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Research Areas
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Explore cardiovascular research organized by methodological approach and domain expertise
          </p>
        </div>

        {/* All Areas Button */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleAllAreasClick}
            className={`
              px-6 py-3 rounded-full text-sm font-medium transition-all duration-200
              ${selectedArea === null 
                ? 'bg-primary text-primary-foreground shadow-lg' 
                : 'bg-card text-foreground border border-border hover:border-primary'
              }
            `}
            data-testid="filter-all-areas"
          >
            All Research Areas
          </button>
        </div>

        {/* Research Areas Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {researchAreas.map((area) => {
            const IconComponent = area.icon;
            const isSelected = selectedArea === area.id;
            const isHovered = hoveredArea === area.id;

            return (
              <button
                key={area.id}
                onClick={() => handleAreaClick(area.id)}
                onMouseEnter={() => setHoveredArea(area.id)}
                onMouseLeave={() => setHoveredArea(null)}
                className={`
                  group relative p-6 rounded-2xl text-left transition-all duration-300 transform
                  ${isSelected 
                    ? 'bg-accent ring-2 ring-primary shadow-lg scale-[1.02]' 
                    : 'bg-card border border-border hover:border-primary hover:shadow-lg hover:scale-[1.02]'
                  }
                `}
                data-testid={`research-area-${area.id}`}
              >
                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-200
                  ${isSelected 
                    ? 'bg-primary/10' 
                    : 'bg-muted group-hover:bg-muted/80'
                  }
                `}>
                  <IconComponent 
                    className={`w-6 h-6 ${isSelected ? 'text-primary' : area.color}`} 
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className={`
                    text-lg font-semibold transition-colors duration-200
                    ${isSelected ? 'text-primary' : 'text-foreground'}
                  `}>
                    {area.name}
                  </h3>
                  <p className={`
                    text-sm leading-relaxed transition-colors duration-200
                    ${isSelected ? 'text-primary/80' : 'text-muted-foreground'}
                  `}>
                    {area.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <ArrowRight 
                  className={`
                    absolute top-6 right-6 w-5 h-5 transition-all duration-200
                    ${isSelected 
                      ? 'text-primary opacity-100 translate-x-0' 
                      : 'text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                    }
                  `} 
                />

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-opacity-20 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {/* Results counter */}
        {selectedArea && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent text-foreground text-sm font-medium">
              Showing research in {researchAreas.find(area => area.id === selectedArea)?.name || selectedArea}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}