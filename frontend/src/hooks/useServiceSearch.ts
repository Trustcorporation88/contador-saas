import { useState, useEffect, useMemo } from 'react';
import { Service, ServiceCategory } from '../types/service';
import { SERVICES } from '../config/services';

interface UseServiceSearchOptions {
  category?: ServiceCategory | 'all';
  status?: 'all' | 'active' | 'warning' | 'error' | 'disabled';
}

export function useServiceSearch(query: string, options: UseServiceSearchOptions = {}) {
  const { category = 'all', status = 'all' } = options;
  const [results, setResults] = useState<Service[]>([]);

  const filteredServices = useMemo(() => {
    let filtered = SERVICES;

    // Filter by category
    if (category !== 'all') {
      filtered = filtered.filter(service => service.category === category);
    }

    // Filter by status
    if (status !== 'all') {
      filtered = filtered.filter(service => service.status === status);
    }

    return filtered;
  }, [category, status]);

  useEffect(() => {
    if (!query || query.trim().length === 0) {
      setResults(filteredServices);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    const searched = filteredServices.filter(service => 
      service.title.toLowerCase().includes(lowerQuery) ||
      service.description.toLowerCase().includes(lowerQuery)
    );

    setResults(searched);
  }, [query, filteredServices]);

  return results;
}

// Hook para keyboard shortcuts
export function useServiceSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K ou Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
