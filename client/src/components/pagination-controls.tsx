import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
  const totalPages = Math.ceil(total / perPage);

  // Don't render if there's only one page or no results
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div style={{ paddingTop: '48px', borderTop: '1px solid #E5E5E7', marginTop: '48px' }}>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
              className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === 1 ? '#6E6E73' : '#007AFF',
                border: '1px solid #E5E5E7',
                borderRadius: '8px',
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
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: currentPage === pageNum ? '#FFFFFF' : '#1D1D1F',
                    backgroundColor: currentPage === pageNum ? '#007AFF' : 'transparent',
                    border: '1px solid #E5E5E7',
                    borderRadius: '8px',
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
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
                fontSize: '14px',
                fontWeight: '500',
                color: currentPage === totalPages ? '#6E6E73' : '#007AFF',
                border: '1px solid #E5E5E7',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              data-testid="pagination-next"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      
      {/* Results count */}
      <div className="text-center mt-4" style={{ 
        fontSize: '14px', 
        color: '#6E6E73',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif'
      }}>
        Showing {((currentPage - 1) * perPage) + 1} - {Math.min(currentPage * perPage, total)} of {total} publications
      </div>
    </div>
  );
}
