import { keywordTextParts } from '../keywords.ts'

export function CardText({ text }: { text: string }) {
  return <>{keywordTextParts(text).map((part, i) => part.keyword ? <strong className="card__keyword" key={i}>{part.text}</strong> : part.text)}</>
}
