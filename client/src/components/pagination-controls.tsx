import { useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
  total: number;
  currentPage: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function PaginationControls({
  total,
  currentPage,
  perPage,
  onPageChange,
  onPerPageChange
}: PaginationControlsProps) {
  const [jumpToPage, setJumpToPage] = useState("");
  const totalPages = Math.ceil(total / perPage);

  // Don't render anything if there are no results
  if (total === 0) {
    return null;
  }

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpToPage("");
    }
  };

  const handleJumpKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  return (
    <div style={{ paddingTop: '48px', borderTop: '1px solid #E5E5E7', marginTop: '48px' }}>
      {/* Per-page selector - always visible */}
      <div className="flex items-center justify-center gap-2 mb-6" style={{
        fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: '14px',
        color: '#1D1D1F'
      }}>
        <span style={{ fontWeight: '500' }}>Show:</span>
        <Select value={perPage.toString()} onValueChange={(value) => onPerPageChange(parseInt(value))}>
          <SelectTrigger 
            className="w-[110px]"
            style={{
              border: '1px solid #E5E5E7',
              borderRadius: '5px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#1D1D1F'
            }}
            data-testid="per-page-selector"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent 
            position="popper" 
            sideOffset={4}
            className="z-[9999]"
            style={{ zIndex: 9999 }}
          >
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
            <SelectItem value="100">100 per page</SelectItem>
            <SelectItem value="200">200 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Page navigation - only show if more than one page */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent className="gap-2">
          {/* First button */}
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className={currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              style={{
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === 1 ? '#6E6E73' : '#AF87FF',
                border: '1px solid #E5E5E7',
                borderRadius: '5px',
                padding: '8px 12px',
                gap: '4px'
              }}
              data-testid="pagination-first"
            >
              <ChevronsLeft className="h-4 w-4" />
              First
            </Button>
          </PaginationItem>
          
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              style={{
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === 1 ? '#6E6E73' : '#AF87FF',
                border: '1px solid #E5E5E7',
                borderRadius: '5px',
                padding: '8px 12px'
              }}
              data-testid="pagination-previous"
            />
          </PaginationItem>
          
          {/* Page numbers with windowing algorithm */}
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let pageNum;
            if (totalPages <= 7) {
              pageNum = i + 1;
            } else if (currentPage <= 4) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 3) {
              pageNum = totalPages - 6 + i;
            } else {
              pageNum = currentPage - 3 + i;
            }
            
            if (pageNum < 1 || pageNum > totalPages) return null;
            
            return (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  onClick={() => onPageChange(pageNum)}
                  isActive={currentPage === pageNum}
                  className="cursor-pointer"
                  style={{
                    fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: currentPage === pageNum ? '#FFFFFF' : '#1D1D1F',
                    backgroundColor: currentPage === pageNum ? '#AF87FF' : 'transparent',
                    border: '1px solid #E5E5E7',
                    borderRadius: '5px',
                    minWidth: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-testid={`pagination-page-${pageNum}`}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext
              onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
              className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              style={{
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === totalPages ? '#6E6E73' : '#AF87FF',
                border: '1px solid #E5E5E7',
                borderRadius: '5px',
                padding: '8px 12px'
              }}
              data-testid="pagination-next"
            />
          </PaginationItem>
          
          {/* Last button */}
          <PaginationItem>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className={currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              style={{
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === totalPages ? '#6E6E73' : '#AF87FF',
                border: '1px solid #E5E5E7',
                borderRadius: '5px',
                padding: '8px 12px',
                gap: '4px'
              }}
              data-testid="pagination-last"
            >
              Last
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
          
          {/* Jump to page input */}
          <PaginationItem className="ml-4">
            <div className="flex items-center gap-2">
              <span style={{
                fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: '#6E6E73'
              }}>
                Go to:
              </span>
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                onKeyPress={handleJumpKeyPress}
                placeholder="Page"
                className="w-20"
                style={{
                  fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontSize: '14px',
                  border: '1px solid #E5E5E7',
                  borderRadius: '5px',
                  padding: '8px'
                }}
                data-testid="jump-to-page-input"
              />
            </div>
          </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      {/* Results count - always visible */}
      <div className="text-center mt-4" style={{ 
        fontSize: '14px', 
        color: '#6E6E73',
        fontFamily: 'Montserrat, -apple-system, BlinkMacSystemFont, sans-serif'
      }}>
        Showing {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, total)} of {total} publications
      </div>
    </div>
  );
}
