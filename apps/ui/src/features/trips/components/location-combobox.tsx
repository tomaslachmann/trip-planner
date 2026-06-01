'use client';

import { MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { LocationResult } from '../types';

export function LocationCombobox({
  defaultLabel = '',
  defaultLatitude,
  defaultLongitude,
  onSearch,
}: {
  defaultLabel?: string;
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  onSearch: (query: string) => Promise<LocationResult[]>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(defaultLabel);
  const [selected, setSelected] = useState<LocationResult | null>(null);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoSelectedDefault, setAutoSelectedDefault] = useState(false);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      onSearch(text)
        .then((items) => {
          if (!cancelled) setResults(items);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [onSearch, query]);

  useEffect(() => {
    if (autoSelectedDefault || selected || defaultLatitude != null || defaultLongitude != null) return;
    if (!defaultLabel || query !== defaultLabel || results.length === 0) return;
    setSelected(results[0]);
    setQuery(results[0].label);
    setAutoSelectedDefault(true);
  }, [autoSelectedDefault, defaultLabel, defaultLatitude, defaultLongitude, query, results, selected]);

  const latitude = selected?.latitude ?? defaultLatitude ?? '';
  const longitude = selected?.longitude ?? defaultLongitude ?? '';

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            className="h-10 w-full justify-start px-3 text-left font-normal"
            variant="outline"
            type="button"
          >
            <MapPin className="size-4 text-muted-foreground" />
            <span className={query ? 'ellipsis' : 'text-muted-foreground'}>
              {query || 'Hledat adresu nebo místo'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Začni psát lokaci..."
            />
            <CommandList>
              <CommandEmpty>{loading ? 'Hledám...' : 'Nic nenalezeno.'}</CommandEmpty>
              <CommandGroup>
                {results.map((item) => (
                  <CommandItem
                    key={item.externalId}
                    value={item.label}
                    onSelect={() => {
                      setSelected(item);
                      setQuery(item.label);
                      setOpen(false);
                    }}
                  >
                    <Search className="size-4 text-muted-foreground" />
                    <span className="ellipsis">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <input name="latitude" type="hidden" value={latitude} />
      <input name="longitude" type="hidden" value={longitude} />
      <input name="locationLabel" type="hidden" value={query} />
      <input name="locationExternalId" type="hidden" value={selected?.externalId ?? ''} />
    </div>
  );
}
