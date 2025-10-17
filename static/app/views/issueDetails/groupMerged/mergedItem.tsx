import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconChevron, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Fingerprint} from 'sentry/stores/groupingStore';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {createIssueLink} from 'sentry/views/issueList/utils';

interface Props {
  fingerprint: Fingerprint;
  totalFingerprint: number;
}

interface UnmergeState {
  busy?: boolean;
  checked?: boolean;
  collapsed?: boolean;
}

interface GroupingStoreData {
  unmergeState?: Map<string, UnmergeState>;
}

function MergedItem({fingerprint, totalFingerprint}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validate required props
  if (!fingerprint?.id) {
    console.error('MergedItem: Invalid fingerprint provided', fingerprint);
    return null;
  }

  if (typeof totalFingerprint !== 'number' || totalFingerprint < 0) {
    console.error('MergedItem: Invalid totalFingerprint provided', totalFingerprint);
    return null;
  }

  const onGroupChange = useCallback(({unmergeState}: GroupingStoreData) => {
    if (!unmergeState || !fingerprint?.id) {
      return;
    }

    try {
      const stateForId = unmergeState.get(fingerprint.id);
      if (!stateForId) {
        return;
      }

      // Safely update state with validation
      if (typeof stateForId.collapsed === 'boolean') {
        setCollapsed(stateForId.collapsed);
      }
      if (typeof stateForId.checked === 'boolean') {
        setChecked(stateForId.checked);
      }
      if (typeof stateForId.busy === 'boolean') {
        setBusy(stateForId.busy);
      }
    } catch (err) {
      console.error('Error updating group state:', err);
      setError('Failed to update group state');
    }
  }, [fingerprint?.id]);

  const handleToggleEvents = useCallback(() => {
    if (!fingerprint?.id) {
      console.error('Cannot toggle events: invalid fingerprint ID');
      return;
    }

    try {
      GroupingStore.onToggleCollapseFingerprint(fingerprint.id);
    } catch (err) {
      console.error('Error toggling events:', err);
      setError('Failed to toggle events');
    }
  }, [fingerprint?.id]);

  const handleToggle = useCallback(() => {
    if (!fingerprint?.id || !fingerprint?.latestEvent?.id) {
      console.error('Cannot toggle: missing required data', {
        fingerprintId: fingerprint?.id,
        eventId: fingerprint?.latestEvent?.id,
      });
      return;
    }

    if (busy) {
      return;
    }

    try {
      // clicking anywhere in the row will toggle the checkbox
      GroupingStore.onToggleUnmerge([fingerprint.id, fingerprint.latestEvent.id]);
    } catch (err) {
      console.error('Error toggling unmerge:', err);
      setError('Failed to toggle selection');
    }
  }, [fingerprint?.id, fingerprint?.latestEvent?.id, busy]);

  const handleCheckClick = useCallback(() => {
    // noop because of react warning about being a controlled input without `onChange`
    // we handle change via row click
  }, []);

  const renderFingerprint = useCallback((id: string, label?: string) => {
    if (!id) {
      return <span>{t('Unknown fingerprint')}</span>;
    }

    if (!label) {
      return <code>{id}</code>;
    }

    return (
      <Tooltip title={id}>
        <code>{label}</code>
      </Tooltip>
    );
  }, []);

  useEffect(() => {
    if (!fingerprint?.id) {
      return;
    }

    const teardown = GroupingStore.listen(onGroupChange, undefined);
    return () => {
      teardown();
    };
  }, [onGroupChange, fingerprint?.id]);

  // Memoize computed values to prevent unnecessary re-renders
  const {latestEvent, id, label, mergedBySeer} = fingerprint;
  const checkboxDisabled = busy || totalFingerprint === 1;

  const issueLink = useMemo(() => {
    if (!latestEvent?.id || !organization) {
      return null;
    }

    try {
      return createIssueLink({
        organization,
        location,
        data: latestEvent,
        eventId: latestEvent.id,
        referrer: 'merged-item',
      });
    } catch (err) {
      console.error('Error creating issue link:', err);
      return null;
    }
  }, [latestEvent, organization, location]);

  const tooltipTitle = useMemo(() => {
    if (checkboxDisabled && totalFingerprint === 1) {
      return t('To check, the list must contain 2 or more items');
    }
    return undefined;
  }, [checkboxDisabled, totalFingerprint]);

  const ariaLabel = useMemo(() => {
    if (!id) return '';
    return collapsed ? t('Show %s fingerprints', id) : t('Collapse %s fingerprints', id);
  }, [collapsed, id]);

  // Early return for error state
  if (error) {
    return (
      <MergedGroup busy={false}>
        <Controls expanded={true}>
          <Text color="errorText">{error}</Text>
        </Controls>
      </MergedGroup>
    );
  }

  // `latestEvent` can be null if last event w/ fingerprint is not within retention period
  return (
    <MergedGroup busy={busy}>
      <Controls expanded={!collapsed}>
        <FingerprintLabel onClick={handleToggle} role="button" tabIndex={0}>
          <Tooltip
            containerDisplayMode="flex"
            disabled={!checkboxDisabled}
            title={tooltipTitle}
          >
            <Checkbox
              value={id}
              checked={checked}
              disabled={checkboxDisabled}
              onChange={handleCheckClick}
              size="xs"
              aria-label={checked ? t('Uncheck fingerprint') : t('Check fingerprint')}
            />
          </Tooltip>
          {renderFingerprint(id, label)}
          {mergedBySeer && ' (merged by Seer)'}
        </FingerprintLabel>

        <Button
          aria-label={ariaLabel}
          size="zero"
          borderless
          icon={<IconChevron direction={collapsed ? 'down' : 'up'} size="xs" />}
          onClick={handleToggleEvents}
          disabled={busy}
        />
      </Controls>

      {!collapsed && (
        <MergedEventList>
          {issueLink && latestEvent ? (
            <Flex align="center" gap="xs">
              <LinkButton
                to={issueLink}
                icon={<IconLink color="linkColor" />}
                title={t('View latest event')}
                aria-label={t('View latest event')}
                borderless
                size="xs"
                style={{marginLeft: space(1)}}
              />
              <EventDetails>
                <Text size="md" data-issue-title-primary>
                  {latestEvent.title || t('Untitled event')}
                </Text>
              </EventDetails>
            </Flex>
          ) : latestEvent ? (
            <EventDetails>
              <Text size="md" color="subText">
                {t('Event not available for linking')}
              </Text>
            </EventDetails>
          ) : (
            <EventDetails>
              <Text size="md" color="subText">
                {t('No recent events available')}
              </Text>
            </EventDetails>
          )}
        </MergedEventList>
      )}
    </MergedGroup>
  );
}

const MergedGroup = styled('div')<{busy: boolean}>`
  ${p => p.busy && 'opacity: 0.2'};
`;

const Controls = styled('div')<{expanded: boolean}>`
  display: flex;
  justify-content: space-between;
  background-color: ${p => p.theme.backgroundSecondary};
  ${p => p.expanded && `border-bottom: 1px solid ${p.theme.innerBorder}`};
  padding: ${space(0.5)} ${space(1)};

  ${MergedGroup}:not(:first-child) & {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }

  ${MergedGroup}:last-child & {
    ${p => !p.expanded && `border-bottom: none`};
    ${p =>
      !p.expanded &&
      `border-radius: 0 0 ${p.theme.borderRadius} ${p.theme.borderRadius}`};
  }
`;

const FingerprintLabel = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  line-height: 1;
  font-weight: ${p => p.theme.fontWeight.normal};
  margin: 0;
`;

const MergedEventList = styled('div')`
  overflow: hidden;
  border: none;
  background-color: ${p => p.theme.background};
`;

const EventDetails = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)};
`;

export default MergedItem;
