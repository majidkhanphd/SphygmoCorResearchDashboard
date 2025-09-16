import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCategories } from "@/services/pubmed";

interface SidebarFiltersProps {
  selectedCategories: string[];
  selectedYear: number | null;
  onCategoryChange: (categories: string[]) => void;
  onYearChange: (year: number | null) => void;
}

export default function SidebarFilters({ 
  selectedCategories, 
  selectedYear, 
  onCategoryChange, 
  onYearChange 
}: SidebarFiltersProps) {
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: getCategories,
  });

  const handleCategoryToggle = (categoryName: string) => {
    if (categoryName === "All Categories") {
      onCategoryChange([]);
      return;
    }

    const isSelected = selectedCategories.includes(categoryName);
    if (isSelected) {
      onCategoryChange(selectedCategories.filter(cat => cat !== categoryName));
    } else {
      onCategoryChange([...selectedCategories, categoryName]);
    }
  };

  const handleYearChange = (value: string) => {
    if (value === "all") {
      onYearChange(null);
    } else {
      onYearChange(parseInt(value));
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="lg:w-80 flex-shrink-0">
      <div className="sticky top-24">
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Filter by Category</h3>
          <div className="space-y-2">
            <Button
              variant={selectedCategories.length === 0 ? "default" : "ghost"}
              className="w-full justify-start text-left"
              onClick={() => handleCategoryToggle("All Categories")}
              data-testid="filter-all-categories"
            >
              All Categories
            </Button>
            {categories.map((category: any) => (
              <Button
                key={category.id}
                variant={selectedCategories.includes(category.name) ? "default" : "ghost"}
                className="w-full justify-start text-left"
                onClick={() => handleCategoryToggle(category.name)}
                data-testid={`filter-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Filter by Year</h3>
          <Select onValueChange={handleYearChange} value={selectedYear?.toString() || "all"}>
            <SelectTrigger data-testid="year-filter-select">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
              <SelectItem value="earlier">Earlier</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
