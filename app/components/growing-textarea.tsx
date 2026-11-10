import { type ComponentProps, useLayoutEffect, useRef } from 'react'
import { cn } from '~/lib/utils'
import { Textarea } from './ui/textarea'

/**
 * A field that starts one line high, like an input, and grows as the text wraps. `singleLine` keeps
 * the value on one line, for text that goes out as part of a key's line: Enter submits the form as
 * it would from an input, and pasted line breaks become spaces.
 */
export function GrowingTextarea({
  singleLine = false,
  value,
  onChange,
  onKeyDown,
  className,
  ...props
}: ComponentProps<'textarea'> & { singleLine?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Browsers without field-sizing are sized by hand.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resize whenever the text changes
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || CSS.supports('field-sizing', 'content')) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight}px`
  }, [value])

  return (
    <Textarea
      ref={ref}
      rows={1}
      value={value}
      onKeyDown={(event) => {
        if (singleLine && event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          // The form's own submit button, wherever it sits on the page.
          const submit = Array.from(event.currentTarget.form?.elements ?? []).find(
            (element): element is HTMLButtonElement =>
              element instanceof HTMLButtonElement && element.type === 'submit',
          )
          if (submit && !submit.disabled) submit.click()
        }
        onKeyDown?.(event)
      }}
      onChange={(event) => {
        if (singleLine) event.target.value = event.target.value.replace(/\s*[\r\n]+\s*/g, ' ')
        onChange?.(event)
      }}
      className={cn('min-h-9 resize-none py-[7px] leading-5', className)}
      {...props}
    />
  )
}
