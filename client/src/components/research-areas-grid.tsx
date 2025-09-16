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
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    id: "computer-vision", 
    name: "Computer Vision",
    description: "Medical imaging & visual analysis",
    icon: Eye,
    color: "text-emerald-600 dark:text-emerald-400"
  },
  {
    id: "data-analysis",
    name: "Data Analysis", 
    description: "Statistical studies & predictive modeling",
    icon: BarChart3,
    color: "text-purple-600 dark:text-purple-400"
  },
  {
    id: "methods-algorithms",
    name: "Methods and Algorithms",
    description: "Novel methodologies & frameworks",
    icon: Brain,
    color: "text-orange-600 dark:text-orange-400"
  },
  {
    id: "nlp",
    name: "Natural Language Processing",
    description: "Text analysis & information extraction",
    icon: FileText,
    color: "text-indigo-600 dark:text-indigo-400"
  },
  {
    id: "health-medical",
    name: "Health and Medical Research",
    description: "General medical & clinical studies",
    icon: HeartHandshake,
    color: "text-rose-600 dark:text-rose-400"
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
    <section className="py-16 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Research Areas
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
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
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500'
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
                    ? 'bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-500 shadow-lg scale-[1.02]' 
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg hover:scale-[1.02]'
                  }
                `}
                data-testid={`research-area-${area.id}`}
              >
                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-200
                  ${isSelected 
                    ? 'bg-blue-100 dark:bg-blue-900' 
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                  }
                `}>
                  <IconComponent 
                    className={`w-6 h-6 ${isSelected ? 'text-blue-600 dark:text-blue-400' : area.color}`} 
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className={`
                    text-lg font-semibold transition-colors duration-200
                    ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'}
                  `}>
                    {area.name}
                  </h3>
                  <p className={`
                    text-sm leading-relaxed transition-colors duration-200
                    ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}
                  `}>
                    {area.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <ArrowRight 
                  className={`
                    absolute top-6 right-6 w-5 h-5 transition-all duration-200
                    ${isSelected 
                      ? 'text-blue-600 dark:text-blue-400 opacity-100 translate-x-0' 
                      : 'text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1'
                    }
                  `} 
                />

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-500 ring-opacity-20 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {/* Results counter */}
        {selectedArea && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm font-medium">
              Showing research in {researchAreas.find(area => area.id === selectedArea)?.name || selectedArea}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}