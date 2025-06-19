
import { FC } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  handleSearch: () => void;
  clearSearch: () => void;
  isSearchActive: boolean;
}

const SearchBar: FC<SearchBarProps> = ({ 
  searchTerm, 
  setSearchTerm, 
  handleSearch, 
  clearSearch, 
  isSearchActive 
}) => {
  return (
    <div className="flex space-x-2">
      <div className="relative">
        <Input
          placeholder="Search leads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64 pr-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
        {isSearchActive && (
          <Button 
            variant="ghost" 
            size="sm"
            className="absolute right-0 top-0 h-full rounded-l-none"
            onClick={clearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Button 
        variant="outline" 
        onClick={handleSearch}
        className="flex items-center space-x-2"
      >
        <Search className="h-4 w-4" />
        <span>Search</span>
      </Button>
    </div>
  );
};

export default SearchBar;
