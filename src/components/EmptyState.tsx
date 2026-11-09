import type { ReactNode } from 'react'
import { GiftIllustration } from './icons'

interface Props {
  title: string
  text: string
  action?: ReactNode
}

export function EmptyState({ title, text, action }: Props) {
  return (
    <div className="empty">
      <GiftIllustration />
      <h2 className="empty-title">{title}</h2>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  )
}
