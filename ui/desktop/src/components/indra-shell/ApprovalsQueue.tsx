import type { CSSProperties } from 'react';
import type { SourceBox } from '../../indra/events';
import { CitationChip } from './CitationChip';

export interface ApprovalProposal {
  id: string;
  /** What the change would apply to, e.g. "SAP PM order 4500123". */
  resource: string;
  currentValue: string;
  proposedValue: string;
  /** The role that must approve this class of change. */
  requiredRole: string;
  evidence: SourceBox[];
}

export interface ApprovalsQueueProps {
  proposals: ApprovalProposal[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestEvidence: (id: string) => void;
}

const row: CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  background: 'var(--surface)',
  padding: 'var(--space-5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
};

const label: CSSProperties = {
  fontSize: 'var(--t-11)',
  lineHeight: 'var(--t-11--line-height)',
  color: 'var(--text-faint)',
};

const value: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--t-13)',
  lineHeight: 'var(--t-13--line-height)',
  color: 'var(--text-hi)',
  overflowWrap: 'anywhere',
};

const button: CSSProperties = {
  height: 28,
  padding: '0 var(--space-5)',
  border: '1px solid var(--line-strong)',
  borderRadius: 'var(--r-sm)',
  background: 'var(--raised)',
  color: 'var(--text-hi)',
  fontFamily: 'var(--font-ui)',
  fontSize: 'var(--t-12)',
  fontWeight: 500,
  cursor: 'pointer',
};

function EmptyState() {
  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface)',
        padding: 'var(--space-7)',
        color: 'var(--text-dim)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--t-13)',
        lineHeight: 'var(--t-13--line-height)',
      }}
    >
      Nothing is waiting on approval right now.
    </div>
  );
}

/**
 * Spec §5.7: nothing is applied without a name attached. Every proposal shows
 * the current value, the proposed value, its evidence, and exactly who is
 * required to approve it — an approval queue is not a rubber stamp.
 */
export function ApprovalsQueue({
  proposals,
  onApprove,
  onReject,
  onRequestEvidence,
}: ApprovalsQueueProps) {
  if (proposals.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {proposals.map((proposal) => (
        <div key={proposal.id} style={row}>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--t-14)',
              lineHeight: 'var(--t-14--line-height)',
              color: 'var(--text)',
              fontWeight: 500,
            }}
          >
            {proposal.resource}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={label}>Current</span>
              <span style={value}>{proposal.currentValue}</span>
            </div>
            <span aria-hidden="true" style={{ color: 'var(--text-faint)' }}>
              {'→'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <span style={label}>Proposed</span>
              <span style={value}>{proposal.proposedValue}</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--space-2)',
              fontSize: 'var(--t-12)',
              lineHeight: 'var(--t-12--line-height)',
              color: 'var(--text-dim)',
            }}
          >
            <span>Requires approval from</span>
            <span style={{ color: 'var(--text-hi)', fontWeight: 500 }}>
              {proposal.requiredRole}
            </span>
          </div>

          {proposal.evidence.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={label}>Evidence</span>
              {proposal.evidence.map((source, index) => (
                <CitationChip
                  key={`${source.doc_id}-${source.page}-${index}`}
                  index={index + 1}
                  source={source}
                  onOpen={() => {}}
                />
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" style={button} onClick={() => onApprove(proposal.id)}>
              Approve
            </button>
            <button type="button" style={button} onClick={() => onReject(proposal.id)}>
              Reject
            </button>
            <button
              type="button"
              style={{ ...button, background: 'transparent' }}
              onClick={() => onRequestEvidence(proposal.id)}
            >
              Request more evidence
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
