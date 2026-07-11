'use client'

import { useRef, useState } from 'react'

// The install command with a copy affordance (Matthew's ask, 2026-07-11):
// a non-engineer should never have to select text in a code block. The
// "copied" state is quiet bone/ash — amber stays reserved for introductions.
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API blocked (non-secure context or permissions): select the
      // command so a manual cmd/ctrl+C still lands the same result.
      const sel = window.getSelection()
      if (sel && preRef.current) {
        sel.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(preRef.current)
        sel.addRange(range)
      }
    }
  }

  return (
    <div className="cmd">
      <pre ref={preRef}>{command}</pre>
      <button type="button" className="copy" onClick={copy} aria-live="polite">
        {copied ? 'copied ✓' : 'copy'}
      </button>
    </div>
  )
}
