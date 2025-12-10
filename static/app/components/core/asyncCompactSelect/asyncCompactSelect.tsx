import {useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';

import {Client} from 'sentry/api';
import {
  CompactSelect,
  type SelectOption,
  type SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';

export type AsyncCompactSelectProps<Value extends string> = Omit<
  SingleSelectProps<Value>,
  'options'
> & {
  /**
   * Function to transform query string into API params
   */
  onQuery: (query: string) => Record<string, any>;
  /**
   * Function to transform API response into options
   */
  onResults: (data: any) => Array<SelectOption<Value>>;
  /**
   * URL to fetch options from
   */
  url: string;
  /**
   * Initial options to show before search
   */
  defaultOptions?: Array<SelectOption<Value>>;
};

/**
 * AsyncCompactSelect combines CompactSelect's button-trigger UI with async search capabilities.
 * It fetches options from an API endpoint as the user types.
 */
export function AsyncCompactSelect<Value extends string = string>({
  url,
  onQuery,
  onResults,
  defaultOptions,
  clearable: _clearable,
  ...compactSelectProps
}: AsyncCompactSelectProps<Value>) {
  const [options, setOptions] = useState<Array<SelectOption<Value>>>(
    defaultOptions || []
  );
  const [isLoading, setIsLoading] = useState(false);

  // Use empty baseUrl since /extensions/ endpoints are not under /api/0/
  const apiRef = useRef(new Client({baseUrl: '', headers: {}}));

  useEffect(() => {
    const api = apiRef.current;
    return () => {
      api.clear();
    };
  }, []);

  const fetchOptions = useMemo(
    () =>
      debounce(async (query: string) => {
        if (!query) {
          setOptions(defaultOptions || []);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);

        try {
          const data = await apiRef.current.requestPromise(url, {
            query: onQuery(query),
          });

          const newOptions = onResults(data);
          setOptions(newOptions);
          setIsLoading(false);
        } catch {
          setOptions([]);
          setIsLoading(false);
        }
      }, 250),
    [url, onQuery, onResults, defaultOptions]
  );

  const handleSearch = (query: string) => {
    fetchOptions(query);
  };

  return (
    <CompactSelect
      {...compactSelectProps}
      searchable
      disableSearchFilter
      clearable={false}
      options={options}
      onSearch={handleSearch}
      loading={isLoading}
      emptyMessage={isLoading ? t('Loading...') : compactSelectProps.emptyMessage}
    />
  );
}
