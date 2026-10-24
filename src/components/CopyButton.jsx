import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the number is still on screen */
    }
  }
  return (
    <button type="button" className="btn btn-quiet btn-small" onClick={copy} aria-label={label}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
